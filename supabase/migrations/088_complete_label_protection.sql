-- ================================================================
-- PROTEÇÃO COMPLETA DE ETIQUETAS - INTEGRAÇÃO FRONTEND/BACKEND
-- Executar após implementar o modal no frontend
-- ================================================================

-- 1. VERIFICAR SE A FUNÇÃO desfazer_etiqueta_gerada EXISTE
-- Se não existir, criar uma versão básica
CREATE OR REPLACE FUNCTION desfazer_etiqueta_gerada(p_ids UUID[])
RETURNS jsonb AS $$
DECLARE
    v_count INTEGER := 0;
    v_id UUID;
BEGIN
    FOREACH v_id IN ARRAY p_ids LOOP
        -- Só atualiza se o pedido existe
        UPDATE pedidos_consolidados_v3
        SET 
            status_envio = 'Pendente',
            codigo_rastreio = NULL,
            logistica_etiqueta_url = NULL,
            logistica_provider = NULL,
            logistica_servico = NULL,
            logistica_valor = NULL,
            updated_at = NOW()
        WHERE id = v_id
          AND (codigo_rastreio IS NOT NULL OR status_envio = 'Label Gerada');
        
        IF FOUND THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'status', 'success',
        'message', v_count || ' pedido(s) atualizado(s)',
        'count', v_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. GARANTIR QUE A TABELA TENHA AS COLUNAS NECESSÁRIAS
DO $$
BEGIN
    -- Adicionar force_remover_etiqueta se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pedidos_consolidados_v3' AND column_name = 'force_remover_etiqueta'
    ) THEN
        ALTER TABLE pedidos_consolidados_v3 ADD COLUMN force_remover_etiqueta BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 3. RECRIAR TRIGGER DE PROTEÇÃO (se não existir)
DROP TRIGGER IF EXISTS trg_protect_etiquetados ON pedidos_consolidados_v3;

CREATE OR REPLACE FUNCTION protect_etiquetados_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Se está tentando remover código_rastreio
    IF OLD.codigo_rastreio IS NOT NULL AND NEW.codigo_rastreio IS NULL THEN
        -- Permitir apenas se a flag force_remover_etiqueta estiver setada
        IF NOT COALESCE(NEW.force_remover_etiqueta, FALSE) THEN
            RAISE EXCEPTION 'Não é permitido remover código de rastreio sem confirmação explícita. Use a interface de reset de etiqueta.';
        END IF;
    END IF;
    
    -- Limpar a flag após uso
    NEW.force_remover_etiqueta := FALSE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_etiquetados
    BEFORE UPDATE ON pedidos_consolidados_v3
    FOR EACH ROW
    EXECUTE FUNCTION protect_etiquetados_update();

-- 4. FUNÇÃO: Resetar etiqueta manualmente (usada pelo frontend)
CREATE OR REPLACE FUNCTION resetar_etiqueta_pedido(
    p_pedido_id UUID,
    p_confirmacao BOOLEAN DEFAULT FALSE
)
RETURNS jsonb AS $$
DECLARE
    v_pedido RECORD;
    v_user_id UUID;
BEGIN
    -- Buscar usuário atual
    v_user_id := auth.uid();
    
    -- Buscar pedido
    SELECT * INTO v_pedido FROM pedidos_consolidados_v3 WHERE id = p_pedido_id;
    
    IF v_pedido IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
    END IF;
    
    IF v_pedido.codigo_rastreio IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido não possui código de rastreio');
    END IF;
    
    IF NOT p_confirmacao THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Confirmação necessária',
            'message', 'Essa ação cancelará a etiqueta atual e invalidará o código de rastreio: ' || v_pedido.codigo_rastreio
        );
    END IF;
    
    -- Realizar o reset com a flag especial
    UPDATE pedidos_consolidados_v3
    SET 
        codigo_rastreio = NULL,
        status_envio = 'Pendente',
        logistica_etiqueta_url = NULL,
        logistica_provider = NULL,
        logistica_servico = NULL,
        logistica_valor = NULL,
        force_remover_etiqueta = TRUE,
        updated_at = NOW()
    WHERE id = p_pedido_id;
    
    -- Log da ação na tabela de histórico (se existir)
    BEGIN
        INSERT INTO solicitacoes_historico (solicitacao_id, acao, usuario_id, detalhes)
        VALUES (
            p_pedido_id,
            'ETIQUETA_RESETADA',
            v_user_id,
            jsonb_build_object(
                'codigo_rastreio_anterior', v_pedido.codigo_rastreio,
                'data_reset', NOW(),
                'metodo', 'INTERFACE_MANUAL'
            )
        );
    EXCEPTION WHEN OTHERS THEN
        -- Ignora erro se a tabela não existir
        NULL;
    END;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Etiqueta removida com sucesso',
        'codigo_rastreio_removido', v_pedido.codigo_rastreio
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. ATUALIZAR FUNÇÃO CONSOLIDAR PARA PROTEGER ETIQUETADOS
-- Garantir que a cláusula ON CONFLICT não atualize pedidos com rastreio

-- 6. PERMISSÕES
GRANT EXECUTE ON FUNCTION desfazer_etiqueta_gerada(UUID[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resetar_etiqueta_pedido(UUID, BOOLEAN) TO authenticated, service_role;

-- 7. CRIAR ÍNDICE PARA MELHORAR PERFORMANCE (se não existir)
CREATE INDEX IF NOT EXISTS idx_pedidos_consolidados_v3_codigo_rastreio 
ON pedidos_consolidados_v3(codigo_rastreio) 
WHERE codigo_rastreio IS NOT NULL;

-- Verificar configuração
SELECT 
    'Configuração de proteção de etiquetas concluída!' as status,
    (SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'trg_protect_etiquetados') as trigger_ativo,
    (SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos_consolidados_v3' AND column_name = 'force_remover_etiqueta')) as coluna_flag_existe;

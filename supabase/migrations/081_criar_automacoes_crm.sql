-- ================================================================
-- SISTEMA DE AUTOMAÇÃO DO CRM
-- Tabelas para regras automáticas de etiquetas e pipelines
-- ================================================================

-- Tabela de regras de automação
CREATE TABLE IF NOT EXISTS crm_automacao_regras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    
    -- Gatilho (quando a regra é acionada)
    gatilho_tipo VARCHAR(50) NOT NULL CHECK (gatilho_tipo IN (
        'lead_criado',           -- Quando lead é criado
        'status_alterado',       -- Quando status do lead muda
        'etapa_alterada',        -- Quando lead muda de etapa no pipeline
        'secao_alterada',        -- Quando lead muda de seção da aplicação
        'tempo_na_etapa',        -- Quando lead está X tempo na etapa
        'compra_realizada',      -- Quando lead compra
        'compra_cancelada'       -- Quando lead cancela
    )),
    
    -- Condições do gatilho (JSON flexível)
    gatilho_condicoes JSONB DEFAULT '{}',
    -- Exemplos:
    -- {"status_atual": "interesse", "status_anterior": "novo"}
    -- {"secao": "pos-venda", "acao": "entrou"}
    -- {"etapa_id": "uuid-da-etapa", "tempo_horas": 24}
    
    -- Ações a executar
    acao_tipo VARCHAR(50) NOT NULL CHECK (acao_tipo IN (
        'aplicar_tag',           -- Aplicar etiqueta
        'remover_tag',           -- Remover etiqueta
        'mover_pipeline',        -- Mover para pipeline/etapa
        'criar_tarefa',          -- Criar tarefa
        'enviar_notificacao',    -- Enviar notificação
        'atualizar_campo'        -- Atualizar campo do lead
    )),
    
    -- Configuração da ação (JSON)
    acao_config JSONB NOT NULL DEFAULT '{}',
    -- Exemplos:
    -- {"tag_id": "uuid-da-tag"}
    -- {"pipeline_id": "uuid", "etapa_id": "uuid"}
    -- {"campo": "prioridade", "valor": "alta"}
    
    -- Status da regra
    ativo BOOLEAN DEFAULT true,
    ordem INTEGER DEFAULT 0,
    
    -- Metadados
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Tabela de logs de execução (para auditoria)
CREATE TABLE IF NOT EXISTS crm_automacao_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    regra_id UUID REFERENCES crm_automacao_regras(id) ON DELETE SET NULL,
    lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    
    -- Contexto da execução
    gatilho_tipo VARCHAR(50) NOT NULL,
    contexto JSONB DEFAULT '{}',  -- Dados do evento que disparou
    
    -- Resultado
    status VARCHAR(20) NOT NULL CHECK (status IN ('sucesso', 'erro', 'ignorado')),
    resultado JSONB DEFAULT '{}', -- Detalhes do que foi feito
    erro_mensagem TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_automacao_regras_ativo ON crm_automacao_regras(ativo);
CREATE INDEX IF NOT EXISTS idx_automacao_regras_gatilho ON crm_automacao_regras(gatilho_tipo, ativo);
CREATE INDEX IF NOT EXISTS idx_automacao_logs_lead ON crm_automacao_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_automacao_logs_regra ON crm_automacao_logs(regra_id);
CREATE INDEX IF NOT EXISTS idx_automacao_logs_created ON crm_automacao_logs(created_at);

-- RLS Policies
ALTER TABLE crm_automacao_regras ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_automacao_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_automacao_regras" ON crm_automacao_regras
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_automacao_logs" ON crm_automacao_logs
    FOR ALL USING (true) WITH CHECK (true);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_crm_automacao_regras_updated_at ON crm_automacao_regras;
CREATE TRIGGER update_crm_automacao_regras_updated_at
    BEFORE UPDATE ON crm_automacao_regras
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- FUNÇÃO PRINCIPAL: Executar regras de automação
-- ================================================================

CREATE OR REPLACE FUNCTION executar_regras_automacao(
    p_lead_id UUID,
    p_gatilho_tipo VARCHAR,
    p_contexto JSONB DEFAULT '{}'
)
RETURNS TABLE (
    regra_id UUID,
    regra_nome VARCHAR,
    status VARCHAR,
    mensagem TEXT
) AS $$
DECLARE
    v_regra RECORD;
    v_deve_executar BOOLEAN;
    v_resultado JSONB;
    v_erro TEXT;
BEGIN
    -- Loop pelas regras ativas do tipo específico
    FOR v_regra IN 
        SELECT * FROM crm_automacao_regras 
        WHERE ativo = true AND gatilho_tipo = p_gatilho_tipo
        ORDER BY ordem, created_at
    LOOP
        v_deve_executar := false;
        v_resultado := '{}';
        v_erro := NULL;
        
        -- Verificar condições específicas do gatilho
        CASE v_regra.gatilho_tipo
            WHEN 'status_alterado' THEN
                -- Verifica se status atual/anterior batem
                IF (p_contexto->>'status_novo' = v_regra.gatilho_condicoes->>'status_atual') AND
                   ((v_regra.gatilho_condicoes->>'status_anterior') IS NULL OR 
                    p_contexto->>'status_anterior' = v_regra.gatilho_condicoes->>'status_anterior') THEN
                    v_deve_executar := true;
                END IF;
                
            WHEN 'secao_alterada' THEN
                -- Verifica se seção bate
                IF p_contexto->>'secao_nova' = v_regra.gatilho_condicoes->>'secao' THEN
                    v_deve_executar := true;
                END IF;
                
            WHEN 'lead_criado' THEN
                v_deve_executar := true;
                
            WHEN 'etapa_alterada' THEN
                -- Verifica se mudou para etapa específica
                IF p_contexto->>'etapa_nova_id' = v_regra.gatilho_condicoes->>'etapa_id' THEN
                    v_deve_executar := true;
                END IF;
                
            ELSE
                v_deve_executar := true;
        END CASE;
        
        -- Executar ação se condições atendidas
        IF v_deve_executar THEN
            BEGIN
                CASE v_regra.acao_tipo
                    WHEN 'aplicar_tag' THEN
                        INSERT INTO crm_lead_tags (lead_id, tag_id)
                        VALUES (p_lead_id, (v_regra.acao_config->>'tag_id')::UUID)
                        ON CONFLICT DO NOTHING;
                        v_resultado := jsonb_build_object('acao', 'tag_aplicada', 'tag_id', v_regra.acao_config->>'tag_id');
                        
                    WHEN 'remover_tag' THEN
                        DELETE FROM crm_lead_tags 
                        WHERE lead_id = p_lead_id AND tag_id = (v_regra.acao_config->>'tag_id')::UUID;
                        v_resultado := jsonb_build_object('acao', 'tag_removida', 'tag_id', v_regra.acao_config->>'tag_id');
                        
                    WHEN 'mover_pipeline' THEN
                        UPDATE crm_leads 
                        SET pipeline_id = (v_regra.acao_config->>'pipeline_id')::UUID,
                            etapa_atual_id = (v_regra.acao_config->>'etapa_id')::UUID,
                            updated_at = now()
                        WHERE id = p_lead_id;
                        v_resultado := jsonb_build_object('acao', 'movido_pipeline', 'pipeline_id', v_regra.acao_config->>'pipeline_id', 'etapa_id', v_regra.acao_config->>'etapa_id');
                        
                    WHEN 'atualizar_campo' THEN
                        EXECUTE format('UPDATE crm_leads SET %I = $1 WHERE id = $2',
                                      v_regra.acao_config->>'campo')
                        USING v_regra.acao_config->>'valor', p_lead_id;
                        v_resultado := jsonb_build_object('acao', 'campo_atualizado', 'campo', v_regra.acao_config->>'campo');
                        
                END CASE;
                
                -- Registrar log de sucesso
                INSERT INTO crm_automacao_logs (regra_id, lead_id, gatilho_tipo, contexto, status, resultado)
                VALUES (v_regra.id, p_lead_id, p_gatilho_tipo, p_contexto, 'sucesso', v_resultado);
                
                RETURN QUERY SELECT v_regra.id, v_regra.nome, 'sucesso'::VARCHAR, 'Regra executada com sucesso'::TEXT;
                
            EXCEPTION WHEN OTHERS THEN
                v_erro := SQLERRM;
                
                -- Registrar log de erro
                INSERT INTO crm_automacao_logs (regra_id, lead_id, gatilho_tipo, contexto, status, erro_mensagem)
                VALUES (v_regra.id, p_lead_id, p_gatilho_tipo, p_contexto, 'erro', v_erro);
                
                RETURN QUERY SELECT v_regra.id, v_regra.nome, 'erro'::VARCHAR, v_erro::TEXT;
            END;
        ELSE
            RETURN QUERY SELECT v_regra.id, v_regra.nome, 'ignorado'::VARCHAR, 'Condições não atendidas'::TEXT;
        END IF;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários
COMMENT ON TABLE crm_automacao_regras IS 'Regras de automação do CRM para etiquetas e pipelines';
COMMENT ON TABLE crm_automacao_logs IS 'Logs de execução das regras de automação';
COMMENT ON FUNCTION executar_regras_automacao IS 'Executa todas as regras de automação aplicáveis para um lead e gatilho específicos';

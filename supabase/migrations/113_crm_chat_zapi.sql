-- ==============================================================================
-- 113_crm_chat_zapi.sql
-- Propósito: Estrutura base para o módulo de Atendimento via Z-API (WhatsApp).
-- Tabelas para Tickets (Atendimentos), Mensagens e Histórico, incluindo RLS 
-- com base no sistema de perfis (profiles.role).
-- ==============================================================================

-- 1. DROP Tables (Como é novo, podemos garantir que qualquer lixo anterior seja apagado)
DROP TABLE IF EXISTS public.crm_mensagens CASCADE;
DROP TABLE IF EXISTS public.crm_atendimentos CASCADE;

-- 2. Tabela: Atendimentos (Tickets)
CREATE TABLE public.crm_atendimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telefone TEXT NOT NULL,
    cliente_nome TEXT,
    
    -- Status do ticket: 'novo', 'em_andamento', 'concluido'
    status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'em_andamento', 'concluido')),
    
    -- Identificação e Vínculo (Opcional, se veio de uma compra estruturada)
    pedido_id UUID REFERENCES public.pedidos_consolidados_v3(id) ON DELETE SET NULL,
    
    -- Quem assumiu o ticket (Atendente / Gestor / ADM)
    responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Tagueamento / Filas Extras (opcional no futuro)
    etiquetas jsonb DEFAULT '[]'::jsonb,
    
    -- Metadados de ordenação (Para colocar os mais recentes no topo)
    ultima_mensagem_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexação rápida para dashboard (Tickets aguardando)
CREATE INDEX IF NOT EXISTS idx_crm_atendimentos_status ON public.crm_atendimentos(status);
CREATE INDEX IF NOT EXISTS idx_crm_atendimentos_telefone ON public.crm_atendimentos(telefone);
CREATE INDEX IF NOT EXISTS idx_crm_atendimentos_responsavel ON public.crm_atendimentos(responsavel_id);

-- 3. Tabela: Mensagens (Histórico do Atendimento)
CREATE TABLE public.crm_mensagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    atendimento_id UUID NOT NULL REFERENCES public.crm_atendimentos(id) ON DELETE CASCADE,
    
    -- ID originado pela Z-API para rastrear duplicidade e status (Lido, Recebido)
    zapi_message_id TEXT,
    
    -- 'in' (cliente -> loja) ou 'out' (loja -> cliente)
    direcao TEXT NOT NULL CHECK (direcao IN ('in', 'out')),
    
    -- 'text', 'image', 'audio', 'document', 'video'
    tipo TEXT NOT NULL DEFAULT 'text',
    
    -- O texto da mensagem ou URL do anexo
    conteudo TEXT,
    
    -- 'enviando', 'enviado', 'entregue', 'lido', 'erro' (Para mensagens tipo 'out')
    status_envio TEXT DEFAULT 'enviado',
    
    -- Quem enviou (Se foi 'out', loga o usuário)
    criado_por_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_mensagens_atendimento ON public.crm_mensagens(atendimento_id);
CREATE INDEX IF NOT EXISTS idx_crm_mensagens_zapi_id ON public.crm_mensagens(zapi_message_id);
CREATE INDEX IF NOT EXISTS idx_crm_mensagens_created_at ON public.crm_mensagens(created_at);

-- =========================================================================================
-- TRIGGER: Atualiza a 'ultima_mensagem_em' do atendimento ao inserir uma nova mensagem
-- =========================================================================================
CREATE OR REPLACE FUNCTION public.trg_update_atendimento_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.crm_atendimentos
    SET ultima_mensagem_em = NEW.created_at,
        updated_at = now()
    WHERE id = NEW.atendimento_id;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_atendimento_timestamp ON public.crm_mensagens;
CREATE TRIGGER trg_update_atendimento_timestamp
    AFTER INSERT ON public.crm_mensagens
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_update_atendimento_timestamp();

-- =========================================================================================
-- FUNÇÃO RPC ÚTIL (Atribuição segura)
-- =========================================================================================
CREATE OR REPLACE FUNCTION atribuir_atendimento(p_atendimento_id UUID, p_novo_responsavel_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_role TEXT;
    v_ticket RECORD;
BEGIN
    v_user_role := get_current_user_role();
    
    SELECT * INTO v_ticket FROM crm_atendimentos WHERE id = p_atendimento_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Atendimento não encontrado');
    END IF;

    -- Se for atendente tentando pegar um ticket de OUTRO atendente, bloqueia.
    IF v_user_role = 'atendente' THEN
        IF v_ticket.responsavel_id IS NOT NULL AND v_ticket.responsavel_id <> auth.uid() AND p_novo_responsavel_id = auth.uid() THEN
            RETURN jsonb_build_object('status', 'error', 'message', 'Desculpe, este ticket já está com outro atendente.');
        END IF;
    END IF;

    -- Faz a atualização
    UPDATE crm_atendimentos 
    SET responsavel_id = p_novo_responsavel_id, 
        status = CASE 
            WHEN p_novo_responsavel_id IS NOT NULL AND status = 'novo' THEN 'em_andamento'
            WHEN p_novo_responsavel_id IS NULL AND status = 'em_andamento' THEN 'novo'
            ELSE status
        END,
        updated_at = now()
    WHERE id = p_atendimento_id;

    RETURN jsonb_build_object('status', 'success', 'message', 'Atendimento reatribuído com sucesso!');
END;
$$;

GRANT EXECUTE ON FUNCTION atribuir_atendimento TO authenticated;


-- =========================================================================================
-- POLÍTICAS DE SEGURANÇA (RLS)
-- Utiliza "get_current_user_role()" da migration 108.
-- =========================================================================================

ALTER TABLE public.crm_atendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_mensagens ENABLE ROW LEVEL SECURITY;

-- ATENDIMENTOS (Tickets)
CREATE POLICY "Gestores e ADMs veem todos os atendimentos"
    ON public.crm_atendimentos FOR SELECT
    TO authenticated
    USING (get_current_user_role() IN ('adm', 'gestor'));

CREATE POLICY "Atendentes veem tickets não atribuidos ou seus próprios tickets"
    ON public.crm_atendimentos FOR SELECT
    TO authenticated
    USING (
        (get_current_user_role() IN ('atendente', 'logistica'))
        AND 
        (responsavel_id IS NULL OR responsavel_id = auth.uid())
    );

CREATE POLICY "Qualquer autenticado pode INSERIR novos atendimentos"
    ON public.crm_atendimentos FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Qualquer autenticado pode ATUALIZAR atendimentos"
    ON public.crm_atendimentos FOR UPDATE
    TO authenticated
    USING (
        get_current_user_role() IN ('adm', 'gestor') 
        OR 
        (responsavel_id IS NULL OR responsavel_id = auth.uid())
    )
    WITH CHECK (true);

-- MENSAGENS (COM "crm_mensagens.atendimento_id" QUALIFICADO PARA EVITAR ERRO 42703)
CREATE POLICY "Ver mensagens se puder ver o atendimento"
    ON public.crm_mensagens FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.crm_atendimentos a 
            WHERE a.id = crm_mensagens.atendimento_id
        )
    );

CREATE POLICY "Pode inserir mensagens no atendimento acessível"
    ON public.crm_mensagens FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.crm_atendimentos a 
            WHERE a.id = crm_mensagens.atendimento_id
        )
    );

CREATE POLICY "Apenas ADMs podem apagar mensagens (soft/hard delete)"
    ON public.crm_mensagens FOR DELETE
    TO authenticated
    USING (get_current_user_role() = 'adm');

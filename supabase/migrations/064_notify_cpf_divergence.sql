-- ================================================================
-- MIGRATION 064: Detectar Divergência de CPF em Pós-Vendas
-- ================================================================

CREATE OR REPLACE FUNCTION check_cpf_divergence_pv()
RETURNS TRIGGER AS $$
DECLARE
    v_parent_id UUID;
    v_parent_hash TEXT;
    v_parent_cpf TEXT;
BEGIN
    -- Verifica se é Pós Venda (CC)
    IF UPPER(NEW.offer_name) LIKE '%CC%' THEN
        -- Tenta encontrar o pedido "Pai" mais recente para este e-mail
        SELECT id, transaction_hash, REGEXP_REPLACE(customer_cpf, '[^0-9]', '', 'g')
        INTO v_parent_id, v_parent_hash, v_parent_cpf
        FROM ticto_pedidos
        WHERE LOWER(customer_email) = LOWER(NEW.customer_email)
          AND order_date < NEW.order_date
          -- Não queremos comparar o Pós-Venda com ele mesmo ou com outros Pós-Vendas
          AND UPPER(COALESCE(offer_name, '')) NOT LIKE '%CC%'
          AND UPPER(COALESCE(offer_name, '')) NOT LIKE '%ORDERBUMP%'
          AND UPPER(COALESCE(offer_name, '')) NOT LIKE '%UPSELL%'
        ORDER BY order_date DESC
        LIMIT 1;

        -- Se encontrou um pedido Pai, verifica se o CPF é diferente
        IF v_parent_id IS NOT NULL THEN
            IF v_parent_cpf IS DISTINCT FROM REGEXP_REPLACE(NEW.customer_cpf, '[^0-9]', '', 'g') THEN
                -- Insere uma notificação alertando a equipe
                INSERT INTO notificacoes (tipo, mensagem, dados)
                VALUES (
                    'divergencia_cpf', 
                    'Atenção: Pós Venda (CC) com CPF diferente do Pedido Principal para o e-mail ' || NEW.customer_email || '. Requer análise manual para unificação.',
                    jsonb_build_object(
                        'pai_id', v_parent_id, 
                        'pai_hash', v_parent_hash,
                        'pai_cpf', v_parent_cpf,
                        'pv_id', NEW.id,
                        'pv_hash', NEW.transaction_hash,
                        'pv_cpf', NEW.customer_cpf,
                        'email', NEW.customer_email
                    )
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_cpf_divergence_pv ON ticto_pedidos;
CREATE TRIGGER trg_check_cpf_divergence_pv
    AFTER INSERT ON ticto_pedidos
    FOR EACH ROW
    EXECUTE FUNCTION check_cpf_divergence_pv();

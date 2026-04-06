-- ================================================================
-- MIGRATION 045: Corrigir chave de deduplicação na ticto_pedidos
-- Data: 2026-02-20
-- Problema: A Ticto envia o mesmo transaction_hash para o pedido
--   principal e seu Order Bump (mesma transação de pagamento).
--   O UNIQUE(transaction_hash) faz o OB sobrescrever o pai (ou vice-versa).
-- Solução: Usar chave composta (transaction_hash, offer_code) para
--   permitir que pai e OB coexistam como registros separados.
-- ================================================================

-- 1. Remover a constraint UNIQUE atual em transaction_hash
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Encontrar o nome da constraint (pode ser index ou constraint)
    SELECT c.conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'ticto_pedidos'
      AND c.contype = 'u'  -- unique constraint
      AND EXISTS (
          SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = t.oid
            AND a.attnum = ANY(c.conkey)
            AND a.attname = 'transaction_hash'
      );

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE ticto_pedidos DROP CONSTRAINT %I', constraint_name);
        RAISE NOTICE 'Removida constraint: %', constraint_name;
    ELSE
        -- Pode ser um índice UNIQUE ao invés de constraint
        PERFORM 1 FROM pg_indexes
        WHERE tablename = 'ticto_pedidos'
          AND indexdef LIKE '%UNIQUE%transaction_hash%'
          AND indexdef NOT LIKE '%offer_code%';

        IF FOUND THEN
            -- Buscar e dropar o índice
            FOR constraint_name IN
                SELECT indexname FROM pg_indexes
                WHERE tablename = 'ticto_pedidos'
                  AND indexdef LIKE '%UNIQUE%transaction_hash%'
                  AND indexdef NOT LIKE '%offer_code%'
            LOOP
                EXECUTE format('DROP INDEX IF EXISTS %I', constraint_name);
                RAISE NOTICE 'Removido índice: %', constraint_name;
            END LOOP;
        END IF;
    END IF;
END $$;

-- 2. Criar nova constraint UNIQUE composta
ALTER TABLE ticto_pedidos
    ADD CONSTRAINT ticto_pedidos_tx_hash_offer_unique
    UNIQUE (transaction_hash, offer_code);

-- 3. Criar índice para buscas por transaction_hash sozinho (performance)
CREATE INDEX IF NOT EXISTS idx_ticto_pedidos_tx_hash
    ON ticto_pedidos(transaction_hash);

-- 4. Recarregar schema cache
NOTIFY pgrst, 'reload schema';

-- 5. Verificação
SELECT
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'ticto_pedidos'::regclass
  AND contype = 'u'
ORDER BY conname;

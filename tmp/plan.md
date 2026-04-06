# Fixing Label Error Visibility

1. The issue is that the error and its AI suggestion are not being displayed in the `Logistics` table.
2. The reason is that `labelGenerationService.ts` tries to update `observacao` AND `tentativas_geracao`.
3. The column `tentativas_geracao` was forgot to be added to the production database schema.
4. Because the `update` query fails on the non-existent column, the `observacao` never gets saved to Supabase.
5. The `Logistics.tsx` UI never receives the `observacao` string to show the `MessageCircle` with the error.
6. The exact same issue affects Meilleur Envio.

## Fix
- Create a migration to add `tentativas_geracao` to `pedidos_consolidados_v3` with default 0.
- Execute the migration on the production database.

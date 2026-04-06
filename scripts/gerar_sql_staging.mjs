import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');
const OUTPUT_FILE = join(ROOT, 'replicacao_staging_completa.sql');

function main() {
    console.log("Lendo migrations...");
    const files = readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort((a, b) => {
            const numA = parseInt(a.split('_')[0], 10);
            const numB = parseInt(b.split('_')[0], 10);
            return numA - numB;
        });

    let combinedSql = `-- ==========================================\n`;
    combinedSql += `-- SETUP DO AMBIENTE DE TESTES (STAGING)\n`;
    combinedSql += `-- Gerado automaticamente com todas as migrations\n`;
    combinedSql += `-- Data: ${new Date().toISOString()}\n`;
    combinedSql += `-- ==========================================\n\n`;

    // Optionally drop tables if we want a clean slate?
    // Not needed, the user is likely running it on a newly created empty DB or can wipe it manually.

    for (const file of files) {
        combinedSql += `-- ==========================================\n`;
        combinedSql += `-- MIGRATION: ${file}\n`;
        combinedSql += `-- ==========================================\n\n`;

        const content = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
        combinedSql += content + '\n\n';
    }

    writeFileSync(OUTPUT_FILE, combinedSql, 'utf8');
    console.log(`✅ Arquivo único gerado com sucesso: ${OUTPUT_FILE}`);
}

main();

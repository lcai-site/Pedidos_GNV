/**
 * Deploy Edge Function para Staging ou Produção via Supabase Management API.
 * 
 * Uso:
 *   node scripts/deploy-function.mjs staging webhook-ticto
 *   node scripts/deploy-function.mjs production webhook-ticto
 *   node scripts/deploy-function.mjs staging --all
 * 
 * Nota: A pasta local pode ter nome diferente do slug deployado.
 *       Ex: pasta "webhook-ticto" → slug "quick-action"
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { getEnv } from './environments.mjs';

// Mapeamento: nome da pasta local → slug deployado no Supabase
// Nota: staging e produção podem ter slugs diferentes
const FUNCTION_SLUG_MAP = {
    'webhook-ticto': {
        staging: 'hyper-function',
        production: 'quick-action',
    },
    'webhook-viralmart': {
        staging: 'webhook-viralmart',
        production: 'webhook-viralmart',
    },
    'webhook-melhor-envio': {
        staging: 'webhook-melhor-envio',
        production: 'webhook-melhor-envio',
    },
    'zapi-proxy': {
        staging: 'zapi-proxy',
        production: 'zapi-proxy',
    },
};

const envName = process.argv[2];
const target = process.argv[3];

if (!envName || !target) {
    console.log('Uso: node scripts/deploy-function.mjs <staging|production> <nome-da-pasta|--all>');
    console.log('  Exemplos:');
    console.log('    node scripts/deploy-function.mjs staging webhook-ticto');
    console.log('    node scripts/deploy-function.mjs production --all');
    process.exit(1);
}

const env = getEnv(envName);

if (envName === 'production') {
    console.log('\n⚠️  ATENÇÃO: Você está deployando em PRODUÇÃO!');
    console.log('   Certifique-se de que esta função já foi testada no staging.');
    console.log('   Pressione Ctrl+C para cancelar ou aguarde 3 segundos...\n');
    await new Promise(r => setTimeout(r, 3000));
}

async function deployFunction(folderName) {
    const slugMap = FUNCTION_SLUG_MAP[folderName];
    const slug = slugMap ? (slugMap[envName] || folderName) : folderName;
    const indexPath = `supabase/functions/${folderName}/index.ts`;

    if (!existsSync(indexPath)) {
        console.log(`   ❌ Arquivo não encontrado: ${indexPath}`);
        return false;
    }

    const code = readFileSync(indexPath, 'utf-8');
    console.log(`\n📦 Deployando: ${folderName} → slug "${slug}" em ${env.name}`);
    console.log(`   ${code.split('\n').length} linhas de código`);

    // Supabase Management API para deploy de Edge Function
    const apiUrl = `https://api.supabase.com/v1/projects/${env.projectRef}/functions/${slug}`;

    // Tentar atualizar (PATCH)
    let response = await fetch(apiUrl, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN || ''}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            body: code,
            verify_jwt: false,
        }),
    });

    // Se 404, criar nova (POST)
    if (response.status === 404) {
        console.log('   Função não existe, criando...');
        response = await fetch(`https://api.supabase.com/v1/projects/${env.projectRef}/functions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN || ''}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                slug,
                name: slug,
                body: code,
                verify_jwt: false,
            }),
        });
    }

    if (response.ok) {
        console.log(`   ✅ Deploy OK → ${env.supabaseUrl}/functions/v1/${slug}`);
        return true;
    }

    const errorBody = await response.text();

    // Se a Management API não está acessível (sem token), dar instruções manuais
    if (response.status === 401 || response.status === 403) {
        console.log('   ⚠️  Token de acesso não configurado.');
        console.log('   📋 Para deploy manual via Dashboard:');
        console.log(`      1. Abra: ${env.supabaseUrl.replace('.co', '.co')}/project/${env.projectRef}/functions`);
        console.log(`      2. Abra a função "${slug}" (ou crie uma nova com esse nome)`);
        console.log(`      3. Cole o conteúdo de: ${indexPath}`);
        console.log(`      4. Desmarque "Verify JWT" e clique "Deploy"`);
        return false;
    }

    console.log(`   ❌ Erro ${response.status}: ${errorBody.slice(0, 200)}`);
    return false;
}

async function main() {
    console.log(`🚀 Deploy de Edge Function → ${env.name}`);
    console.log(`   URL: ${env.supabaseUrl}\n`);

    if (target === '--all') {
        const functionsDir = 'supabase/functions';
        const folders = readdirSync(functionsDir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);

        console.log(`📁 Encontradas ${folders.length} funções: ${folders.join(', ')}`);

        let deployed = 0;
        let failed = 0;

        for (const folder of folders) {
            const ok = await deployFunction(folder);
            if (ok) deployed++;
            else failed++;
        }

        console.log(`\n📋 Resultado: ${deployed} deployadas, ${failed} falharam`);
    } else {
        await deployFunction(target);
    }
}

main().catch(err => {
    console.error('💥 Erro fatal:', err.message);
    process.exit(1);
});

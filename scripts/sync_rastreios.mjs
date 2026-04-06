/**
 * Script de Sincronização de Rastreios - Melhor Envio
 * 
 * USO: Quando a Edge Function estiver com erro 403
 * Executa a sincronização via Node.js localmente
 * 
 * PRÉ-REQUISITOS:
 * 1. Instalar dependências: npm install @supabase/supabase-js dotenv
 * 2. Configurar .env.local com as variáveis abaixo
 * 
 * EXECUTAR: node scripts/sync_rastreios.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Carregar variáveis de ambiente
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');

console.log('📄 Carregando variáveis de ambiente de:', envPath);

try {
  const envConfig = dotenv.parse(readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
} catch (error) {
  console.warn('⚠️  Arquivo .env.local não encontrado. Usando variáveis do sistema.');
}

// Validar variáveis obrigatórias
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const MELHOR_ENVIO_TOKEN = process.env.VITE_MELHOR_ENVIO_TOKEN || process.env.MELHOR_ENVIO_TOKEN;
const USER_AGENT = process.env.VITE_MELHOR_ENVIO_USER_AGENT || 'GnutraVita/1.0 (camila@gnutravita.com.br)';

console.log('🔧 Configurações:');
console.log(`   SUPABASE_URL: ${SUPABASE_URL ? '✓' : '✗'}`);
console.log(`   MELHOR_ENVIO_TOKEN: ${MELHOR_ENVIO_TOKEN ? '✓' : '✗'}`);
console.log(`   USER_AGENT: ${USER_AGENT}`);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ ERRO: Configure SUPABASE_URL e SUPABASE_ANON_KEY no .env.local');
  process.exit(1);
}

if (!MELHOR_ENVIO_TOKEN) {
  console.error('❌ ERRO: Configure MELHOR_ENVIO_TOKEN no .env.local');
  console.error('   Obtenha em: https://www.melhorenvio.com.br/minha-conta/token');
  process.exit(1);
}

// Inicializar cliente Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// IDs específicos para sincronizar (opcional)
const PEDIDOS_IDS = []; // Ex: ['id1', 'id2', 'id3'] ou deixe vazio para todos

async function sincronizarRastreios() {
  console.log('\n🔄 === INICIANDO SINCRONIZAÇÃO DE RASTREIOS ===\n');
  
  try {
    // 1. Buscar pedidos pendentes
    console.log('📦 Buscando pedidos pendentes no banco...');
    
    let query = supabase
      .from('pedidos_consolidados_v3')
      .select('id, codigo_rastreio, tracking_url, nome_cliente, status_envio')
      .eq('logistica_provider', 'Melhor Envio')
      .is('data_postagem', null);
    
    if (PEDIDOS_IDS.length > 0) {
      query = query.in('id', PEDIDOS_IDS);
    } else {
      query = query.in('status_envio', ['Processando', 'Etiquetado', 'Pago', 'Etiqueta Gerada']);
    }
    
    const { data: pedidos, error: dbError } = await query;
    
    if (dbError) {
      console.error('❌ Erro ao buscar pedidos:', dbError);
      return;
    }
    
    if (!pedidos || pedidos.length === 0) {
      console.log('✅ Nenhum pedido pendente para sincronizar.');
      return;
    }
    
    console.log(`📦 ${pedidos.length} pedidos encontrados.`);
    
    // 2. Filtrar apenas os que têm UUID (36 chars)
    const pedidosParaChecar = pedidos.filter(p => 
      p.codigo_rastreio && p.codigo_rastreio.length === 36
    );
    
    if (pedidosParaChecar.length === 0) {
      console.log('✅ Nenhum pedido com UUID pendente (todos já sincronizados?).');
      return;
    }
    
    console.log(`🔍 ${pedidosParaChecar.length} pedidos com UUID para verificar.\n`);
    
    // 3. Chamar API do Melhor Envio
    console.log('🌐 Consultando API do Melhor Envio...');
    console.log(`   Endpoint: https://www.melhorenvio.com.br/api/v2/me/shipment/tracking`);
    
    const cartIds = pedidosParaChecar.map(p => p.codigo_rastreio);
    
    // Dividir em lotes de 100 para evitar timeout
    const LOTE_TAMANHO = 100;
    const lotes = [];
    for (let i = 0; i < cartIds.length; i += LOTE_TAMANHO) {
      lotes.push(cartIds.slice(i, i + LOTE_TAMANHO));
    }
    
    let atualizados = 0;
    let atualizadosUrl = 0;
    let naoEncontrados = 0;
    let erros = 0;
    
    for (let loteIndex = 0; loteIndex < lotes.length; loteIndex++) {
      const lote = lotes[loteIndex];
      console.log(`\n📦 Processando lote ${loteIndex + 1}/${lotes.length} (${lote.length} pedidos)...`);
      
      const response = await fetch('https://www.melhorenvio.com.br/api/v2/me/shipment/tracking', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MELHOR_ENVIO_TOKEN}`,
          'User-Agent': USER_AGENT
        },
        body: JSON.stringify({
          orders: lote
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erro na API do Melhor Envio: ${response.status} - ${errorText}`);
        erros += lote.length;
        continue;
      }
      
      const trackingData = await response.json();
      console.log(`   ✅ Resposta recebida`);
      
      // 4. Processar resultados e atualizar banco
      for (const pedido of pedidosParaChecar.filter(p => lote.includes(p.codigo_rastreio))) {
        const uuid = pedido.codigo_rastreio;
        
        // A API pode retornar como objeto { uuid: data } ou array [{ uuid: data }]
        let info = trackingData[uuid];
        if (!info && Array.isArray(trackingData)) {
          info = trackingData.find(t => t[uuid])?.[uuid];
        }
        
        if (!info) {
          naoEncontrados++;
          console.log(`   ⚠️  ${pedido.id}: Informações não encontradas`);
          continue;
        }
        
        const tracking = info.tracking || info.tracking_number || '';
        const trackingUrl = info.tracking_url || info.tracking_link || '';
        const transportadora = info.carrier?.name || info.carrier_name || '';
        const status = info.status || info.state || '';
        
        // Verificar se tem código de rastreio válido
        if (tracking && tracking !== uuid && tracking.length > 5) {
          const updateData = {
            codigo_rastreio: tracking,
            melhor_envio_id: uuid,
            transportadora: transportadora,
            status_envio: 'Postado',
            data_postagem: info.posted_at || new Date().toISOString(),
            observacao: `Rastreio synchronizado (status: ${status})`
          };
          
          if (trackingUrl) {
            updateData.tracking_url = trackingUrl;
          }
          
          const { error: updateError } = await supabase
            .from('pedidos_consolidados_v3')
            .update(updateData)
            .eq('id', pedido.id);
          
          if (updateError) {
            console.error(`   ❌ Erro ao atualizar pedido ${pedido.id}:`, updateError);
            erros++;
          } else {
            atualizados++;
            console.log(`   ✅ ${pedido.id}: ${uuid} → ${tracking} (${transportadora})`);
          }
          
        } else if (trackingUrl && !pedido.tracking_url) {
          // Salvar apenas URL se não tiver código
          const { error: updateError } = await supabase
            .from('pedidos_consolidados_v3')
            .update({
              tracking_url: trackingUrl,
              transportadora: transportadora,
              observacao: `Aguardando código (status: ${status})`
            })
            .eq('id', pedido.id);
          
          if (!updateError) {
            atualizadosUrl++;
            console.log(`   🔗 ${pedido.id}: URL salva ${trackingUrl}`);
          } else {
            erros++;
          }
        } else {
          naoEncontrados++;
          console.log(`   ⚠️  ${pedido.id}: Sem rastreio disponível (status: ${status})`);
        }
      }
      
      // Aguardar entre lotes para não sobrecarregar API
      if (loteIndex < lotes.length - 1) {
        console.log('   ⏱️  Aguardando 2s antes do próximo lote...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // 5. Resumo final
    console.log('\n🎉 === SINCRONIZAÇÃO CONCLUÍDA ===');
    console.log(`✅ Atualizados com rastreio: ${atualizados}`);
    console.log(`🔗 Atualizados com URL: ${atualizadosUrl}`);
    console.log(`⚠️  Não encontrados: ${naoEncontrados}`);
    console.log(`❌ Erros: ${erros}`);
    console.log('===================================\n');
    
  } catch (error) {
    console.error('\n❌ ERRO CRÍTICO:', error);
    console.error('Detalhes:', error.message);
    console.error('\n💡 Dica: Verifique se o token do Melhor Envio está válido.');
  }
}

// Executar
sincronizarRastreios();

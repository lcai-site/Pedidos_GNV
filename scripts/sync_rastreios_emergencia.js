/**
 * Script de Emergência para Sincronização de Rastreios
 * 
 * USO: Quando a Edge Function estiver com erro 403
 * Executa a sincronização diretamente pelo frontend
 * 
 * COMO USAR:
 * 1. Abra o console do navegador (F12) na página de Logística
 * 2. Copie e cole este script inteiro
 * 3. Execute e aguarde a sincronização
 */

(async function sincronizarRastreiosEmergencia() {
  console.log('🔄 === INICIANDO SINCRONIZAÇÃO DE EMERGÊNCIA ===');
  
  const PEDIDOS_SELECIONADOS = []; // Coloque IDs específicos aqui ou deixe vazio para pegar todos
  
  try {
    // 1. Buscar pedidos pendentes
    console.log('📦 Buscando pedidos pendentes...');
    
    let query = supabase
      .from('pedidos_consolidados_v3')
      .select('id, codigo_rastreio, tracking_url, nome_cliente')
      .eq('logistica_provider', 'Melhor Envio')
      .is('data_postagem', null);
    
    if (PEDIDOS_SELECIONADOS.length > 0) {
      query = query.in('id', PEDIDOS_SELECIONADOS);
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
    
    console.log(`📦 ${pedidos.length} pedidos encontrados para sincronizar.`);
    
    // 2. Filtrar apenas os que têm UUID (36 chars)
    const pedidosParaChecar = pedidos.filter(p => 
      p.codigo_rastreio && p.codigo_rastreio.length === 36
    );
    
    if (pedidosParaChecar.length === 0) {
      console.log('✅ Nenhum pedido com UUID pendente.');
      return;
    }
    
    console.log(`🔍 ${pedidosParaChecar.length} pedidos com UUID para verificar.`);
    
    // 3. Chamar API do Melhor Envio
    console.log('🌐 Consultando API do Melhor Envio...');
    
    // O script pega o token direto do ambiente se possível, ou usa o fornecido
    const MELHOR_ENVIO_TOKEN = 'SEU_TOKEN_REAL_AQUI'; // Ou pegue de import.meta.env.VITE_MELHOR_ENVIO_TOKEN
    const USER_AGENT = 'GnutraVita/1.0 (camila@gnutravita.com.br)';
    
    const cartIds = pedidosParaChecar.map(p => p.codigo_rastreio);
    
    const response = await fetch('https://www.melhorenvio.com.br/api/v2/me/shipment/tracking', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MELHOR_ENVIO_TOKEN}` // No navegador, substitua 'token' pelo seu token real
      },
      body: JSON.stringify({
        orders: cartIds
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro na API do Melhor Envio: ${response.status} - ${errorText}`);
      return;
    }
    
    const trackingData = await response.json();
    console.log('📡 Resposta da API:', trackingData);
    
    // 4. Processar resultados e atualizar banco
    let atualizados = 0;
    let aguardandoGeracao = 0;
    let naoEncontrados = 0;
    
    console.log('🔄 Atualizando banco de dados...');
    
    for (const pedido of pedidosParaChecar) {
      const uuid = pedido.codigo_rastreio;
      const info = trackingData[uuid];
      
      if (!info) {
        naoEncontrados++;
        console.log(`⚠️ Pedido ${pedido.nome_cliente}: Não encontrado no ME (404/Removido)`);
        continue;
      }
      
      const tracking = info.tracking || '';
      const status = info.status || '';
      
      // Caso 1: Já postado e tem código real
      if (tracking && tracking !== uuid && tracking.length > 5) {
        const { error: updateError } = await supabase
          .from('pedidos_consolidados_v3')
          .update({
            codigo_rastreio: tracking,
            melhor_envio_id: uuid,
            status_envio: 'Postado',
            data_postagem: info.posted_at || new Date().toISOString(),
            observacao: `Sincronizado via script (status: ${status})`
          })
          .eq('id', pedido.id);
        
        if (!updateError) {
          atualizados++;
          console.log(`✅ ${pedido.nome_cliente}: ID trocado por ${tracking}`);
        }
      } 
      // Caso 2: Pago mas aguardando geração da etiqueta no painel ME
      else if (status === 'released' || status === 'paid') {
        await supabase
          .from('pedidos_consolidados_v3')
          .update({ 
            status_envio: 'Pago',
            observacao: 'Pago no ME. Acesse o painel Melhor Envio e clique em GERAR ETIQUETA.' 
          })
          .eq('id', pedido.id);
        
        aguardandoGeracao++;
        console.log(`⏳ ${pedido.nome_cliente}: Aguardando geração da etiqueta no ME (Status: ${status})`);
      }
      else {
        naoEncontrados++;
        console.log(`⚠️ ${pedido.nome_cliente}: No Melhor Envio o status é "${status}".`);
      }
    }
    
    // 5. Resumo final
    console.log('\n🎉 === SINCRONIZAÇÃO CONCLUÍDA ===');
    console.log(`✅ IDs Trocados por Rastreio: ${atualizados}`);
    console.log(`⏳ Aguardando Geração (Pagos): ${aguardandoGeracao}`);
    console.log(`⚠️ Não Processados: ${naoEncontrados}`);
    console.log('===================================\n');
    
    // 6. Recarregar página após 2 segundos
    setTimeout(() => {
      console.log('🔄 Recarregando página...');
      window.location.reload();
    }, 2000);
    
  } catch (error) {
    console.error('❌ ERRO CRÍTICO:', error);
    console.error('Detalhes:', error.message);
  }
})();

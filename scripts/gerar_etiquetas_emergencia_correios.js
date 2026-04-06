/**
 * Script de Emergência para Geração de Etiquetas Correios
 * 
 * USO: Quando a Edge Function 'correios-labels' estiver com erro 403
 * ou quando o código de rastreio não for retornado corretamente.
 * 
 * COMO USAR:
 * 1. Abra o painel de Logística no navegador.
 * 2. Abra o Console (F12).
 * 3. Copie e cole este script.
 * 4. Pressione Enter.
 */

(async function gerarEtiquetasCorreiosEmergencia() {
    console.log('📦 === INICIANDO GERAÇÃO DE ETIQUETAS CORREIOS (MODO EMERGÊNCIA) ===');
    
    // IDs dos pedidos que falharam (pode ser trocado por IDs novos reais se precisar)
    // O script vai pegar os IDs que o usuário está vendo na tela agora
    const idsParaProcessar = [
        '5f74f95c-f51b-495e-907c-06cc1b2d47df', // Raquel Aline Tavares Nunes
        '8851958920', // glauciele (CPF exemplo)
        '44550638893', // glauciele
        '12211401678'  // adrielle
    ];

    // O token real do seu .env.production
    const MEUSCORREIOS_TOKEN = 'Dp4GDpoF03LVIkuIWOJ4Tl4prxeCbArIZ/+Tf60D4Ho='; 
    
    // Buscar no banco pelo CPF se necessário
    const { data: pedidosFaltando } = await supabase
        .from('pedidos_consolidados_v3')
        .select('*')
        .in('cpf', ['08851958920', '44550638893', '12211401678']);

    if (!pedidosFaltando || pedidosFaltando.length === 0) {
        console.log('✅ Nenhum pedido pendente com esse CPF encontrado no banco.');
        return;
    }

    console.log(`🔍 ${pedidosFaltando.length} pedidos encontrados para processar.`);

    for (const pedido of pedidosFaltando) {
        try {
            const payload = {
                parmIn: {
                    Token: MEUSCORREIOS_TOKEN,
                    dstxrmtcod: "1",
                    dstxcar: "0079253997",
                    dstnom: pedido.nome_cliente.substring(0, 50),
                    dstend: (pedido.logradouro || '').substring(0, 50),
                    dstendnum: pedido.numero || 'S/N',
                    dstcpl: (pedido.complemento || '').substring(0, 30),
                    dstbai: (pedido.bairro || '').substring(0, 50),
                    dstcid: (pedido.cidade || '').substring(0, 50),
                    dstest: (pedido.estado || 'SP').substring(0, 2),
                    dstxcep: String(pedido.cep).replace(/\D/g, ''),
                    dstxemail: pedido.email || 'vendas@gnutravita.com.br',
                    dstxcel: String(pedido.telefone).replace(/\D/g, '').substring(0, 11),
                    dstxnfi: "00100005555", // Restaurado: Valor que funcionava no teste
                    impetq: "B2W",           // Restaurado: Formato que funcionava no teste
                    servicos: [ { servico: "Mini Envios" } ], // Testando Mini Envios
                    objetos: [ { dstxItem: 1, dstxobs: pedido.descricao_pacote || 'Suplemento', dstxvd: 1.00 } ],
                    det: [ 
                        { detParm: "PLATAFORMA", detParmVal: "RESTAURACAO_EMERGENCIA" },
                        { detParm: "ORDERID", detParmVal: pedido.id }
                    ]
                }
            };

            const response = await fetch('https://meuscorreios.app/rest/apimccriprepos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                console.error(`❌ Erro HTTP ${response.status}`);
                continue;
            }

            const resData = await response.json();
            const item = resData?.parmOut?.prepos?.[0];

            if (resData?.parmOut?.erro || item?.erroItem) {
                const erroMsg = resData?.parmOut?.erro || item?.erroItem;
                console.error(`❌ ERRO NO CORREIOS: ${erroMsg}`);
                await supabase.from('pedidos_consolidados_v3').update({ observacao: `Erro Correios: ${erroMsg}` }).eq('id', pedido.id);
                continue;
            }

            // Seleção flexível de campos para capturar o código de rastreio
            const tracking = item?.dstxetq || item?.codectcod || item?.etqCodigo || item?.numEtiqueta;
            const pdf = item?.etqSRO || item?.etqPDF || '';

            if (tracking) {
                console.log(`✅ Sucesso! Rastreio: ${tracking}`);
                await supabase.from('pedidos_consolidados_v3')
                    .update({
                        codigo_rastreio: tracking,
                        status_envio: 'Label Gerada',
                        logistica_etiqueta_url: pdf,
                        logistica_provider: 'Correios Nativo',
                        observacao: 'Gerado via script emergência'
                    })
                    .eq('id', pedido.id);
            } else {
                console.error('⚠️ Resposta sem código de rastreio. Campos:', Object.keys(item || {}));
            }

        } catch (err) {
            console.error(`💥 Erro fatal no pedido ${pedido.id}:`, err);
        }
    }

    console.log('\n✅ === FIM DO PROCESSAMENTO ===');
    console.log('Recarregue a página para ver as Etiquetas Geradas em "Prontos".');
})();

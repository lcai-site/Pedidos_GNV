import fetch from 'node-fetch';

const URL = "https://cgyxinpejaoadsqrxbhy.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA";

const BUMP_HASHES = [
  "TPC5608C1303VS698HHM",
  "TPC695301303NGQ32TA2",
  "TPC5B0B91303UA848QZC",
  "TPC3A52213034NY66KIR",
  "TPC43AAE1303PGP27YMV",
  "TPC270E11403XYJ28HHO",
  "TPPC1911403IOZ70YI0",
  "TPPE1EE1403YSA18B5X",
  "TPC479591403PPX71FTE"
];

async function checkBumps() {
    console.log(`--- Procurando Consolidados para Bumps Específicos ---`);
    
    for (const hash of BUMP_HASHES) {
        // Procurar o consolidado que contém esse hash no array codigos_agrupados
        const resp = await fetch(`${URL}/rest/v1/pedidos_consolidados_v3?codigos_agrupados=cs.{${hash}}&select=codigo_transacao,codigos_agrupados,order_bumps,descricao_pacote`, {
            headers: {
                "apikey": ANON_KEY,
                "Authorization": `Bearer ${ANON_KEY}`
            }
        });
        const found = await resp.json();
        
        if (found && found.length > 0) {
            console.log(`\nBump ${hash} encontrado no Consolidado ${found[0].codigo_transacao}:`);
            console.log(`  - Bumps no Array: ${JSON.stringify(found[0].order_bumps)}`);
            console.log(`  - Descrição: "${found[0].descricao_pacote}"`);
        } else {
            console.log(`\nBump ${hash} NÃO ENCONTRADO em nenhum consolidado.`);
        }
    }
}

checkBumps();

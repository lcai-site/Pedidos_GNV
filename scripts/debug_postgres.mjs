import { createClient } from '@supabase/supabase-js';
import { getEnv } from './environments.mjs';

const env = getEnv('production');
const supabase = createClient(env.supabaseUrl, env.serviceKey);

async function mockSQL() {   
    const { data } = await supabase.from('ticto_pedidos')
        .select('*')
        .ilike('customer_email', '%jessicacarolinajagasdasilva@gmail.com%')
        .order('order_date', { ascending: true });
        
    let _processed = new Set();
    
    // LINHAS ADICIONADAS DO 0. PRE-FETCH
    const pre_fetch = data.filter(p_filho => {
        return data.some(pv => pv.transaction_hash === p_filho.transaction_hash && 
                               pv.offer_name.toUpperCase().includes('CC') && 
                               p_filho.id !== pv.id && 
                               !p_filho.offer_name.toUpperCase().includes('CC'));
    });
    
    pre_fetch.forEach(pf => {
        _processed.add(pf.id);
        console.log("0. PRE-FED:", pf.offer_name);
    });

    const pai = data[0]; // Compre 8...
    _processed.add(pai.id);
    
    let v_order_bumps = [];
    let v_codigos_filhos = [pai.transaction_hash];

    const posVendas = data.filter(p => ! _processed.has(p.id) && p.offer_name.toUpperCase().includes('CC'));
    for(const rec of posVendas) {
        _processed.add(rec.id);
        console.log("1. Add CC as child code: ", rec.transaction_hash);
        if (!v_codigos_filhos.includes(rec.transaction_hash)) {
            v_codigos_filhos.push(rec.transaction_hash);
        }
    }
    
    // GLOBAL 
    for(const hash of v_codigos_filhos) {
        // E aqui o pulo do gato? _processed TEM O ID PRE-FED. Logo ele ignora o filho na fase GLOBAL tbm!
        const orfaos = data.filter(o => o.transaction_hash === hash && o.id !== pai.id && ! _processed.has(o.id));
        for(const orfao of orfaos) {
            console.log("2. Orfao add:", orfao.offer_name);
            v_order_bumps.push(orfao.offer_name);
            _processed.add(orfao.id); // <--- Essa seria a query
        }
    }
    
    console.log("FINAL OB ARRAY:", v_order_bumps);
}

mockSQL();

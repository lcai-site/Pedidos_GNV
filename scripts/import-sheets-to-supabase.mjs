/**
 * Script para importar dados do Google Sheets (exportado como CSV) para a tabela pedidos
 * 
 * Uso:
 * 1. Exporte o Google Sheets como CSV (Arquivo > Fazer download > CSV)
 * 2. Salve o arquivo na pasta scripts/ como "pedidos_historicos.csv"
 * 3. Execute: node scripts/import-sheets-to-supabase.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

// ============================================
// CONFIGURAÇÃO
// ============================================

const PRODUCAO = {
    url: 'https://cgyxinpejaoadsqrxbhy.supabase.co',
    key: process.env.SUPABASE_PROD_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAwMjkzOCwiZXhwIjoyMDgzNTc4OTM4fQ.efSSvLn_WaZi-J9PUXmX3qLlVtgTskkzDNTLp4hKjcc'
};

// Caminho do arquivo CSV
const CSV_PATH = './scripts/pedidos_historicos.csv';

// ============================================
// MAPEAMENTO DE COLUNAS (Sheets -> Supabase)
// ============================================

const COLUMN_MAP = {
    'Código da Transação': 'codigo_transacao',
    'Status': 'status',
    'Nome do Produto': 'nome_produto',
    'Nome da Oferta': 'nome_oferta',
    'Valor Pago': 'valor_total',
    'Método de Pagamento': 'forma_pagamento',
    'Quantidade de Parcelas': 'parcelas',
    'Nome do Cliente': 'nome_cliente',
    'E-mail do Cliente': 'email_cliente',
    'Documento do Cliente': 'cpf_cliente',
    'Telefone Completo do Cliente': 'telefone_cliente',
    'CEP': 'cep',
    'Rua': 'rua',
    'Número': 'numero',
    'Complemento': 'complemento',
    'Bairro': 'bairro',
    'Cidade': 'cidade',
    'Estado': 'estado',
    'Data do Pedido': 'data_venda',
    'Código de Rastreio': 'codigo_rastreio',
    // Colunas extras que podem ser úteis para metadata
    'Número do Pedido': '_numero_pedido',
    'Código do Pedido': '_codigo_pedido',
    'Id do Produto': '_id_produto',
    'Código da Oferta': '_codigo_oferta',
    'Motivo de Recusa': '_motivo_recusa',
    'Data da Transação': '_data_transacao',
    'Data do Status': '_data_status',
    'Bandeira do Cartão': '_bandeira_cartao',
    'Valor do Pedido': '_valor_pedido',
    'Valor do Item': '_valor_item',
    'Valor do Frete': '_valor_frete',
    'Taxa de Processamento': '_taxa_processamento',
    'Transportadora': '_transportadora',
    'País': '_pais',
    'PV_Realizado?': '_pv_realizado'
};

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function cleanCPF(cpf) {
    if (!cpf) return null;
    return String(cpf).replace(/[^0-9]/g, '');
}

function cleanPhone(phone) {
    if (!phone || phone === 'Não informado') return null;
    return String(phone).replace(/[^0-9]/g, '');
}

function mapStatus(status) {
    if (!status) return 'Pendente';
    const s = status.toLowerCase().trim();

    if (s.includes('aprovad') || s.includes('pago') || s.includes('completed')) return 'Aprovado';
    if (s.includes('recusad') || s.includes('refused') || s.includes('denied')) return 'Recusado';
    if (s.includes('pending') || s.includes('aguardando')) return 'Pendente';
    if (s.includes('expir')) return 'Expirado';
    if (s.includes('reembols') || s.includes('refund')) return 'Reembolsado';

    return status; // Mantém o status original se não reconhecer
}

function parseDate(dateStr) {
    if (!dateStr) return null;

    // Tentar formato DD/MM/YYYY HH:mm:ss
    const brMatch = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2})?:?(\d{2})?:?(\d{2})?/);
    if (brMatch) {
        const [, day, month, year, hour = '00', min = '00', sec = '00'] = brMatch;
        return `${year}-${month}-${day}T${hour}:${min}:${sec}-03:00`;
    }

    // Tentar ISO format
    if (dateStr.includes('T') || dateStr.includes('-')) {
        return dateStr;
    }

    return dateStr;
}

function parseNumber(value) {
    if (!value) return null;
    // Remove R$, pontos de milhar, substitui vírgula por ponto
    const cleaned = String(value)
        .replace(/R\$/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
        .trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

function transformRow(row) {
    const mapped = {};
    const metadata = {};

    for (const [sheetsCol, supabaseCol] of Object.entries(COLUMN_MAP)) {
        const value = row[sheetsCol];

        if (!value || value === '') continue;

        // Colunas que vão para metadata (começam com _)
        if (supabaseCol.startsWith('_')) {
            metadata[supabaseCol.substring(1)] = value;
            continue;
        }

        // Transformações específicas
        switch (supabaseCol) {
            case 'cpf_cliente':
                mapped[supabaseCol] = cleanCPF(value);
                break;
            case 'telefone_cliente':
                mapped[supabaseCol] = cleanPhone(value);
                break;
            case 'status':
                mapped[supabaseCol] = mapStatus(value);
                break;
            case 'data_venda':
                mapped[supabaseCol] = parseDate(value);
                break;
            case 'valor_total':
            case 'parcelas':
                mapped[supabaseCol] = parseNumber(value);
                break;
            default:
                mapped[supabaseCol] = value;
        }
    }

    // Adiciona metadata se houver
    if (Object.keys(metadata).length > 0) {
        mapped.metadata = metadata;
    }

    return mapped;
}

// ============================================
// FUNÇÃO PRINCIPAL
// ============================================

async function main() {
    console.log('📊 Importador de Planilha para Supabase');
    console.log('========================================\n');

    // Ler CSV
    console.log('📂 Lendo arquivo CSV...');
    let csvContent;
    try {
        csvContent = readFileSync(CSV_PATH, 'utf-8');
    } catch (error) {
        console.error(`❌ Erro ao ler arquivo: ${CSV_PATH}`);
        console.error('   Certifique-se de que o arquivo existe.');
        console.error('   Exporte o Google Sheets como CSV e salve como "pedidos_historicos.csv" na pasta scripts/');
        process.exit(1);
    }

    // Parsear CSV
    console.log('🔄 Parseando CSV...');
    const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true
    });

    console.log(`   Encontradas ${records.length} linhas\n`);

    // Conectar ao Supabase
    console.log('🔗 Conectando ao Supabase...');
    const supabase = createClient(PRODUCAO.url, PRODUCAO.key);

    // Transformar e inserir
    console.log('🔄 Transformando dados...\n');

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    // Processar em lotes de 100
    const BATCH_SIZE = 100;
    const batches = [];

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        batches.push(records.slice(i, i + BATCH_SIZE));
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const transformedBatch = [];

        for (const row of batch) {
            const transformed = transformRow(row);

            // Validar dados mínimos
            if (!transformed.codigo_transacao && !transformed.email_cliente) {
                skipped++;
                continue;
            }

            // Gerar codigo_transacao se não existir
            if (!transformed.codigo_transacao) {
                transformed.codigo_transacao = `SHEETS-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            }

            transformedBatch.push(transformed);
        }

        if (transformedBatch.length === 0) continue;

        // DEDUPLICAR: Manter apenas o último registro de cada codigo_transacao no lote
        const dedupedBatch = [];
        const seenCodes = new Set();
        for (let i = transformedBatch.length - 1; i >= 0; i--) {
            const code = transformedBatch[i].codigo_transacao;
            if (!seenCodes.has(code)) {
                seenCodes.add(code);
                dedupedBatch.unshift(transformedBatch[i]);
            }
        }

        if (dedupedBatch.length === 0) continue;

        // Inserir lote (UPSERT)
        const { data, error } = await supabase
            .from('pedidos')
            .upsert(dedupedBatch, {
                onConflict: 'codigo_transacao',
                ignoreDuplicates: false
            });

        if (error) {
            console.error(`❌ Erro no lote ${batchIndex + 1}:`, error.message);
            errors += dedupedBatch.length;
        } else {
            inserted += dedupedBatch.length;
        }

        // Progress
        const progress = Math.round(((batchIndex + 1) / batches.length) * 100);
        process.stdout.write(`\r   Progresso: ${progress}% (${inserted} inseridos, ${skipped} ignorados, ${errors} erros)`);
    }

    console.log('\n\n========================================');
    console.log('📊 RESUMO DA IMPORTAÇÃO');
    console.log('========================================');
    console.log(`   Total de linhas no CSV: ${records.length}`);
    console.log(`   ✅ Inseridos/Atualizados: ${inserted}`);
    console.log(`   ⏭️ Ignorados (sem dados): ${skipped}`);
    console.log(`   ❌ Erros: ${errors}`);

    // Verificação final
    const { count } = await supabase.from('pedidos').select('*', { count: 'exact', head: true });
    console.log(`\n   📦 Total de pedidos na tabela: ${count}`);
}

main().catch(console.error);

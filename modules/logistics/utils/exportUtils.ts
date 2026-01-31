import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export interface ExportOrder {
    data_pedido: string;
    codigo_transacao: string;
    pacote: string;
    cliente: string;
    cpf: string;
    telefone: string;
    email: string;
    endereco: string;
    cidade: string;
    estado: string;
    cep: string;
    liberado_em: string;
    rastreio: string;
    status: string;
    dia_despacho: string;
}

/**
 * Formata data para DD/MM/YYYY HH:mm
 */
function formatDate(date: string | Date | null): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Formata data para DD/MM/YYYY
 */
function formatDateOnly(date: string | Date | null): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    return `${day}/${month}/${year}`;
}

/**
 * Prepara dados para exportação
 */
export function prepareExportData(orders: any[]): ExportOrder[] {
    return orders.map(order => ({
        data_pedido: formatDate(order.data_venda),
        codigo_transacao: order.codigo_transacao || '',
        pacote: order.descricao_pacote || order.nome_produto || '',
        cliente: order.nome_cliente || '',
        cpf: order.cpf || order.cpf_cliente || '',
        telefone: order.telefone || order.telefone_cliente || '',
        email: order.email || order.email_cliente || '',
        endereco: order.endereco_completo || '',
        cidade: order.cidade || '',
        estado: order.estado || '',
        cep: order.cep || '',
        liberado_em: formatDate(order.created_at),
        rastreio: order.codigo_rastreio || '',
        status: order.status_aprovacao || order.status || '',
        dia_despacho: formatDateOnly(order.dia_despacho)
    }));
}

/**
 * Exporta dados para Excel (.xlsx)
 */
export function exportToExcel(orders: any[], filename?: string): void {
    if (!orders || orders.length === 0) {
        alert('Nenhum pedido para exportar');
        return;
    }

    const data = prepareExportData(orders);

    // Criar worksheet
    const ws = XLSX.utils.json_to_sheet(data, {
        header: [
            'data_pedido',
            'codigo_transacao',
            'pacote',
            'cliente',
            'cpf',
            'telefone',
            'email',
            'endereco',
            'cidade',
            'estado',
            'cep',
            'liberado_em',
            'rastreio',
            'status',
            'dia_despacho'
        ]
    });

    // Definir larguras das colunas
    ws['!cols'] = [
        { wch: 18 }, // data_pedido
        { wch: 20 }, // codigo_transacao
        { wch: 30 }, // pacote
        { wch: 30 }, // cliente
        { wch: 15 }, // cpf
        { wch: 15 }, // telefone
        { wch: 30 }, // email
        { wch: 50 }, // endereco
        { wch: 20 }, // cidade
        { wch: 5 },  // estado
        { wch: 10 }, // cep
        { wch: 18 }, // liberado_em
        { wch: 20 }, // rastreio
        { wch: 12 }, // status
        { wch: 12 }  // dia_despacho
    ];

    // Renomear headers para português
    const headers = {
        'A1': 'Data do Pedido',
        'B1': 'Código Transação',
        'C1': 'Pacote/Produtos',
        'D1': 'Cliente',
        'E1': 'CPF',
        'F1': 'Telefone',
        'G1': 'Email',
        'H1': 'Endereço Completo',
        'I1': 'Cidade',
        'J1': 'Estado',
        'K1': 'CEP',
        'L1': 'Liberado Em',
        'M1': 'Rastreio',
        'N1': 'Status',
        'O1': 'Dia Despacho'
    };

    Object.entries(headers).forEach(([cell, value]) => {
        if (ws[cell]) {
            ws[cell].v = value;
        }
    });

    // Criar workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Logística');

    // Gerar arquivo
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const defaultFilename = `Logistica_${timestamp}.xlsx`;

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, filename || defaultFilename);
}

/**
 * Exporta dados para CSV
 */
export function exportToCSV(orders: any[], filename?: string): void {
    if (!orders || orders.length === 0) {
        alert('Nenhum pedido para exportar');
        return;
    }

    const data = prepareExportData(orders);

    // Criar worksheet
    const ws = XLSX.utils.json_to_sheet(data);

    // Converter para CSV
    const csv = XLSX.utils.sheet_to_csv(ws);

    // Gerar arquivo
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const defaultFilename = `Logistica_${timestamp}.csv`;

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, filename || defaultFilename);
}

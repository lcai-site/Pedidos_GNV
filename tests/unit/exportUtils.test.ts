import { describe, it, expect } from 'vitest';
import { exportToCSV, prepareExportData } from '../../modules/logistics/utils/exportUtils';

describe('exportUtils', () => {
    const mockOrders = [
        {
            id: '1',
            created_at: '2026-01-29T10:00:00.000Z',
            descricao_pacote: 'DP-001',
            nome_cliente: 'João Silva',
            cpf: '123.456.789-00',
            email: 'joao@email.com',
            telefone: '11999999999',
            cep: '01234-567',
            logradouro: 'Rua Teste',
            numero: '100',
            complemento: 'Apto 1',
            bairro: 'Centro',
            cidade: 'São Paulo',
            estado: 'SP',
            codigo_rastreio: 'BR123456789',
            status_envio: 'Enviado',
        },
        {
            id: '2',
            created_at: '2026-01-28T15:00:00.000Z',
            descricao_pacote: 'BF-002',
            nome_cliente: 'Maria Santos',
            cpf: '987.654.321-00',
            email: 'maria@email.com',
            telefone: '21888888888',
            cep: '04567-890',
            logradouro: 'Av Brasil',
            numero: '200',
            complemento: '',
            bairro: 'Jardins',
            cidade: 'Rio de Janeiro',
            estado: 'RJ',
            codigo_rastreio: null,
            status_envio: 'Pendente',
        },
    ];

    describe('prepareExportData', () => {
        it('should format orders for export', () => {
            const result = prepareExportData(mockOrders);

            expect(result).toHaveLength(2);
            expect(result[0]).toHaveProperty('Pacote', 'DP-001');
            expect(result[0]).toHaveProperty('Cliente', 'João Silva');
            expect(result[0]).toHaveProperty('Status', 'Enviado');
            expect(result[1]).toHaveProperty('Rastreio', 'N/A');
        });

        it('should handle empty order list', () => {
            const result = prepareExportData([]);
            expect(result).toEqual([]);
        });
    });

    describe('exportToCSV', () => {
        it('should not throw when exporting valid data', () => {
            // Just testing it doesn't throw - actual file download can't be tested in jsdom
            expect(() => exportToCSV(mockOrders, 'test')).not.toThrow();
        });

        it('should handle empty data', () => {
            expect(() => exportToCSV([], 'empty')).not.toThrow();
        });
    });
});

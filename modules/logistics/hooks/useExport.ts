import { useState } from 'react';
import { exportToExcel, exportToCSV } from '../utils/exportUtils';

export type ExportFormat = 'excel' | 'csv';

export function useExport() {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async (orders: any[], format: ExportFormat = 'excel') => {
        if (!orders || orders.length === 0) {
            alert('Nenhum pedido para exportar');
            return;
        }

        setIsExporting(true);

        try {
            // Pequeno delay para feedback visual
            await new Promise(resolve => setTimeout(resolve, 300));

            if (format === 'excel') {
                exportToExcel(orders);
            } else {
                exportToCSV(orders);
            }

            // Toast de sucesso (se tiver sistema de toast)
            console.log(`✅ ${orders.length} pedidos exportados com sucesso!`);

        } catch (error) {
            console.error('Erro ao exportar:', error);
            alert('Erro ao exportar dados. Tente novamente.');
        } finally {
            setIsExporting(false);
        }
    };

    return {
        isExporting,
        exportToExcel: (orders: any[]) => handleExport(orders, 'excel'),
        exportToCSV: (orders: any[]) => handleExport(orders, 'csv')
    };
}

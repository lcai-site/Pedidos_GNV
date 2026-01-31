import React, { useState } from 'react';
import { useExport } from '../hooks/useExport';

interface ExportButtonProps {
    orders: any[];
    disabled?: boolean;
}

export function ExportButton({ orders, disabled = false }: ExportButtonProps) {
    const [showDropdown, setShowDropdown] = useState(false);
    const { isExporting, exportToExcel, exportToCSV } = useExport();

    const handleExportExcel = () => {
        exportToExcel(orders);
        setShowDropdown(false);
    };

    const handleExportCSV = () => {
        exportToCSV(orders);
        setShowDropdown(false);
    };

    const isDisabled = disabled || isExporting || !orders || orders.length === 0;

    return (
        <div className="relative inline-block">
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                disabled={isDisabled}
                className={`
          px-4 py-2 rounded-lg font-medium text-sm
          flex items-center gap-2
          transition-all duration-200
          ${isDisabled
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                    }
        `}
            >
                {isExporting ? (
                    <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Exportando...</span>
                    </>
                ) : (
                    <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Exportar</span>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </>
                )}
            </button>

            {showDropdown && !isDisabled && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowDropdown(false)}
                    />

                    {/* Dropdown */}
                    <div className="absolute right-0 mt-2 w-48 rounded-lg bg-gray-800 shadow-xl z-20 border border-gray-700">
                        <div className="py-1">
                            <button
                                onClick={handleExportExcel}
                                className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-3 transition-colors"
                            >
                                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                                    <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                                </svg>
                                <div>
                                    <div className="font-medium">Excel</div>
                                    <div className="text-xs text-gray-400">.xlsx</div>
                                </div>
                            </button>

                            <button
                                onClick={handleExportCSV}
                                className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-3 transition-colors"
                            >
                                <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    <div className="font-medium">CSV</div>
                                    <div className="text-xs text-gray-400">.csv</div>
                                </div>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

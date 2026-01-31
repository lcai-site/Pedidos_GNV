// ================================================================
// EXPORTS PÚBLICOS DO MÓDULO LOGISTICS
// ================================================================

// --- Tipos ---
export type {
    OrderFilters,
    ValidationErrors,
    EditOrderForm,
    LabelProgress,
    ProductType,
    CategorizedOrders,
    PaginationState,
    DeepSearchKeys,
    PedidoUnificado
} from './types/logistics.types';

// --- Constantes ---
export {
    DEEP_SEARCH_KEYS,
    JSON_COLUMNS,
    PAGE_SIZE_OPTIONS,
    PRODUCT_TYPES
} from './constants';

// --- Utilitários ---
export { getDeepVal, getDeepValues } from './utils/deepSearch';
export { parseAddressString, formatAddress, formatGroupCodes } from './utils/addressParser';
export { getSafeShipDate, isWithinPostSaleWindow } from './utils/dateRules';
export { exportToExcel, exportToCSV, prepareExportData } from './utils/exportUtils';

// --- Serviços ---
export { validateOrder, validateField, hasValidationErrors } from './services/orderValidationService';
export { patchAddressInObject } from './services/addressPatchService';
export { fetchOrders, updateTracking, clearTracking, updateOrderData } from './services/orderService';

// --- Hooks ---
export { useOrderEdit } from './hooks/useOrderEdit';
export { useOrderData } from './hooks/useOrderData';
export { useExport } from './hooks/useExport';

// --- Componentes ---
export { EditOrderModal, AddressForm, ContactForm } from './components/EditOrderModal';
export { ExportButton } from './components/ExportButton';

// --- Páginas (serão adicionadas depois) ---
// export { LogisticsPage } from './pages/LogisticsPage';


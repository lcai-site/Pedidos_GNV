# 🎯 Como Usar o Módulo Logistics

## 📦 Exemplo: Usando EditOrderModal

### Importação

```typescript
import { useOrderEdit, EditOrderModal } from '../modules/logistics';
```

### Uso no Componente

```typescript
import React from 'react';
import { useOrderEdit, EditOrderModal } from '../modules/logistics';
import { PedidoUnificado } from '../types';

export const LogisticsPage = () => {
  const {
    // State
    isEditModalOpen,
    editingOrder,
    editForm,
    fieldErrors,
    saving,
    
    // Actions
    openEditModal,
    closeEditModal,
    updateField,
    saveEdit
  } = useOrderEdit();

  const handleOrderClick = (order: PedidoUnificado) => {
    openEditModal(order);
  };

  const handleSave = () => {
    saveEdit(() => {
      // Callback de sucesso - recarregar lista
      console.log('Pedido atualizado com sucesso!');
    });
  };

  return (
    <div>
      {/* Sua lista de pedidos */}
      <button onClick={() => handleOrderClick(someOrder)}>
        Editar Pedido
      </button>

      {/* Modal de Edição */}
      <EditOrderModal
        isOpen={isEditModalOpen}
        order={editingOrder}
        form={editForm}
        errors={fieldErrors}
        saving={saving}
        onClose={closeEditModal}
        onSave={handleSave}
        onChange={updateField}
      />
    </div>
  );
};
```

---

## 🔧 Utilitários Disponíveis

### Deep Search

```typescript
import { getDeepVal, getDeepValues, DEEP_SEARCH_KEYS } from '../modules/logistics';

// Buscar um valor específico
const nome = getDeepVal(order, DEEP_SEARCH_KEYS.nome);
const cpf = getDeepVal(order, DEEP_SEARCH_KEYS.cpf);

// Buscar todos os valores de uma vez
const data = getDeepValues(order);
console.log(data.nome, data.cpf, data.email);
```

### Address Parser

```typescript
import { parseAddressString, formatAddress } from '../modules/logistics';

// Parsear string de endereço
const components = parseAddressString("Av Paulista, 1000, Bela Vista, São Paulo - SP, 01310-100");
// { logradouro: "Av Paulista", numero: "1000", bairro: "Bela Vista", ... }

// Formatar componentes em string
const formatted = formatAddress({
  logradouro: "Av Paulista",
  numero: "1000",
  bairro: "Bela Vista",
  cidade: "São Paulo",
  estado: "SP",
  cep: "01310100"
});
// "Av Paulista, 1000 - Bela Vista, São Paulo - SP, 01310-100"
```

### Validação

```typescript
import { validateOrder, validateField } from '../modules/logistics';

// Validar pedido completo
const errors = validateOrder(order);
if (Object.keys(errors).length > 0) {
  console.error('Pedido inválido:', errors);
}

// Validar campo específico
const cpfError = validateField('cpf', '12345678901');
if (cpfError) {
  console.error(cpfError); // "CPF deve ter 11 dígitos"
}
```

---

## 📊 Hooks Disponíveis

### useOrderData

```typescript
import { useOrderData } from '../modules/logistics';

const { orders, loading, error, refetch, updateOrderLocally } = useOrderData();

// Recarregar pedidos
refetch();

// Atualizar pedido localmente (optimistic update)
updateOrderLocally(orderId, { status: 'Enviado' });
```

### useOrderEdit

```typescript
import { useOrderEdit } from '../modules/logistics';

const {
  isEditModalOpen,
  editingOrder,
  editForm,
  fieldErrors,
  saving,
  openEditModal,
  closeEditModal,
  updateField,
  saveEdit
} = useOrderEdit();

// Abrir modal
openEditModal(order);

// Atualizar campo
updateField('nome', 'João Silva');

// Salvar
saveEdit(() => console.log('Sucesso!'));
```

---

## 🎨 Componentes Disponíveis

### EditOrderModal

```typescript
<EditOrderModal
  isOpen={isEditModalOpen}
  order={editingOrder}
  form={editForm}
  errors={fieldErrors}
  saving={saving}
  onClose={closeEditModal}
  onSave={handleSave}
  onChange={updateField}
/>
```

### AddressForm (Standalone)

```typescript
import { AddressForm } from '../modules/logistics';

<AddressForm
  form={editForm}
  errors={fieldErrors}
  onChange={updateField}
/>
```

### ContactForm (Standalone)

```typescript
import { ContactForm } from '../modules/logistics';

<ContactForm
  form={editForm}
  errors={fieldErrors}
  onChange={updateField}
/>
```

---

## ✅ Benefícios

1. **Modular:** Cada parte pode ser usada independentemente
2. **Testável:** Hooks e serviços podem ser testados isoladamente
3. **Reutilizável:** Componentes podem ser usados em outros módulos
4. **Type-Safe:** TypeScript completo com tipos exportados
5. **Documentado:** Funções com JSDoc

---

## 📁 Estrutura de Arquivos

```
modules/logistics/
├── types/logistics.types.ts       # Tipos TypeScript
├── constants/index.ts             # Constantes
├── utils/
│   ├── deepSearch.ts              # Busca em JSONs
│   ├── addressParser.ts           # Parser de endereços
│   └── dateRules.ts               # Regras de data
├── services/
│   ├── orderService.ts            # CRUD de pedidos
│   ├── orderValidationService.ts  # Validação
│   └── addressPatchService.ts     # Atualização de endereços
├── hooks/
│   ├── useOrderData.ts            # Buscar pedidos
│   └── useOrderEdit.ts            # Edição de pedidos
├── components/
│   └── EditOrderModal/
│       ├── EditOrderModal.tsx     # Modal principal
│       ├── AddressForm.tsx        # Formulário de endereço
│       ├── ContactForm.tsx        # Formulário de contato
│       └── index.ts               # Exports
└── index.ts                       # Exports públicos
```

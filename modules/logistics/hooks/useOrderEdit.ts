// ================================================================
// USE ORDER EDIT HOOK
// ================================================================
// Hook para gerenciar edição de pedidos

import { useState } from 'react';
import { PedidoUnificado, EditOrderForm, ValidationErrors } from '../types/logistics.types';
import { getDeepVal, getDeepValues } from '../utils/deepSearch';
import { parseAddressString, formatAddress } from '../utils/addressParser';
import { validateOrder } from '../services/orderValidationService';
import { updateOrderData } from '../services/orderService';
import { DEEP_SEARCH_KEYS } from '../constants';

export const useOrderEdit = () => {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<PedidoUnificado | null>(null);
    const [editForm, setEditForm] = useState<EditOrderForm>({
        nome: '',
        cpf: '',
        telefone: '',
        email: '',
        cep: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        estado: '',
        observacao: ''
    });
    const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});
    const [saving, setSaving] = useState(false);

    /**
     * Abre modal de edição e preenche formulário com dados do pedido
     */
    const openEditModal = (order: PedidoUnificado) => {
        setEditingOrder(order);

        // Extrair dados do pedido usando deep search
        const values = getDeepValues(order);

        let cep = values.cep;
        let logradouro = values.logradouro;
        let numero = values.numero;
        let complemento = values.complemento;
        let bairro = values.bairro;
        let cidade = values.cidade;
        let estado = values.estado;

        // Se não encontrou logradouro, tentar parsear endereço completo
        if (!logradouro && values.enderecoCompleto) {
            const parsed = parseAddressString(values.enderecoCompleto);
            if (parsed.logradouro) logradouro = parsed.logradouro;
            if (parsed.numero) numero = parsed.numero;
            if (parsed.bairro) bairro = parsed.bairro;
            if (parsed.cidade) cidade = parsed.cidade;
            if (parsed.estado) estado = parsed.estado;
            if (parsed.cep && !cep) cep = parsed.cep;
        }

        // Preencher formulário
        setEditForm({
            nome: values.nome,
            cpf: values.cpf,
            telefone: values.telefone,
            email: values.email,
            cep,
            logradouro,
            numero,
            complemento,
            bairro,
            cidade,
            estado,
            observacao: getDeepVal(order, ['observacao']) || ''
        });

        // Validar campos e mostrar erros
        const validationErrors = validateOrder({
            cpf: values.cpf,
            nome_cliente: values.nome,
            cep,
            logradouro,
            numero,
            bairro,
            cidade,
            estado
        });

        setFieldErrors(validationErrors);

        // Mostrar alerta se houver erros
        if (Object.keys(validationErrors).length > 0) {
            console.warn('⚠️ Pedido com campos inválidos:', validationErrors);
        }

        setIsEditModalOpen(true);
    };

    /**
     * Fecha modal de edição
     */
    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setEditingOrder(null);
        setFieldErrors({});
    };

    /**
     * Atualiza campo do formulário
     */
    const updateField = (field: keyof EditOrderForm, value: string) => {
        setEditForm(prev => ({ ...prev, [field]: value }));
    };

    /**
     * Salva alterações do pedido
     */
    const saveEdit = async (onSuccess?: () => void) => {
        if (!editingOrder) return;

        setSaving(true);

        try {
            // Validar antes de salvar
            const errors = validateOrder({
                cpf: editForm.cpf,
                nome_cliente: editForm.nome,
                cep: editForm.cep,
                logradouro: editForm.logradouro,
                numero: editForm.numero,
                bairro: editForm.bairro,
                cidade: editForm.cidade,
                estado: editForm.estado
            });

            if (Object.keys(errors).length > 0) {
                setFieldErrors(errors);
                alert('❌ Por favor, corrija os erros antes de salvar.');
                return;
            }

            // Buscar CPF original
            const cpfOriginal = getDeepVal(editingOrder, DEEP_SEARCH_KEYS.cpf);

            // Atualizar via SQL function
            const count = await updateOrderData(cpfOriginal, editForm);

            if (count > 0) {
                alert('✅ Alterações salvas com sucesso!');
                closeEditModal();

                // Callback de sucesso (ex: recarregar lista)
                if (onSuccess) onSuccess();
            } else {
                alert('⚠️ Nenhum registro foi atualizado. Verifique os dados.');
            }

        } catch (error: any) {
            console.error("Erro CRÍTICO ao salvar:", error);
            alert(`❌ Erro ao salvar no banco de dados:\n\n${error.message || JSON.stringify(error)}\n\nVerifique o console do navegador (F12) para mais detalhes.`);
        } finally {
            setSaving(false);
        }
    };

    return {
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
    };
};

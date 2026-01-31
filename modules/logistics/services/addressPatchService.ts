// ================================================================
// ADDRESS PATCH SERVICE
// ================================================================
// Serviço para atualizar endereços em objetos JSON aninhados

import { EditOrderForm } from '../types/logistics.types';

/**
 * Atualiza endereço em um objeto JSON aninhado (deep patch)
 * 
 * Esta função percorre um objeto e atualiza todos os campos de endereço
 * encontrados, seja em objetos aninhados ou em chaves planas.
 * 
 * @param obj - Objeto para atualizar
 * @param form - Formulário com novos dados
 * @returns Objeto atualizado
 * 
 * @example
 * const updated = patchAddressInObject(order.metadata, editForm);
 */
export const patchAddressInObject = (obj: any, form: EditOrderForm) => {
    if (!obj || typeof obj !== 'object') return obj;
    const newObj = Array.isArray(obj) ? [...obj] : { ...obj };

    // 1. Atualizar sub-objeto 'address' se existir
    if (newObj.address && typeof newObj.address === 'object') {
        newObj.address = {
            ...newObj.address,
            street: form.logradouro,
            street_number: form.numero,
            number: form.numero,
            zip_code: form.cep,
            zip: form.cep,
            neighborhood: form.bairro,
            city: form.cidade,
            state: form.estado,
            complement: form.complemento
        };
    }

    // 2. Atualizar sub-objeto 'endereco' se existir
    if (newObj.endereco && typeof newObj.endereco === 'object') {
        newObj.endereco = {
            ...newObj.endereco,
            logradouro: form.logradouro,
            rua: form.logradouro,
            numero: form.numero,
            bairro: form.bairro,
            cidade: form.cidade,
            estado: form.estado,
            cep: form.cep,
            complemento: form.complemento
        };
    }

    // 3. Atualizar chaves planas se o objeto parecer ser um endereço
    const objectKeys = Object.keys(newObj);
    const hasFlatAddressLikeKeys = objectKeys.some(k =>
        ['rua', 'logradouro', 'street', 'cep', 'zip', 'city', 'cidade'].includes(k.toLowerCase())
    );

    if (hasFlatAddressLikeKeys) {
        if (newObj.rua !== undefined) newObj.rua = form.logradouro;
        if (newObj.logradouro !== undefined) newObj.logradouro = form.logradouro;
        if (newObj.street !== undefined) newObj.street = form.logradouro;

        if (newObj.numero !== undefined) newObj.numero = form.numero;
        if (newObj.number !== undefined) newObj.number = form.numero;

        if (newObj.bairro !== undefined) newObj.bairro = form.bairro;
        if (newObj.neighborhood !== undefined) newObj.neighborhood = form.bairro;

        if (newObj.cidade !== undefined) newObj.cidade = form.cidade;
        if (newObj.city !== undefined) newObj.city = form.cidade;

        if (newObj.estado !== undefined) newObj.estado = form.estado;
        if (newObj.state !== undefined) newObj.state = form.estado;
        if (newObj.uf !== undefined) newObj.uf = form.estado;

        if (newObj.cep !== undefined) newObj.cep = form.cep;
        if (newObj.zip !== undefined) newObj.zip = form.cep;

        if (newObj.complemento !== undefined) newObj.complemento = form.complemento;
        if (newObj.complement !== undefined) newObj.complement = form.complemento;
    }

    return newObj;
};

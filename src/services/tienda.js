// src/services/tienda.js
// Servicio de compras atómicas de ítems en la tienda.
const Usuario = require('../models/Usuario');
const { modificarHuesos, obtenerUsuario } = require('./economia');
const { obtenerConfig, eventoActivo } = require('./evento');
const { conBloqueo } = require('../utils/locks');
const { ITEMS } = require('../data/items');
const { logCompra } = require('./logger');

async function comprarItem(userId, guildId, itemId, cantidad = 1) {
    const confEvento = await obtenerConfig(guildId);
    if (!eventoActivo(confEvento)) return { ok: false, motivo: 'evento_cerrado' };

    const item = ITEMS[itemId];
    if (!item) return { ok: false, motivo: 'item_no_existe' };

    cantidad = Math.trunc(Number(cantidad));
    if (isNaN(cantidad) || cantidad <= 0) cantidad = 1;

    const costoTotal = item.precio * cantidad;

    const bloqueo = await conBloqueo(`${guildId}:${userId}`, async () => {
        const usuario = await obtenerUsuario(userId, guildId);
        if (usuario.huesos < costoTotal) {
            return {
                ok: false,
                motivo: 'saldo_insuficiente',
                saldo: usuario.huesos,
                costo: costoTotal,
            };
        }

        // Deducción atómica
        const deducido = await modificarHuesos(
            userId,
            guildId,
            -costoTotal,
            'compra',
            `Compra de ${cantidad}x ${item.nombre}`
        );
        if (!deducido) return { ok: false, motivo: 'saldo_insuficiente' };

        // Añadir al inventario
        try {
            let actualizado = await Usuario.findOneAndUpdate(
                { userId, guildId, 'inventario.itemId': itemId },
                { $inc: { 'inventario.$.cantidad': cantidad } },
                { new: true }
            );

            if (!actualizado) {
                actualizado = await Usuario.findOneAndUpdate(
                    { userId, guildId },
                    { $push: { inventario: { itemId, cantidad } } },
                    { new: true }
                );
            }

            return {
                ok: true,
                item,
                cantidad,
                costoTotal,
                usuario: actualizado,
            };
        } catch (err) {
            // Reembolso de seguridad si falla la base de datos
            await modificarHuesos(userId, guildId, costoTotal, 'reembolso', 'Fallo al añadir al inventario');
            return { ok: false, motivo: 'error_interno' };
        }
    });

    if (bloqueo.ocupado) return { ok: false, motivo: 'ocupado' };
    return bloqueo.resultado;
}

module.exports = { comprarItem };

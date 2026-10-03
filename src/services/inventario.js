// src/services/inventario.js
// Servicio de gestión y uso de ítems del inventario.
const Usuario = require('../models/Usuario');
const { ITEMS } = require('../data/items');
const { conBloqueo } = require('../utils/locks');
const { limpiarEfectosExpirados } = require('./efectos');

async function usarItem(userId, guildId, itemId) {
    const item = ITEMS[itemId];
    if (!item) return { ok: false, motivo: 'item_invalido' };

    if (itemId === 'llave_cofre') {
        return {
            ok: false,
            motivo: 'item_pasivo',
            mensaje: '🗝️ La Llave del Cofre no se consume aquí; se utilizará automáticamente cuando aparezca un Cofre Maldito en el canal de eventos.',
        };
    }

    const bloqueo = await conBloqueo(`${guildId}:${userId}`, async () => {
        // Consumo atómico: solo si cantidad >= 1
        const usuario = await Usuario.findOneAndUpdate(
            {
                userId,
                guildId,
                inventario: { $elemMatch: { itemId, cantidad: { $gte: 1 } } },
            },
            { $inc: { 'inventario.$.cantidad': -1 } },
            { new: true }
        );

        if (!usuario) {
            return { ok: false, motivo: 'no_posee_item' };
        }

        // Crear efecto correspondiente
        const ahora = Date.now();
        const nuevoEfecto = {
            tipo: itemId,
            expiraEn: item.duracionMs ? new Date(ahora + item.duracionMs) : null,
            usosRestantes: item.usos !== undefined ? item.usos : null,
            valor: item.bonoProbabilidad !== undefined ? item.bonoProbabilidad : null,
        };

        // Agregar efecto
        await Usuario.updateOne(
            { userId, guildId },
            { $push: { efectos: nuevoEfecto } }
        );

        const usuarioActualizado = await Usuario.findOne({ userId, guildId });
        await limpiarEfectosExpirados(usuarioActualizado);

        return {
            ok: true,
            item,
            efecto: nuevoEfecto,
            usuario: usuarioActualizado,
        };
    });

    if (bloqueo.ocupado) return { ok: false, motivo: 'ocupado' };
    return bloqueo.resultado;
}

module.exports = { usarItem };

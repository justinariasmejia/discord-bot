// src/services/cazar.js
// Servicio de cacería en la Cripta de los Huesos.
const Usuario = require('../models/Usuario');
const { obtenerUsuario, registrarTransaccion } = require('./economia');
const { obtenerConfig, eventoActivo, multiplicadorActual } = require('./evento');
const { conBloqueo } = require('../utils/locks');
const { generarBotinCaza } = require('../data/loot');
const configBalance = require('../data/config');

async function cazar(userId, guildId) {
    const config = await obtenerConfig(guildId);
    if (!eventoActivo(config)) {
        return { ok: false, motivo: 'evento_cerrado' };
    }

    const bloqueo = await conBloqueo(`${guildId}:${userId}`, async () => {
        const usuario = await obtenerUsuario(userId, guildId);
        const ahora = Date.now();
        const ultimo = usuario.ultimoCazar ? usuario.ultimoCazar.getTime() : null;

        if (ultimo && ahora - ultimo < configBalance.CAZAR.COOLDOWN_MS) {
            return {
                ok: false,
                motivo: 'cooldown',
                proximo: ultimo + configBalance.CAZAR.COOLDOWN_MS,
            };
        }

        const botin = generarBotinCaza();

        // ── Caso A: Ganancia de huesos (Común o Raro) ──
        if (botin.tipo === 'hueso_comun' || botin.tipo === 'hueso_raro') {
            const multiplicador = multiplicadorActual(config);
            const premio = Math.round(botin.huesosBase * multiplicador);

            const actualizado = await Usuario.findOneAndUpdate(
                { userId, guildId, ultimoCazar: usuario.ultimoCazar ?? null },
                {
                    $set: { ultimoCazar: new Date(ahora) },
                    $inc: { huesos: premio, 'estadisticas.cazados': 1 },
                },
                { new: true }
            );

            if (!actualizado) return { ok: false, motivo: 'conflicto' };

            await registrarTransaccion(
                userId,
                guildId,
                'cazar',
                premio,
                actualizado.huesos,
                `${botin.titulo} (x${multiplicador})`
            );

            return {
                ok: true,
                tipo: botin.tipo,
                titulo: botin.titulo,
                descripcion: botin.descripcion,
                premio,
                multiplicador,
                usuario: actualizado,
            };
        }

        // ── Caso B: Drop de ítem ──
        if (botin.tipo === 'item') {
            const item = botin.item;
            const tieneItem = (usuario.inventario || []).some((i) => i.itemId === item.id);

            let actualizado;
            if (tieneItem) {
                actualizado = await Usuario.findOneAndUpdate(
                    {
                        userId,
                        guildId,
                        ultimoCazar: usuario.ultimoCazar ?? null,
                        'inventario.itemId': item.id,
                    },
                    {
                        $set: { ultimoCazar: new Date(ahora) },
                        $inc: { 'inventario.$.cantidad': 1, 'estadisticas.cazados': 1 },
                    },
                    { new: true }
                );
            } else {
                actualizado = await Usuario.findOneAndUpdate(
                    { userId, guildId, ultimoCazar: usuario.ultimoCazar ?? null },
                    {
                        $set: { ultimoCazar: new Date(ahora) },
                        $push: { inventario: { itemId: item.id, cantidad: 1 } },
                        $inc: { 'estadisticas.cazados': 1 },
                    },
                    { new: true }
                );
            }

            if (!actualizado) return { ok: false, motivo: 'conflicto' };

            await registrarTransaccion(
                userId,
                guildId,
                'cazar',
                0,
                actualizado.huesos,
                `Obtuvo ítem: ${item.nombre}`
            );

            return {
                ok: true,
                tipo: 'item',
                titulo: botin.titulo,
                descripcion: botin.descripcion,
                item,
                usuario: actualizado,
            };
        }

        // ── Caso C: Emboscada de monstruo (pérdida de huesos) ──
        if (botin.tipo === 'emboscada') {
            let perdida = Math.floor(usuario.huesos * configBalance.CAZAR.EMBOSCADA_PORCENTAJE);
            if (usuario.huesos > 0 && perdida < 1) perdida = 1;
            if (perdida > configBalance.CAZAR.EMBOSCADA_TOPE_MAX) perdida = configBalance.CAZAR.EMBOSCADA_TOPE_MAX;
            if (perdida > usuario.huesos) perdida = usuario.huesos;

            const filtro = {
                userId,
                guildId,
                ultimoCazar: usuario.ultimoCazar ?? null,
            };
            if (perdida > 0) {
                filtro.huesos = { $gte: perdida };
            }

            const actualizado = await Usuario.findOneAndUpdate(
                filtro,
                {
                    $set: { ultimoCazar: new Date(ahora) },
                    $inc: { huesos: -perdida, 'estadisticas.cazados': 1 },
                },
                { new: true }
            );

            if (!actualizado) return { ok: false, motivo: 'conflicto' };

            if (perdida > 0) {
                await registrarTransaccion(
                    userId,
                    guildId,
                    'cazar',
                    -perdida,
                    actualizado.huesos,
                    'Emboscada en el cementerio'
                );
            }

            return {
                ok: true,
                tipo: 'emboscada',
                titulo: botin.titulo,
                descripcion: botin.descripcion,
                perdida,
                usuario: actualizado,
            };
        }

        // ── Caso D: Nada ──
        const actualizado = await Usuario.findOneAndUpdate(
            { userId, guildId, ultimoCazar: usuario.ultimoCazar ?? null },
            {
                $set: { ultimoCazar: new Date(ahora) },
                $inc: { 'estadisticas.cazados': 1 },
            },
            { new: true }
        );

        if (!actualizado) return { ok: false, motivo: 'conflicto' };

        return {
            ok: true,
            tipo: 'nada',
            titulo: botin.titulo,
            descripcion: botin.descripcion,
            usuario: actualizado,
        };
    });

    if (bloqueo.ocupado) return { ok: false, motivo: 'ocupado' };
    return bloqueo.resultado;
}

module.exports = { cazar };

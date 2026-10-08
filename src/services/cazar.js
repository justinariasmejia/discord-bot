// src/services/cazar.js
// Servicio de cacería en la Cripta de los Huesos (Simplificado y directo).
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
        const cooldownMs = configBalance.CAZAR?.COOLDOWN_MS || 3600000;

        if (ultimo && ahora - ultimo < cooldownMs) {
            return {
                ok: false,
                motivo: 'cooldown',
                proximo: ultimo + cooldownMs,
            };
        }

        const botin = generarBotinCaza();
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
    });

    if (bloqueo.ocupado) return { ok: false, motivo: 'ocupado' };
    return bloqueo.resultado;
}

module.exports = { cazar };

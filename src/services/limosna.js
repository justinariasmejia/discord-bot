// src/services/limosna.js
// Servicio de caridad diaria para cazadores caídos en la pobreza (< 30 huesos).
const Usuario = require('../models/Usuario');
const { obtenerUsuario, registrarTransaccion } = require('./economia');
const { obtenerConfig, eventoActivo } = require('./evento');
const { conBloqueo } = require('../utils/locks');
const config = require('../data/config');

async function solicitarLimosna(userId, guildId) {
    const confEvento = await obtenerConfig(guildId);
    if (!eventoActivo(confEvento)) return { ok: false, motivo: 'evento_cerrado' };

    const bloqueo = await conBloqueo(`${guildId}:${userId}`, async () => {
        const usuario = await obtenerUsuario(userId, guildId);
        const ahora = Date.now();

        if (usuario.huesos >= config.LIMOSNA.LIMITE_HUESOS) {
            return {
                ok: false,
                motivo: 'no_califica',
                limite: config.LIMOSNA.LIMITE_HUESOS,
                saldo: usuario.huesos,
            };
        }

        const ultimo = usuario.ultimaLimosna ? usuario.ultimaLimosna.getTime() : null;
        if (ultimo && ahora - ultimo < config.LIMOSNA.COOLDOWN_MS) {
            return {
                ok: false,
                motivo: 'cooldown',
                proximo: ultimo + config.LIMOSNA.COOLDOWN_MS,
            };
        }

        const premio = config.LIMOSNA.CANTIDAD;
        const actualizado = await Usuario.findOneAndUpdate(
            {
                userId,
                guildId,
                ultimaLimosna: usuario.ultimaLimosna ?? null,
                huesos: { $lt: config.LIMOSNA.LIMITE_HUESOS },
            },
            {
                $set: { ultimaLimosna: new Date(ahora) },
                $inc: { huesos: premio },
            },
            { new: true }
        );

        if (!actualizado) return { ok: false, motivo: 'conflicto' };

        await registrarTransaccion(
            userId,
            guildId,
            'limosna',
            premio,
            actualizado.huesos,
            'Limosna del fantasma compasivo'
        );

        return {
            ok: true,
            premio,
            usuario: actualizado,
        };
    });

    if (bloqueo.ocupado) return { ok: false, motivo: 'ocupado' };
    return bloqueo.resultado;
}

module.exports = { solicitarLimosna };

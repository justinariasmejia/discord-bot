// Recompensa diaria con racha.
const Usuario = require('../models/Usuario');
const { obtenerUsuario, registrarTransaccion } = require('./economia');
const { obtenerConfig, eventoActivo, multiplicadorActual } = require('./evento');
const { conBloqueo } = require('../utils/locks');

const COOLDOWN_MS = 20 * 60 * 60 * 1000;   // se puede reclamar cada 20 h
const RACHA_MAX_MS = 48 * 60 * 60 * 1000;  // si pasan 48 h sin reclamar, la racha vuelve a 1
const BASE = 50;
const BONUS_POR_DIA = 15;
const TOPE_RACHA = 7;                      // el bono deja de crecer al día 7 (máx. 140 huesos)

async function reclamarDiario(userId, guildId) {
    const config = await obtenerConfig(guildId);
    if (!eventoActivo(config)) return { ok: false, motivo: 'evento_cerrado' };

    const bloqueo = await conBloqueo(`${guildId}:${userId}`, async () => {
        const usuario = await obtenerUsuario(userId, guildId);
        const ahora = Date.now();
        const ultimo = usuario.ultimoDiario ? usuario.ultimoDiario.getTime() : null;

        if (ultimo && ahora - ultimo < COOLDOWN_MS) {
            return { ok: false, motivo: 'cooldown', proximo: ultimo + COOLDOWN_MS };
        }

        const racha = ultimo && ahora - ultimo < RACHA_MAX_MS ? usuario.rachaDiaria + 1 : 1;
        const multiplicador = multiplicadorActual(config);
        const premio = Math.round((BASE + BONUS_POR_DIA * (Math.min(racha, TOPE_RACHA) - 1)) * multiplicador);

        // El filtro por ultimoDiario garantiza que solo se reclame una vez aunque haya carreras.
        const actualizado = await Usuario.findOneAndUpdate(
            { userId, guildId, ultimoDiario: usuario.ultimoDiario ?? null },
            {
                $set: { ultimoDiario: new Date(ahora), rachaDiaria: racha },
                $inc: { huesos: premio, 'estadisticas.diarios': 1 },
            },
            { new: true }
        );
        if (!actualizado) return { ok: false, motivo: 'conflicto' };

        await registrarTransaccion(userId, guildId, 'diario', premio, actualizado.huesos, `Racha ${racha}, x${multiplicador}`);
        return { ok: true, premio, racha, multiplicador, usuario: actualizado };
    });

    if (bloqueo.ocupado) return { ok: false, motivo: 'ocupado' };
    return bloqueo.resultado;
}

module.exports = { reclamarDiario, TOPE_RACHA };

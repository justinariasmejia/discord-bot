// src/services/robar.js
// Servicio de robos entre cazadores con bloqueo dual y protección de amuleto.
const Usuario = require('../models/Usuario');
const { modificarHuesos, obtenerUsuario } = require('./economia');
const { obtenerConfig, eventoActivo } = require('./evento');
const { conBloqueo } = require('../utils/locks');
const { tieneEfectoActivo, limpiarEfectosExpirados } = require('./efectos');
const { formatoNum, base, COLORES } = require('../utils/embeds');
const config = require('../data/config');

const cooldownsRobo = new Map(); // userId -> timestamp

function verificarCooldownRobo(userId) {
    const ahora = Date.now();
    const ultimo = cooldownsRobo.get(userId);
    if (ultimo && ahora - ultimo < config.ROBAR.COOLDOWN_MS) {
        return {
            enCooldown: true,
            proximo: ultimo + config.ROBAR.COOLDOWN_MS,
        };
    }
    return { enCooldown: false };
}

async function robar(ladronId, victimaId, guildId, client) {
    const confEvento = await obtenerConfig(guildId);
    if (!eventoActivo(confEvento)) return { ok: false, motivo: 'evento_cerrado' };

    if (ladronId === victimaId) {
        return { ok: false, motivo: 'auto_robo' };
    }

    // Verificar si la víctima es un bot
    if (client) {
        try {
            const miembro = await client.users.fetch(victimaId).catch(() => null);
            if (miembro && miembro.bot) {
                return { ok: false, motivo: 'victima_bot' };
            }
        } catch { /* ignorar */ }
    }

    const cd = verificarCooldownRobo(ladronId);
    if (cd.enCooldown) {
        return { ok: false, motivo: 'cooldown', proximo: cd.proximo };
    }

    // Bloqueo dual en orden consistente para evitar interbloqueos
    const [u1, u2] = [ladronId, victimaId].sort();

    const bloqueo = await conBloqueo(`${guildId}:${u1}`, async () => {
        return conBloqueo(`${guildId}:${u2}`, async () => {
            const ladron = await obtenerUsuario(ladronId, guildId);
            const victima = await obtenerUsuario(victimaId, guildId);
            await limpiarEfectosExpirados(victima);

            if (victima.huesos < config.ROBAR.MINIMO_HUESOS_VICTIMA) {
                return {
                    ok: false,
                    motivo: 'victima_pobre',
                    minimo: config.ROBAR.MINIMO_HUESOS_VICTIMA,
                };
            }

            // Inmunidad por Amuleto
            if (tieneEfectoActivo(victima, 'amuleto')) {
                cooldownsRobo.set(ladronId, Date.now());
                const multaAmuleto = Math.min(15, ladron.huesos);
                if (multaAmuleto > 0) {
                    await modificarHuesos(ladronId, guildId, -multaAmuleto, 'multa_robo', 'Repelido por Amuleto');
                }
                await Usuario.updateOne({ userId: ladronId, guildId }, { $inc: { 'estadisticas.robosFallidos': 1 } });
                return {
                    ok: false,
                    motivo: 'victima_inmune',
                    multa: multaAmuleto,
                };
            }

            // Cálculo de probabilidad según ratio de riqueza
            const ratio = (victima.huesos - ladron.huesos) / (victima.huesos + ladron.huesos || 1);
            let prob = 0.45 + ratio * 0.20;
            prob = Math.min(Math.max(prob, config.ROBAR.PROB_MIN), config.ROBAR.PROB_MAX);

            const exito = Math.random() < prob;
            cooldownsRobo.set(ladronId, Date.now());

            // Canal para notificaciones públicas
            const canalId = confEvento.canalEventosId;
            let canalPublico = null;
            if (canalId && client) {
                canalPublico = client.channels.cache.get(canalId) || (await client.channels.fetch(canalId).catch(() => null));
            }

            if (exito) {
                // Éxito: roba entre 5% y 15% de los huesos de la víctima
                const pct = Math.random() * (config.ROBAR.ROBO_MAX_PCT - config.ROBAR.ROBO_MIN_PCT) + config.ROBAR.ROBO_MIN_PCT;
                const montoRobado = Math.max(1, Math.floor(victima.huesos * pct));

                await modificarHuesos(victimaId, guildId, -montoRobado, 'robo', 'Víctima de robo');
                const ladronActualizado = await modificarHuesos(ladronId, guildId, montoRobado, 'robo', 'Botín de robo');

                // Registrar estadísticas
                await Usuario.updateOne({ userId: ladronId, guildId }, { $inc: { 'estadisticas.robosExitosos': 1 } });
                await Usuario.updateOne({ userId: victimaId, guildId }, { $inc: { 'estadisticas.vecesRobado': 1 } });

                // Notificación pública anónima (el ladrón permanece oculto)
                if (canalPublico && canalPublico.isTextBased()) {
                    const embedAlerta = base(
                        '🕵️ ¡Robo en las Sombras!',
                        `Una figura misteriosa se deslizó entre las tumbas y le robó **${formatoNum(montoRobado)}** huesos a <@${victimaId}>.`,
                        COLORES.morado
                    );
                    canalPublico.send({ embeds: [embedAlerta] }).catch(() => null);
                }

                return {
                    ok: true,
                    exito: true,
                    monto: montoRobado,
                    victimaId,
                    nuevoSaldo: ladronActualizado.huesos,
                };
            } else {
                // Fallo: el ladrón es descubierto y paga una multa a la víctima
                const pct = Math.random() * (config.ROBAR.MULTA_FALLO_MAX_PCT - config.ROBAR.MULTA_FALLO_MIN_PCT) + config.ROBAR.MULTA_FALLO_MIN_PCT;
                const multa = Math.max(config.ROBAR.MULTA_MINIMA, Math.floor(ladron.huesos * pct));
                const multaEfectiva = Math.min(multa, ladron.huesos);

                if (multaEfectiva > 0) {
                    await modificarHuesos(ladronId, guildId, -multaEfectiva, 'multa_robo', 'Multa por robo fallido');
                    await modificarHuesos(victimaId, guildId, multaEfectiva, 'compensacion_robo', 'Compensación por intento de robo');
                }

                // Registrar estadísticas
                await Usuario.updateOne({ userId: ladronId, guildId }, { $inc: { 'estadisticas.robosFallidos': 1 } });

                const ladronActualizado = await obtenerUsuario(ladronId, guildId);

                // Notificación pública revelando la identidad del ladrón atrapado
                if (canalPublico && canalPublico.isTextBased()) {
                    const embedAlerta = base(
                        '🚨 ¡Ladrón Atrapado In Fraganti!',
                        `¡<@${ladronId}> intentó saquear a <@${victimaId}> pero fue descubierto! Tuvo que pagarle **${formatoNum(multaEfectiva)}** huesos de indemnización.`,
                        COLORES.rojo
                    );
                    canalPublico.send({ embeds: [embedAlerta] }).catch(() => null);
                }

                return {
                    ok: true,
                    exito: false,
                    multa: multaEfectiva,
                    victimaId,
                    nuevoSaldo: ladronActualizado.huesos,
                };
            }
        });
    });

    if (bloqueo.ocupado || bloqueo.resultado?.ocupado) return { ok: false, motivo: 'ocupado' };
    return bloqueo.resultado?.resultado;
}

module.exports = { robar };

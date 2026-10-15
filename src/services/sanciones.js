// src/services/sanciones.js
// Sistema centralizado de auditoría, prevención y aplicación de sanciones.
const Usuario = require('../models/Usuario');
const config = require('../data/config');

/**
 * Aplica una sanción a un usuario (descuento de huesos, bloqueo de apuestas/duelos y log administrativo).
 * @param {string} userId - ID de Discord del usuario.
 * @param {string} guildId - ID del servidor de Discord.
 * @param {string} reason - Motivo de la sanción.
 * @param {object} [opciones] - Parámetros adicionales u omisiones manuales.
 * @param {number} [opciones.duracionMs] - Duración personalizada en ms.
 * @param {number} [opciones.factor] - Porcentaje de pérdida de huesos (0 a 1).
 * @param {string} [opciones.adminId] - ID del admin que aplicó la sanción (si fue manual).
 * @returns {Promise<{ ok: boolean, perdida?: number, expiraEn?: Date, error?: string }>}
 */
async function sancionarUsuario(userId, guildId, reason, opciones = {}) {
    try {
        const usuario = await Usuario.findOne({ userId, guildId });
        if (!usuario) return { ok: false, motivo: 'usuario_no_encontrado' };

        let factor = 0;
        let durationMs = 0;

        if (opciones.factor !== undefined && opciones.factor !== null) {
            factor = Math.max(0, Math.min(1, Number(opciones.factor)));
        } else if (reason.toLowerCase().includes('duelo') || reason.toLowerCase().includes('colusión')) {
            factor = config.DUELOS?.SANCTION_FACTOR ?? 0.10;
        } else if (reason.toLowerCase().includes('apuesta')) {
            factor = config.APUESTAS?.SANCTION_FACTOR ?? 0.15;
        } else {
            factor = config.SEGURIDAD?.SANCTION_MULTIPLIER ?? 0.25;
        }

        if (opciones.duracionMs !== undefined && opciones.duracionMs !== null) {
            durationMs = Math.max(60000, Number(opciones.duracionMs));
        } else if (reason.toLowerCase().includes('duelo') || reason.toLowerCase().includes('colusión')) {
            durationMs = config.DUELOS?.SANCTION_DURATION_MS ?? 60 * 60 * 1000;
        } else if (reason.toLowerCase().includes('apuesta')) {
            durationMs = config.APUESTAS?.SANCTION_DURATION_MS ?? 30 * 60 * 1000;
        } else {
            durationMs = config.SEGURIDAD?.BAN_DURATION_MS ?? 24 * 60 * 60 * 1000;
        }

        const expiraEn = new Date(Date.now() + durationMs);
        const perdida = factor > 0 ? Math.round(usuario.huesos * factor) : 0;

        await Usuario.updateOne(
            { userId, guildId },
            {
                $inc: { huesos: -perdida, sospechas: 1 },
                $set: {
                    silencioApuestasHasta: expiraEn,
                    bloqueoApuestasHasta: expiraEn,
                    ultimaSospecha: new Date(),
                },
            }
        );

        // Notificar en el canal de administración interno y actualizar panel
        try {
            const { logAdmin } = require('./logger');
            const { actualizarPanelSanciones } = require('./panelSanciones');
            const adminTexto = opciones.adminId ? `<@${opciones.adminId}>` : '🤖 Sistema Preventivo Anti-Fraude';
            const campos = [
                { name: '👤 Usuario Sancionado', value: `<@${userId}>`, inline: true },
                { name: '⚖️ Aplicado por', value: adminTexto, inline: true },
                { name: '⏱️ Duración / Expira', value: `<t:${Math.floor(expiraEn.getTime() / 1000)}:R>`, inline: true },
                { name: '💸 Multa de Huesos', value: perdida > 0 ? `-${perdida} 🦴 (${Math.round(factor * 100)}%)` : 'Sin multa monetaria', inline: true },
                { name: '📋 Motivo', value: reason, inline: false },
            ];
            await logAdmin(guildId, opciones.adminId || null, '🚨 Sanción Aplicada', `Se ha aplicado una sanción a <@${userId}>.`, campos);
            actualizarPanelSanciones(guildId).catch(() => null);
        } catch (logErr) {
            console.error('Error enviando log de sanción a Discord:', logErr);
        }

        console.log(`[SANCTION] User ${userId} en guild ${guildId} sancionado (${reason}). Pérdida: ${perdida} huesos, bloqueo hasta ${expiraEn.toISOString()}`);
        return { ok: true, perdida, expiraEn };
    } catch (err) {
        console.error('Error aplicando sanción:', err);
        return { ok: false, error: err.message };
    }
}

/**
 * Levanta cualquier sanción activa de un usuario.
 * @param {string} userId - ID de Discord del usuario.
 * @param {string} guildId - ID del servidor.
 * @param {string} [adminId] - ID del admin que remueve la sanción.
 * @returns {Promise<{ ok: boolean, motivo?: string, error?: string }>}
 */
async function levantarSancion(userId, guildId, adminId = null) {
    try {
        const usuario = await Usuario.findOne({ userId, guildId });
        if (!usuario) return { ok: false, motivo: 'usuario_no_encontrado' };

        await Usuario.updateOne(
            { userId, guildId },
            {
                $set: {
                    silencioApuestasHasta: null,
                    bloqueoApuestasHasta: null,
                    sospechas: 0,
                },
            }
        );

        // Notificar en el canal de administración interno y actualizar panel
        try {
            const { logAdmin } = require('./logger');
            const { actualizarPanelSanciones } = require('./panelSanciones');
            const adminTexto = adminId ? `<@${adminId}>` : '🤖 Sistema';
            const campos = [
                { name: '👤 Usuario Indultado', value: `<@${userId}>`, inline: true },
                { name: '⚖️ Levantada por', value: adminTexto, inline: true },
                { name: '✨ Estado', value: 'Permisos de duelos y apuestas restaurados.', inline: false },
            ];
            await logAdmin(guildId, adminId || null, '🔓 Sanción Levantada', `Se han restablecido los permisos de apuestas y duelos para <@${userId}>.`, campos);
            actualizarPanelSanciones(guildId).catch(() => null);
        } catch (logErr) {
            console.error('Error enviando log de levantamiento de sanción:', logErr);
        }

        console.log(`[SANCTION] Sanción removida para usuario ${userId} en guild ${guildId}`);
        return { ok: true };
    } catch (err) {
        console.error('Error levantando sanción:', err);
        return { ok: false, error: err.message };
    }
}

/**
 * Obtener lista de usuarios con sanciones activas en el servidor.
 * @param {string} guildId - ID del servidor.
 * @returns {Promise<Array>}
 */
async function obtenerSancionesActivas(guildId) {
    const now = new Date();
    return Usuario.find({
        guildId,
        $or: [
            { silencioApuestasHasta: { $gt: now } },
            { bloqueoApuestasHasta: { $gt: now } },
        ],
    }).lean();
}

module.exports = {
    sancionarUsuario,
    levantarSancion,
    obtenerSancionesActivas,
};

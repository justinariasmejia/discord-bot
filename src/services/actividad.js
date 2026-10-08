// src/services/actividad.js
// Sistema de recompensas por actividad en la comunidad (mensajes en chat y tiempo en salas de voz).
const { modificarHuesos, obtenerUsuario } = require('./economia');
const { obtenerConfig, eventoActivo, multiplicadorActual } = require('./evento');
const config = require('../data/config');

// Cooldown de mensajes en memoria: Map<userId, timestamp>
const cooldownsChat = new Map();

/**
 * Procesa mensajes normales en el servidor y otorga huesos por actividad.
 */
async function procesarActividadTexto(message, client) {
    try {
        if (!message.guild || message.author.bot) return;

        const contenido = message.content?.trim();
        if (!contenido || contenido.length < (config.ACTIVIDAD?.CHAT?.LONGITUD_MINIMA || 4)) return;

        // No procesar mensajes que comiencen con prefijos típicos de comandos
        const prefijos = ['!', '-', 'en!', '/', '$', '?', '.', 'm!'];
        if (prefijos.some((p) => contenido.startsWith(p))) return;

        const userId = message.author.id;
        const guildId = message.guild.id;
        const ahora = Date.now();
        const cooldownMs = config.ACTIVIDAD?.CHAT?.COOLDOWN_MS || 60000;

        const ultimo = cooldownsChat.get(userId) || 0;
        if (ahora - ultimo < cooldownMs) return;

        const conf = await obtenerConfig(guildId);
        if (!eventoActivo(conf)) return;

        // Si está en Modo Test, solo procesar actividad para admins en el canal de pruebas
        if (conf.modoTest) {
            const { esAdmin } = require('./evento');
            if (!esAdmin(message.member)) return;
            if (conf.canalTestId && message.channel.id !== conf.canalTestId) return;
        }

        // Registrar cooldown en memoria
        cooldownsChat.set(userId, ahora);

        // Limpieza periódica preventiva de memoria
        if (cooldownsChat.size > 2000) {
            const limite = ahora - cooldownMs;
            for (const [id, ts] of cooldownsChat.entries()) {
                if (ts < limite) cooldownsChat.delete(id);
            }
        }

        const mult = multiplicadorActual(conf);
        const minHuesos = config.ACTIVIDAD?.CHAT?.HUESOS_MIN || 2;
        const maxHuesos = config.ACTIVIDAD?.CHAT?.HUESOS_MAX || 5;
        const baseHuesos = Math.floor(Math.random() * (maxHuesos - minHuesos + 1)) + minHuesos;
        const totalHuesos = Math.round(baseHuesos * mult);

        await obtenerUsuario(userId, guildId);
        await modificarHuesos(userId, guildId, totalHuesos, 'actividad_chat', 'Mensajes activos en el chat');

        // Detalle sutil: 3% de probabilidad de reaccionar con un hueso al mensaje
        if (Math.random() < 0.03) {
            message.react('🦴').catch(() => null);
        }
    } catch (err) {
        console.error('⚠️ Error en actividad de texto:', err);
    }
}

/**
 * Inicia el loop en segundo plano para recompensar a usuarios en canales de voz.
 */
function iniciarServicioVoz(client) {
    const intervaloMs = config.ACTIVIDAD?.VOZ?.INTERVALO_MS || 150000;

    setInterval(async () => {
        try {
            for (const guild of client.guilds.cache.values()) {
                const conf = await obtenerConfig(guild.id);
                if (!eventoActivo(conf) || conf.modoTest) continue;

                const mult = multiplicadorActual(conf);
                const canalesVoz = guild.channels.cache.filter((c) => c.isVoiceBased());

                for (const canal of canalesVoz.values()) {
                    // Filtrar miembros no-bot
                    const miembros = canal.members.filter((m) => !m.user.bot);
                    const minimoRequerido = config.ACTIVIDAD?.VOZ?.MINIMO_MIEMBROS || 2;

                    // Mínimo 2 personas en la sala para evitar AFK farming solitario
                    if (miembros.size < minimoRequerido) continue;

                    for (const miembro of miembros.values()) {
                        // Si está ensordecido (deaf / selfDeaf), no está participando activamente
                        if (miembro.voice.deaf || miembro.voice.selfDeaf) continue;

                        const baseHuesos = config.ACTIVIDAD?.VOZ?.HUESOS_POR_INTERVALO || 6;
                        const totalHuesos = Math.round(baseHuesos * mult);

                        await obtenerUsuario(miembro.id, guild.id);
                        await modificarHuesos(
                            miembro.id,
                            guild.id,
                            totalHuesos,
                            'actividad_voz',
                            `Actividad en canal de voz: ${canal.name}`
                        ).catch(() => null);
                    }
                }
            }
        } catch (err) {
            console.error('⚠️ Error en servicio de actividad de voz:', err);
        }
    }, intervaloMs);

    console.log(`🎙️ Servicio de Actividad de Voz iniciado (chequeo cada ${Math.round(intervaloMs / 60000)}m).`);
}

module.exports = {
    procesarActividadTexto,
    iniciarServicioVoz,
};

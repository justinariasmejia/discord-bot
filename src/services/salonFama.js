// src/services/salonFama.js
// Gestión del mensaje en vivo del Salón de la Fama en un canal público.
const { PermissionFlagsBits } = require('discord.js');
const ConfigEvento = require('../models/ConfigEvento');
const Usuario = require('../models/Usuario');
const { base, COLORES, formatoNum, tiempoRelativo } = require('../utils/embeds');
const { obtenerConfig, eventoActivo, multiplicadorActual } = require('./evento');
const configBalance = require('../data/config');

const MEDALLAS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

async function configurarCanalSalonFama(guildId, canalId) {
    return ConfigEvento.findOneAndUpdate(
        { guildId },
        { $set: { canalSalonFamaId: canalId, mensajeSalonFamaId: null } },
        { new: true, upsert: true }
    );
}

function construirEmbedSalonFama(config, topUsuarios) {
    const activo = eventoActivo(config);
    const multiplicador = multiplicadorActual(config);

    let desc = '👑 **Los mayores recolectores de huesos de la Cripta**\n\n';

    if (topUsuarios.length === 0) {
        desc += '_Aún ningún mortal se ha atrevido a saquear las tumbas..._\n\n';
    } else {
        topUsuarios.forEach((u, i) => {
            const medalla = MEDALLAS[i] || `#${i + 1}`;
            desc += `${medalla} <@${u.userId}> — **${formatoNum(u.huesos)}** 🦴\n`;
        });
        desc += '\n';
    }

    if (activo) {
        desc += `⏳ **Cierre del evento:** ${tiempoRelativo(config.fechaCierre.getTime())}\n`;
        if (multiplicador > 1) {
            desc += `⚡ **¡Bonus de evento activo!** Ganancias x${multiplicador}\n`;
        }
    } else {
        desc += '🕯️ **La Cripta ha cerrado sus puertas.** El evento ha finalizado.\n';
    }

    const embed = base('🏆 Salón de la Fama — La Cripta de los Huesos', desc, COLORES.naranja);
    embed.setFooter({ text: 'Actualizado cada 5 minutos • 🎃 La Cripta de los Huesos' });
    return embed;
}

async function actualizarMensajeSalonFama(client, guildId) {
    try {
        const config = await obtenerConfig(guildId);
        if (!config || !config.canalSalonFamaId) return;

        const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
        if (!guild) return;

        const canal = guild.channels.cache.get(config.canalSalonFamaId) || (await guild.channels.fetch(config.canalSalonFamaId).catch(() => null));
        if (!canal || !canal.isTextBased()) return;

        // Verificar permisos del bot en el canal
        const me = guild.members.me || (await guild.members.fetchMe().catch(() => null));
        if (!me) return;
        const perms = canal.permissionsFor(me);
        if (!perms || !perms.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
            console.warn(`⚠️ Permisos insuficientes en canal Salón de la Fama (${canal.id}) en servidor ${guildId}`);
            return;
        }

        const topUsuarios = await Usuario.find({ guildId })
            .sort({ huesos: -1, updatedAt: 1 })
            .limit(configBalance.SALON_FAMA.TOP_CANTIDAD)
            .lean();

        const embed = construirEmbedSalonFama(config, topUsuarios);

        // Si ya hay un mensaje guardado, intentar editarlo
        if (config.mensajeSalonFamaId) {
            try {
                const mensajeExistente = await canal.messages.fetch(config.mensajeSalonFamaId);
                if (mensajeExistente) {
                    await mensajeExistente.edit({ embeds: [embed] });
                    return;
                }
            } catch (err) {
                // Si el mensaje fue borrado (código 10008: Unknown Message), lo recrearemos
                if (err.code !== 10008) {
                    console.error('Error al editar mensaje de Salón de la Fama:', err);
                }
            }
        }

        // Si no existe o fue borrado, enviar uno nuevo y guardar el ID
        const nuevoMensaje = await canal.send({ embeds: [embed] });
        await ConfigEvento.updateOne(
            { guildId },
            { $set: { mensajeSalonFamaId: nuevoMensaje.id } }
        );
    } catch (error) {
        console.error(`❌ Error actualizando Salón de la Fama para guild ${guildId}:`, error);
    }
}

async function actualizarTodosLosServidores(client) {
    for (const guild of client.guilds.cache.values()) {
        await actualizarMensajeSalonFama(client, guild.id);
    }
}

function iniciarServicioSalonFama(client) {
    // Primera actualización poco después de conectar
    setTimeout(() => {
        actualizarTodosLosServidores(client).catch((err) =>
            console.error('Error en primera pasada de Salón de la Fama:', err)
        );
    }, 10000);

    // Intervalo recurrente cada 5 minutos
    setInterval(() => {
        actualizarTodosLosServidores(client).catch((err) =>
            console.error('Error en intervalo de Salón de la Fama:', err)
        );
    }, configBalance.SALON_FAMA.INTERVALO_ACTUALIZACION_MS);
}

module.exports = {
    configurarCanalSalonFama,
    actualizarMensajeSalonFama,
    iniciarServicioSalonFama,
};

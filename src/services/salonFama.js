// src/services/salonFama.js
// Gestión del ranking en vivo (Salón de la Fama) con diseño profesional.
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ConfigEvento = require('../models/ConfigEvento');
const Usuario = require('../models/Usuario');
const { basePremium, COLORES, formatoNum, tiempoRelativo, BARRA_PROGRESO } = require('../utils/embeds');
const { obtenerConfig, eventoActivo, multiplicadorActual } = require('./evento');
const configBalance = require('../data/config');

const MEDALLAS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

async function configurarCanalSalonFama(guildId, canalId) {
    return ConfigEvento.findOneAndUpdate(
        { guildId },
        { $set: { canalSalonFamaId: canalId, mensajeSalonFamaId: null } },
        { new: true, upsert: true }
    );
}

function construirEmbedSalonFama(config, topUsuarios, totalCazadores) {
    const activo = eventoActivo(config);
    const multiplicador = multiplicadorActual(config);
    const maxHuesos = topUsuarios.length > 0 ? topUsuarios[0].huesos : 1;

    let desc = '';

    if (topUsuarios.length === 0) {
        desc += '> *Las tumbas permanecen intactas... ningún mortal se ha atrevido a saquearlas.*\n\n';
    } else {
        desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        topUsuarios.forEach((u, i) => {
            const medalla = MEDALLAS[i] || `#${i + 1}`;
            const pct = maxHuesos > 0 ? u.huesos / maxHuesos : 0;
            const barra = BARRA_PROGRESO(pct, 8);
            desc += `${medalla} <@${u.userId}>\n   ${barra} **${formatoNum(u.huesos)}** 🦴\n`;
        });
        desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    }

    // Estado del evento
    if (activo) {
        desc += `🟢 **Estado:** Evento Activo\n`;
        desc += `⏳ **Cierre:** ${tiempoRelativo(config.fechaCierre.getTime())}\n`;
        if (multiplicador > 1) {
            desc += `⚡ **Bonus Activo:** Ganancias x${multiplicador}\n`;
        }
    } else {
        desc += '🔴 **La Cripta ha cerrado sus puertas.**\n';
    }

    desc += `\n👥 **Cazadores registrados:** ${formatoNum(totalCazadores)}`;

    const embed = basePremium('🏆 Tabla de Clasificación — La Cripta de los Huesos', desc, COLORES.dorado);
    embed.setFooter({ text: '🔄 Se actualiza cada 5 minutos • 🎃 La Cripta de los Huesos' });
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

        const me = guild.members.me || (await guild.members.fetchMe().catch(() => null));
        if (!me) return;
        const perms = canal.permissionsFor(me);
        if (!perms || !perms.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) return;

        const topUsuarios = await Usuario.find({ guildId })
            .sort({ huesos: -1, updatedAt: 1 })
            .limit(configBalance.SALON_FAMA.TOP_CANTIDAD)
            .lean();

        const totalCazadores = await Usuario.countDocuments({ guildId });
        const embed = construirEmbedSalonFama(config, topUsuarios, totalCazadores);

        if (config.mensajeSalonFamaId) {
            try {
                const mensajeExistente = await canal.messages.fetch(config.mensajeSalonFamaId);
                if (mensajeExistente) {
                    await mensajeExistente.edit({ embeds: [embed] });
                    return;
                }
            } catch (err) {
                if (err.code !== 10008) console.error('Error editando Salón de la Fama:', err);
            }
        }

        const nuevoMensaje = await canal.send({ embeds: [embed] });
        await ConfigEvento.updateOne({ guildId }, { $set: { mensajeSalonFamaId: nuevoMensaje.id } });
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
    setTimeout(() => {
        actualizarTodosLosServidores(client).catch(console.error);
    }, 10000);

    setInterval(() => {
        actualizarTodosLosServidores(client).catch(console.error);
    }, configBalance.SALON_FAMA.INTERVALO_ACTUALIZACION_MS);
}

module.exports = {
    configurarCanalSalonFama,
    actualizarMensajeSalonFama,
    iniciarServicioSalonFama,
};

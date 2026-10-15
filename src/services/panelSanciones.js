// src/services/panelSanciones.js
// Panel interactivo de auditoría y gestión de sanciones en vivo para "La Cripta de los Huesos"
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const ConfigEvento = require('../models/ConfigEvento');
const { basePremium, COLORES, formatoNum } = require('../utils/embeds');
const { obtenerSancionesActivas } = require('./sanciones');

let _client = null;
function setClientSanciones(client) {
    _client = client;
}

/**
 * Construye el embed y botones interactivos del Panel de Sanciones.
 */
async function construirPanelSanciones(guildId) {
    const sanciones = await obtenerSancionesActivas(guildId);

    let desc = '> *Centro de Seguridad, Auditoría y Gestión de Sanciones en Vivo.*\n\n';

    desc += '### 🛡️ Políticas de Seguridad y Anti-Fraude Activas\n';
    desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    desc += '• **⚔️ Anti-Colusión en Duelos:** Detección automática de win-trading o derrotas intencionales para transferir huesos.\n';
    desc += '• **⏱️ Límites de Duelo:** Máximo 5 duelos diarios y 30 min de enfriamiento contra el mismo oponente.\n';
    desc += '• **🛑 Control Horario de Apuestas:** Máximo 30 tiradas por hora para prevenir macros o bots.\n';
    desc += '• **⚖️ Sanciones Aplicables:** Descuento porcentual de saldo y suspensión temporal de apuestas y duelos.\n';
    desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    desc += '### 🚨 Cazadores Sancionados Actualmente\n';
    desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    if (!sanciones || sanciones.length === 0) {
        desc += '✨ *No hay ningún usuario sancionado en este momento. La Cripta opera en paz.* ✨\n';
    } else {
        sanciones.forEach((u, i) => {
            const expira = u.silencioApuestasHasta ? new Date(u.silencioApuestasHasta) : (u.bloqueoApuestasHasta ? new Date(u.bloqueoApuestasHasta) : null);
            const unixExp = expira ? Math.floor(expira.getTime() / 1000) : null;
            const expiraStr = unixExp ? `<t:${unixExp}:R> (<t:${unixExp}:f>)` : 'Indefinido';
            desc += `**${i + 1}.** <@${u.userId}> • **${formatoNum(u.huesos)} 🦴**\n`;
            desc += `> ⏳ **Expira:** ${expiraStr}\n`;
            desc += `> ⚠️ **Sospechas acumuladas:** \`${u.sospechas || 0}\`\n\n`;
        });
    }
    desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    desc += '👇 *Usa los botones inferiores para inspeccionar o gestionar sanciones:*';

    const embed = basePremium('🚨 Panel de Sanciones y Seguridad • La Cripta', desc, COLORES.rojo);
    embed.setFooter({ text: '🛡️ Personal Autorizado • Auditoría en Vivo de Sanciones' });

    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('admin:sancion_ver:admin')
            .setLabel('Ver Sanciones')
            .setEmoji('📋')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('admin:sancion_aplicar_btn:admin')
            .setLabel('Aplicar Sanción')
            .setEmoji('⚖️')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('admin:sancion_quitar_btn:admin')
            .setLabel('Levantar Sanción')
            .setEmoji('🔓')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('admin:sancion_refresh:admin')
            .setLabel('Actualizar Panel')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [fila] };
}

/**
 * Fija o actualiza el mensaje maestro permanente en el canal de sanciones.
 */
async function configurarCanalSanciones(guildId, canalId, client) {
    _client = client;
    const canal = await client.channels.fetch(canalId).catch(() => null);
    if (!canal || !canal.isTextBased()) throw new Error('Canal inválido');

    const config = await ConfigEvento.findOne({ guildId });
    if (!config) throw new Error('Configuración no encontrada');

    const payload = await construirPanelSanciones(guildId);

    // Si ya existía un mensaje previo, intentar editarlo
    if (config.canalSancionesId === canalId && config.mensajeSancionesId) {
        const msgPrevio = await canal.messages.fetch(config.mensajeSancionesId).catch(() => null);
        if (msgPrevio) {
            await msgPrevio.edit(payload).catch(() => null);
            return { canal, mensaje: msgPrevio };
        }
    }

    // Enviar nuevo mensaje permanente
    const nuevoMsg = await canal.send(payload);
    config.canalSancionesId = canalId;
    config.mensajeSancionesId = nuevoMsg.id;
    await config.save();

    return { canal, mensaje: nuevoMsg };
}

/**
 * Actualiza el panel de sanciones fijo si existe.
 */
async function actualizarPanelSanciones(guildId, client = null) {
    const cli = client || _client;
    if (!cli) return;

    const config = await ConfigEvento.findOne({ guildId }).lean();
    if (!config?.canalSancionesId || !config?.mensajeSancionesId) return;

    try {
        const canal = cli.channels.cache.get(config.canalSancionesId) || await cli.channels.fetch(config.canalSancionesId).catch(() => null);
        if (!canal) return;

        const mensaje = await canal.messages.fetch(config.mensajeSancionesId).catch(() => null);
        if (!mensaje) return;

        const payload = await construirPanelSanciones(guildId);
        await mensaje.edit(payload).catch(() => null);
    } catch (e) {
        console.error('Error actualizando panel de sanciones:', e);
    }
}

module.exports = {
    setClientSanciones,
    construirPanelSanciones,
    configurarCanalSanciones,
    actualizarPanelSanciones,
};

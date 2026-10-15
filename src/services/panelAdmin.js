// src/services/panelAdmin.js
// Centro de mando interactivo y panel maestro permanente de administración para "La Cripta de los Huesos"
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const ConfigEvento = require('../models/ConfigEvento');
const Usuario = require('../models/Usuario');
const Transaccion = require('../models/Transaccion');
const { basePremium, COLORES, formatoNum } = require('../utils/embeds');

const canalesAdminCache = new Map(); // guildId -> { canalId, mensajeId }
const debouncesActualizacion = new Map(); // guildId -> timeout
let _client = null;

function setClientAdmin(client) {
    _client = client;
}

/**
 * Construye el payload visual y componentes del panel de control de administración.
 */
async function construirPanelAdmin(guildId) {
    const config = await ConfigEvento.findOne({ guildId }).lean() || {};
    const totalCazadores = await Usuario.countDocuments({ guildId });
    const totalTransacciones = await Transaccion.countDocuments({ guildId });

    const formatCanal = (id) => id ? `<#${id}>` : '❌ _No configurado_';

    let desc = '> *Centro de Control Maestro de Administración y Moderación del Evento.*\n\n';

    desc += '### 🛠️ Estado del Sistema y Mantenimiento\n';
    desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    desc += `• **Modo Mantenimiento (Test):** ${config.modoTest ? '🟢 **ACTIVADO** (Solo admins y testers)' : '⚪ **DESACTIVADO** (Público)'}\n`;
    desc += `• **Canal de Pruebas:** ${formatCanal(config.canalTestId)}\n`;
    desc += `• **Rol Tester (Pruebas):** ${config.rolTesterId ? `<@&${config.rolTesterId}>` : '_Ninguno configurado_'}\n`;
    desc += `• **Temporada:** ${config.estado === 'activo' ? '🟢 Activa' : '🔴 Cerrada'}\n`;
    desc += `• **Multiplicador Global:** ${config.multiplicador > 1 ? `⚡ **x${config.multiplicador}**` : 'x1 (Normal)'}\n`;
    desc += `• **Cazadores Registrados:** \`${formatoNum(totalCazadores)}\` | **Transacciones:** \`${formatoNum(totalTransacciones)}\`\n`;
    desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    desc += '### 📡 Canales Vinculados\n';
    desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    desc += `🏰 **Panel Cripta (Fijo):** ${formatCanal(config.canalCriptaId)}\n`;
    desc += `👑 **Panel Admin (Fijo):** ${formatCanal(config.canalAdminPanelId)}\n`;
    desc += `📢 **Logs Públicos (Transparencia):** ${formatCanal(config.canalLogsPublicosId)}\n`;
    desc += `🛡️ **Logs de Admins (Auditoría):** ${formatCanal(config.canalLogsId)}\n`;
    desc += `🎲 **Logs Apuestas (Privado):** ${formatCanal(config.canalLogsApuestasId)}\n`;
    desc += `⚔️ **Logs Duelos (Privado):** ${formatCanal(config.canalLogsDuelosId)}\n`;
    desc += `🚨 **Canal Sanciones:** ${formatCanal(config.canalSancionesId)}\n`;
    desc += `🎃 **Eventos Comunitarios:** ${formatCanal(config.canalEventosId)}\n`;
    desc += `🎵 **Reproductor Música:** ${formatCanal(config.canalMusicaId)}\n`;
    const rolesList = (config.rolesAdminIds && config.rolesAdminIds.length > 0)
        ? config.rolesAdminIds.map(id => `<@&${id}>`).join(', ')
        : '🔒 *Solo Administradores nativos*';

    const usuariosList = (config.usuariosAdminIds && config.usuariosAdminIds.length > 0)
        ? config.usuariosAdminIds.map(id => `<@${id}>`).join(', ')
        : '_Ninguno adicional_';

    desc += '### 🛡️ Permisos de Administración\n';
    desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    desc += `• **Super Administrador:** <@1504614011482935358> (Control Maestro Absoluto)\n`;
    desc += `• **Roles autorizados:** ${rolesList}\n`;
    desc += `• **Usuarios autorizados:** ${usuariosList}\n`;
    const testersUsersList = (config.testersIds && config.testersIds.length > 0)
        ? config.testersIds.map(id => `<@${id}>`).join(', ')
        : '_Ninguno asignado_';
    desc += `• **Rol Tester (Modo Pruebas):** ${config.rolTesterId ? `<@&${config.rolTesterId}>` : '_Ninguno configurado_'}\n`;
    desc += `• **Usuarios Testers:** ${testersUsersList}\n`;
    desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    const blacklistRolesList = (config.blacklistRolesIds && config.blacklistRolesIds.length > 0)
        ? config.blacklistRolesIds.map(id => `<@&${id}>`).join(', ')
        : '_Ninguno_';

    const blacklistUsersList = (config.blacklistUsuariosIds && config.blacklistUsuariosIds.length > 0)
        ? config.blacklistUsuariosIds.map(id => `<@${id}>`).join(', ')
        : '_Ninguno_';

    desc += '### 🚫 Lista Negra del Evento (Blacklist)\n';
    desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    desc += `• **Roles excluidos:** ${blacklistRolesList}\n`;
    desc += `• **Usuarios excluidos:** ${blacklistUsersList}\n`;
    desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    desc += '👇 *Presiona los botones interactivos para gestionar el evento:*';

    const embed = basePremium('🛡️ Panel de Control Administrativo • La Cripta', desc, COLORES.morado);
    embed.setFooter({ text: '⚙️ Panel Maestro Permanente de Administración • La Cripta' });

    // Fila 1: Gestión de Huesos, Bone Party y Sorteos
    const fila1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('admin:panel_dar_huesos:admin')
            .setLabel('Dar Huesos')
            .setEmoji('🦴')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('admin:panel_quitar_huesos:admin')
            .setLabel('Quitar Huesos')
            .setEmoji('💸')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('admin:panel_party:admin')
            .setLabel('Bone Party (Todos)')
            .setEmoji('🎉')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('admin:panel_sorteo:admin')
            .setLabel('Sorteo / Drop')
            .setEmoji('🎁')
            .setStyle(ButtonStyle.Primary)
    );

    // Fila 2: Eventos, Mantenimiento, Permisos y Blacklist
    const fila2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('admin:panel_forzar_evento:admin')
            .setLabel('Forzar Evento')
            .setEmoji('⚡')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('admin:panel_toggle_mantenimiento:admin')
            .setLabel(config.modoTest ? 'Iniciar Evento General' : 'Pausar / Mantenimiento')
            .setEmoji(config.modoTest ? '🚀' : '🛠️')
            .setStyle(config.modoTest ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('admin:panel_menu_canales:admin')
            .setLabel('Configurar Canales')
            .setEmoji('⚙️')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('admin:panel_menu_permisos:admin')
            .setLabel('Permisos Staff')
            .setEmoji('🛡️')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('admin:panel_menu_blacklist:admin')
            .setLabel('Blacklist')
            .setEmoji('🚫')
            .setStyle(ButtonStyle.Secondary)
    );

    // Fila 3: Respaldos, Reseteo, Control de Ruleta y Utilidades
    const fila3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('admin:panel_backup:admin')
            .setLabel('Crear Backup')
            .setEmoji('💾')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('admin:panel_terminar_ruleta:admin')
            .setLabel('Terminar Ruleta')
            .setEmoji('🛑')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('admin:panel_reset:admin')
            .setLabel('Resetear Evento')
            .setEmoji('⚠️')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('admin:panel_ver_tx:admin')
            .setLabel('Ver Transacciones')
            .setEmoji('📜')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('admin:panel_refresh:admin')
            .setLabel('Refrescar')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Secondary)
    );

    // Fila 4: Sanciones, Auditoría y Seguridad
    const fila4 = new ActionRowBuilder().addComponents(
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
            .setStyle(ButtonStyle.Success)
    );

    return { embeds: [embed], components: [fila1, fila2, fila3, fila4] };
}

/**
 * Carga los paneles de administración permanentes al iniciar el bot.
 */
async function cargarCanalesAdminPanel(client) {
    _client = client;
    try {
        const configs = await ConfigEvento.find({ canalAdminPanelId: { $ne: null } });
        for (const c of configs) {
            canalesAdminCache.set(c.guildId, {
                canalId: c.canalAdminPanelId,
                mensajeId: c.mensajeAdminPanelId,
            });
            actualizarPanelAdminPermanente(client, c.guildId).catch(() => {});
        }
        console.log(`🛡️ Paneles permanentes de Administración cargados: ${canalesAdminCache.size}`);
    } catch (e) {
        console.error('Error cargando paneles de administración:', e?.message || e);
    }
}

/**
 * Configura y publica el panel permanente de administración en un canal dedicado.
 */
async function configurarCanalAdminPanel(guildId, canalId, client) {
    _client = client;
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return null;
    const canal = guild.channels.cache.get(canalId) || await guild.channels.fetch(canalId).catch(() => null);
    if (!canal) return null;

    const payload = await construirPanelAdmin(guildId);
    const mensajeMaestro = await canal.send(payload);

    await ConfigEvento.findOneAndUpdate(
        { guildId },
        { $set: { canalAdminPanelId: canalId, mensajeAdminPanelId: mensajeMaestro.id } },
        { upsert: true, new: true }
    );

    canalesAdminCache.set(guildId, {
        canalId,
        mensajeId: mensajeMaestro.id,
    });

    return mensajeMaestro;
}

/**
 * Actualiza en vivo el mensaje permanente del panel de administración.
 */
async function actualizarPanelAdminPermanente(client, guildId) {
    const cl = client || _client;
    if (!cl) return;

    let config = canalesAdminCache.get(guildId);
    if (!config || !config.canalId) {
        const dbConf = await ConfigEvento.findOne({ guildId, canalAdminPanelId: { $ne: null } });
        if (dbConf) {
            config = { canalId: dbConf.canalAdminPanelId, mensajeId: dbConf.mensajeAdminPanelId };
            canalesAdminCache.set(guildId, config);
        }
    }
    if (!config || !config.canalId) return;

    try {
        const guild = cl.guilds.cache.get(guildId) || await cl.guilds.fetch(guildId).catch(() => null);
        if (!guild) return;
        const canal = guild.channels.cache.get(config.canalId) || await guild.channels.fetch(config.canalId).catch(() => null);
        if (!canal) return;

        const payload = await construirPanelAdmin(guildId);

        if (config.mensajeId) {
            const mensaje = await canal.messages.fetch(config.mensajeId).catch(() => null);
            if (mensaje) {
                return await mensaje.edit(payload).catch(() => {});
            }
        }

        const nuevo = await canal.send(payload).catch(() => null);
        if (nuevo) {
            config.mensajeId = nuevo.id;
            await ConfigEvento.findOneAndUpdate({ guildId }, { $set: { mensajeAdminPanelId: nuevo.id } });
        }
    } catch (e) {
        console.error('Error actualizando panel maestro de administración:', e?.message || e);
    }
}

/**
 * Solicita una actualización con debounce del panel permanente de administración.
 */
function solicitarActualizacionAdminPanel(guildId) {
    if (debouncesActualizacion.has(guildId)) {
        clearTimeout(debouncesActualizacion.get(guildId));
    }

    const t = setTimeout(() => {
        debouncesActualizacion.delete(guildId);
        actualizarPanelAdminPermanente(_client, guildId).catch(() => {});
    }, 1000);

    debouncesActualizacion.set(guildId, t);
}

module.exports = {
    setClientAdmin,
    construirPanelAdmin,
    cargarCanalesAdminPanel,
    configurarCanalAdminPanel,
    actualizarPanelAdminPermanente,
    solicitarActualizacionAdminPanel,
};

// src/services/lockdown.js
// Sistema de auditoría de canales y bloqueo/desbloqueo de emergencia del servidor.
const {
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
} = require('discord.js');
const Lockdown = require('../models/Lockdown');
const { basePremium, COLORES } = require('../utils/embeds');

/**
 * Determina si un canal es privado comprobando si @everyone NO puede verlo.
 */
function esCanalPrivado(canal, guild) {
    if (!canal.isTextBased() && !canal.isVoiceBased()) return false;
    const everyoneRole = guild.roles.everyone;
    const perms = canal.permissionsFor(everyoneRole);
    if (!perms) return false;
    return !perms.has(PermissionFlagsBits.ViewChannel);
}

/**
 * Escanea y clasifica los canales del servidor en públicos (texto y voz) y privados/staff.
 */
async function analizarCanales(guild) {
    // Asegurar que la caché de canales esté completa
    const canales = await guild.channels.fetch().catch(() => guild.channels.cache);

    const publicosTexto = [];
    const publicosVoz = [];
    const privados = [];

    for (const canal of canales.values()) {
        if (!canal) continue;
        // Ignorar categorías y hilos
        if (canal.type === ChannelType.GuildCategory || canal.isThread()) continue;

        if (esCanalPrivado(canal, guild)) {
            privados.push(canal);
        } else if (canal.isTextBased() && canal.type === ChannelType.GuildText) {
            publicosTexto.push(canal);
        } else if (canal.isVoiceBased()) {
            publicosVoz.push(canal);
        }
    }

    return {
        publicosTexto,
        publicosVoz,
        privados,
        total: publicosTexto.length + publicosVoz.length + privados.length,
    };
}

/**
 * Construye el embed y botones del panel de control de lockdown.
 */
async function construirPanelLockdown(guild) {
    const analisis = await analizarCanales(guild);
    const estadoDoc = await Lockdown.findOne({ guildId: guild.id });
    const estaActivo = Boolean(estadoDoc?.activo);

    let estadoStr = '';
    let colorEmbed = COLORES.azul;

    if (estaActivo) {
        estadoStr = '🔴 **ESTADO: BLOQUEO ACTIVO (LOCKDOWN)**\n' +
            '> ⚠️ *Nadie con rol estándar puede enviar mensajes de texto ni conectarse a salas de voz.*\n' +
            `> Activado por: <@${estadoDoc.activadoPor}> (${estadoDoc.fechaActivacion ? new Date(estadoDoc.fechaActivacion).toLocaleTimeString() : 'Reciente'})`;
        colorEmbed = COLORES.rojo;
    } else {
        estadoStr = '🟢 **ESTADO: NORMAL (DESBLOQUEADO)**\n' +
            '> ✨ *El servidor se encuentra operando normalmente. Los canales públicos están abiertos a la comunidad.*';
        colorEmbed = COLORES.verde;
    }

    let desc = `### 🛡️ Panel de Control de Bloqueo de Emergencia\n\n${estadoStr}\n\n`;
    desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    desc += '### 📊 Análisis de Canales del Servidor:\n';
    desc += `📢 **Canales Públicos de Texto:** \`${analisis.publicosTexto.length}\` canales\n`;
    desc += `🔊 **Canales Públicos de Voz:** \`${analisis.publicosVoz.length}\` canales\n`;
    desc += `🔒 **Canales Privados / Staff:** \`${analisis.privados.length}\` canales *(Protegidos y excluidos del bloqueo)*\n`;
    desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    desc += estaActivo
        ? '👇 *Pulsa el botón verde para levantar el bloqueo y devolver los canales públicos a la normalidad:*'
        : '👇 *Pulsa el botón rojo si necesitas cerrar temporalmente el servidor para que nadie pueda escribir ni unirse a voz:*';

    const embed = basePremium('🛡️ Control de Seguridad y Bloqueo del Servidor', desc, colorEmbed);
    embed.setFooter({ text: '⚡ Antigravity Security • Modificación instantánea de permisos' });

    const botonPrincipal = estaActivo
        ? new ButtonBuilder()
            .setCustomId('lockdown:desactivar:todos')
            .setLabel('Levantar Bloqueo (Volver a la Normalidad)')
            .setEmoji('🔓')
            .setStyle(ButtonStyle.Success)
        : new ButtonBuilder()
            .setCustomId('lockdown:activar:todos')
            .setLabel('Activar Bloqueo Total (Nadie escribe ni entra a VC)')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger);

    const botonEscanear = new ButtonBuilder()
        .setCustomId('lockdown:escanear:todos')
        .setLabel('Escanear Canales')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary);

    const fila = new ActionRowBuilder().addComponents(botonPrincipal, botonEscanear);

    return { embeds: [embed], components: [fila] };
}

/**
 * Activa el bloqueo masivo en todos los canales públicos sin tocar los canales privados.
 */
async function activarLockdown(guild, userId) {
    const analisis = await analizarCanales(guild);
    const everyoneRole = guild.roles.everyone;
    const bloqueadosIds = [];

    const motivo = `Lockdown de emergencia activado por admin ${userId}`;

    // 1. Bloquear canales públicos de texto (nadie puede enviar mensajes)
    for (const canal of analisis.publicosTexto) {
        try {
            await canal.permissionOverwrites.edit(
                everyoneRole,
                {
                    SendMessages: false,
                    SendMessagesInThreads: false,
                    CreatePublicThreads: false,
                    CreatePrivateThreads: false,
                },
                { reason: motivo }
            );
            bloqueadosIds.push(canal.id);
        } catch (err) {
            console.error(`⚠️ Error bloqueando canal de texto ${canal.name}:`, err?.message || err);
        }
    }

    // 2. Bloquear canales públicos de voz (nadie puede conectarse ni hablar)
    for (const canal of analisis.publicosVoz) {
        try {
            await canal.permissionOverwrites.edit(
                everyoneRole,
                {
                    Connect: false,
                    Speak: false,
                },
                { reason: motivo }
            );
            bloqueadosIds.push(canal.id);
        } catch (err) {
            console.error(`⚠️ Error bloqueando canal de voz ${canal.name}:`, err?.message || err);
        }
    }

    await Lockdown.findOneAndUpdate(
        { guildId: guild.id },
        {
            $set: {
                activo: true,
                activadoPor: userId,
                fechaActivacion: new Date(),
                canalesBloqueadosIds: bloqueadosIds,
            },
        },
        { upsert: true, new: true }
    );

    return {
        ok: true,
        bloqueados: bloqueadosIds.length,
        privadosProtegidos: analisis.privados.length,
    };
}

/**
 * Desactiva el bloqueo y devuelve los permisos a su estado normal.
 */
async function desactivarLockdown(guild, userId) {
    const everyoneRole = guild.roles.everyone;
    const estado = await Lockdown.findOne({ guildId: guild.id });
    const canalesIds = estado?.canalesBloqueadosIds || [];

    const motivo = `Lockdown levantado por admin ${userId}`;
    let restaurados = 0;

    // Obtener canales actuales
    const canales = await guild.channels.fetch().catch(() => guild.channels.cache);

    for (const id of canalesIds) {
        const canal = canales.get(id);
        if (!canal) continue;

        try {
            if (canal.isTextBased() && canal.type === ChannelType.GuildText) {
                // Al poner null se remueve el overwrite explícito y vuelve a la normalidad del servidor
                await canal.permissionOverwrites.edit(
                    everyoneRole,
                    {
                        SendMessages: null,
                        SendMessagesInThreads: null,
                        CreatePublicThreads: null,
                        CreatePrivateThreads: null,
                    },
                    { reason: motivo }
                );
                restaurados++;
            } else if (canal.isVoiceBased()) {
                await canal.permissionOverwrites.edit(
                    everyoneRole,
                    {
                        Connect: null,
                        Speak: null,
                    },
                    { reason: motivo }
                );
                restaurados++;
            }
        } catch (err) {
            console.error(`⚠️ Error restaurando canal ${canal.name}:`, err?.message || err);
        }
    }

    await Lockdown.findOneAndUpdate(
        { guildId: guild.id },
        {
            $set: {
                activo: false,
                canalesBloqueadosIds: [],
            },
        }
    );

    return {
        ok: true,
        restaurados,
    };
}

module.exports = {
    esCanalPrivado,
    analizarCanales,
    construirPanelLockdown,
    activarLockdown,
    desactivarLockdown,
};

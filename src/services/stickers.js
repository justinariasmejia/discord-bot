// src/services/stickers.js
// Servicio central para extracción, adición a servidor y archivado en bóveda de stickers y emojis.
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
} = require('discord.js');
const ConfigEvento = require('../models/ConfigEvento');
const { basePremium, COLORES } = require('../utils/embeds');

// ── 1. Extraer sticker, emoji o imagen de un mensaje ──
function extraerDeMensaje(message) {
    if (!message) return null;

    // A. Stickers de Discord (prioridad máxima)
    if (message.stickers && message.stickers.size > 0) {
        const st = message.stickers.first();
        const ext = st.format === 4 ? 'gif' : st.format === 3 ? 'json' : 'png';
        const url = `https://cdn.discordapp.com/stickers/${st.id}.${ext}`;
        return {
            tipo: 'sticker',
            id: st.id,
            name: st.name || 'sticker_robado',
            format: st.format,
            url,
            animado: st.format === 2 || st.format === 4,
            extension: ext,
        };
    }

    // B. Emojis personalizados en el texto (<:nombre:id> o <a:nombre:id>)
    if (message.content) {
        const emojiMatch = message.content.match(/<(?<anim>a)?:(?<name>\w+):(?<id>\d+)>/);
        if (emojiMatch && emojiMatch.groups) {
            const { anim, name, id } = emojiMatch.groups;
            const ext = anim ? 'gif' : 'png';
            const url = `https://cdn.discordapp.com/emojis/${id}.${ext}`;
            return {
                tipo: 'emoji',
                id,
                name,
                format: anim ? 'GIF' : 'PNG',
                url,
                animado: !!anim,
                extension: ext,
            };
        }
    }

    // C. Imágenes adjuntas (.png, .jpg, .webp, .gif)
    if (message.attachments && message.attachments.size > 0) {
        const att = message.attachments.first();
        const isImage = att.contentType?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(att.name || '');
        if (isImage) {
            const nombreLimpio = (att.name || 'imagen').replace(/\.[^/.]+$/, '');
            return {
                tipo: 'imagen',
                id: att.id,
                name: nombreLimpio,
                format: att.contentType?.split('/')[1]?.toUpperCase() || 'PNG',
                url: att.url,
                animado: att.name?.endsWith('.gif') || att.contentType === 'image/gif',
                extension: att.name?.endsWith('.gif') ? 'gif' : 'png',
            };
        }
    }

    return null;
}

// ── 2. Agregar Sticker o Emoji al Servidor ──
async function agregarAServidor(guild, datos, nuevoNombre, usuarioTag = '') {
    if (!guild) return { exito: false, motivo: 'SIN_GUILD' };

    const me = guild.members.me;
    const tienePermisos = me?.permissions?.has(PermissionFlagsBits.ManageGuildExpressions)
        || me?.permissions?.has(PermissionFlagsBits.ManageEmojisAndStickers);

    if (!tienePermisos) {
        return { exito: false, motivo: 'SIN_PERMISOS' };
    }

    // Normalizar nombre: 2 a 30 caracteres, alfanumérico y guiones bajos
    let nombreFinal = (nuevoNombre || datos.name || 'sticker')
        .trim()
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .slice(0, 30);
    if (nombreFinal.length < 2) nombreFinal = (nombreFinal + '_st').slice(0, 30);

    // Caso A: Sticker o Imagen convertida a sticker
    if (datos.tipo === 'sticker' || datos.tipo === 'imagen') {
        const tier = guild.premiumTier || 0;
        const maxStickers = tier === 3 ? 60 : tier === 2 ? 30 : tier === 1 ? 15 : 5;

        let actuales = 0;
        try {
            const stickersGuild = await guild.stickers.fetch();
            actuales = stickersGuild.size;
        } catch {
            actuales = guild.stickers.cache.size;
        }

        if (actuales >= maxStickers) {
            return {
                exito: false,
                motivo: 'LIMITE_ALCANZADO',
                actuales,
                max: maxStickers,
            };
        }

        try {
            const stickerCreado = await guild.stickers.create({
                file: datos.url,
                name: nombreFinal,
                tags: '🎃',
                description: `Robado por ${usuarioTag || 'La Cripta'}`.slice(0, 100),
            });

            return {
                exito: true,
                item: stickerCreado,
                tipo: 'sticker',
                nombre: nombreFinal,
                disponibles: maxStickers - actuales - 1,
            };
        } catch (err) {
            console.error('Error creando sticker en guild:', err);
            return { exito: false, motivo: 'ERROR_DISCORD', error: err?.message || err };
        }
    }

    // Caso B: Emoji
    if (datos.tipo === 'emoji') {
        const tier = guild.premiumTier || 0;
        const maxEmojis = tier === 3 ? 250 : tier === 2 ? 150 : tier === 1 ? 100 : 50;

        let actuales = 0;
        try {
            const emojisGuild = await guild.emojis.fetch();
            actuales = datos.animado
                ? emojisGuild.filter((e) => e.animated).size
                : emojisGuild.filter((e) => !e.animated).size;
        } catch {
            actuales = datos.animado
                ? guild.emojis.cache.filter((e) => e.animated).size
                : guild.emojis.cache.filter((e) => !e.animated).size;
        }

        if (actuales >= maxEmojis) {
            return {
                exito: false,
                motivo: 'LIMITE_ALCANZADO',
                actuales,
                max: maxEmojis,
            };
        }

        try {
            const emojiCreado = await guild.emojis.create({
                attachment: datos.url,
                name: nombreFinal,
                reason: `Robado por ${usuarioTag || 'La Cripta'}`,
            });

            return {
                exito: true,
                item: emojiCreado,
                tipo: 'emoji',
                nombre: nombreFinal,
                disponibles: maxEmojis - actuales - 1,
            };
        } catch (err) {
            console.error('Error creando emoji en guild:', err);
            return { exito: false, motivo: 'ERROR_DISCORD', error: err?.message || err };
        }
    }

    return { exito: false, motivo: 'TIPO_DESCONOCIDO' };
}

// ── 3. Guardar en Canal Bóveda (si está configurado) ──
async function guardarEnBoveda(guild, datos, usuario, resultadoServidor) {
    if (!guild) return null;

    try {
        const config = await ConfigEvento.findOne({ guildId: guild.id }).lean();
        if (!config || !config.canalStickersId) return null;

        const canalBoveda = guild.channels.cache.get(config.canalStickersId)
            || await guild.channels.fetch(config.canalStickersId).catch(() => null);

        if (!canalBoveda) return null;

        const embedBoveda = basePremium(
            `📦 Bóveda de Stickers • ${datos.name}`,
            `👤 **Robado por:** ${usuario}\n` +
            `🏷️ **Tipo:** \`${datos.tipo.toUpperCase()}\`  •  🎨 **Formato:** \`${datos.animado ? 'Animado' : 'Estático'}\`\n` +
            `🆔 **ID:** \`${datos.id}\`\n` +
            (resultadoServidor?.exito
                ? `✅ **Instalado en Servidor:** \`:${resultadoServidor.nombre}:\``
                : `⏳ **Guardado para instalación manual**`),
            COLORES.teal
        );

        embedBoveda.setImage(datos.url);
        embedBoveda.setFooter({
            text: `Bóveda de Expresiones • ${guild.name}`,
            iconURL: usuario.displayAvatarURL?.() || undefined,
        });

        const filaBoveda = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Descargar Archivo')
                .setEmoji('💾')
                .setStyle(ButtonStyle.Link)
                .setURL(datos.url)
        );

        // Si aún no se ha agregado al servidor, agregar botón interactivo
        if (!resultadoServidor?.exito) {
            filaBoveda.addComponents(
                new ButtonBuilder()
                    .setCustomId(`stickers:add:${usuario.id}:${datos.id}`)
                    .setLabel('Agregar a Servidor')
                    .setEmoji('📥')
                    .setStyle(ButtonStyle.Success)
            );
        }

        const msgBoveda = await canalBoveda.send({
            embeds: [embedBoveda],
            components: [filaBoveda],
        });

        return { canalId: canalBoveda.id, mensajeId: msgBoveda.id };
    } catch (err) {
        console.error('Error guardando en bóveda:', err);
        return null;
    }
}

// ── 4. Flujo Maestro de Robo (Utilizado por Slash, Context Menu y Prefix) ──
async function procesarRobo({
    guild,
    targetMessage,
    usuario,
    nuevoNombre = '',
    modo = 'todo', // 'todo' | 'solo_servidor' | 'solo_boveda'
}) {
    const datos = extraerDeMensaje(targetMessage);
    if (!datos) {
        return {
            error: true,
            mensaje: '❌ No se encontró ningún **sticker**, **emoji personalizado** ni **imagen** en el mensaje seleccionado.',
        };
    }

    let resultadoServidor = null;

    // Intentar agregar al servidor (salvo si el modo es 'solo_boveda')
    if (modo !== 'solo_boveda') {
        resultadoServidor = await agregarAServidor(guild, datos, nuevoNombre, usuario.tag);
    }

    // Guardar en la bóveda de stickers
    const resBoveda = await guardarEnBoveda(guild, datos, usuario, resultadoServidor);

    // ── Construir Embed de Respuesta al Usuario ──
    let desc = '';
    let color = COLORES.verde;

    if (resultadoServidor?.exito) {
        desc += `### 🎉 ¡Sticker añadido con éxito al servidor!\n` +
                `🏷️ **Nombre en el servidor:** \`:${resultadoServidor.nombre}:\`\n` +
                `📦 **Espacios restantes:** \`${resultadoServidor.disponibles}\` libres\n\n`;
    } else if (resultadoServidor?.motivo === 'LIMITE_ALCANZADO') {
        color = COLORES.naranja;
        desc += `### ⚠️ El servidor alcanzó el límite de stickers (${resultadoServidor.actuales}/${resultadoServidor.max})\n` +
                `No hay espacios libres en este momento para instalarlo automáticamente.\n\n`;
    } else if (resultadoServidor?.motivo === 'SIN_PERMISOS') {
        color = COLORES.naranja;
        desc += `### ⚠️ El bot no tiene permisos de gestionar expresiones\n` +
                `Se requiere el permiso **Gestionar Emojis y Stickers** en el rol del bot.\n\n`;
    } else if (resultadoServidor?.motivo === 'ERROR_DISCORD') {
        color = COLORES.rojo;
        desc += `### ❌ No se pudo subir el sticker a Discord\n` +
                `Detalle: \`${resultadoServidor.error}\`\n\n`;
    }

    if (resBoveda) {
        desc += `💾 **Guardado en la Bóveda:** <#${resBoveda.canalId}> para que nunca se pierda.`;
    } else if (!resultadoServidor?.exito) {
        desc += `💡 *Consejo:* Configura un canal con \`/admin canal_stickers\` para guardar automáticamente los stickers en una bóveda cuando el servidor esté lleno.`;
    }

    const embed = basePremium(
        `📥 Sticker Robado • ${nuevoNombre || datos.name}`,
        desc,
        color
    );

    // Carátula en grande para que se aprecie con la máxima calidad
    embed.setImage(datos.url);
    embed.setFooter({
        text: `Robado por ${usuario.tag} • Formato: ${datos.extension.toUpperCase()}`,
        iconURL: usuario.displayAvatarURL(),
    });

    const filaBotones = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('Descargar Archivo')
            .setEmoji('💾')
            .setStyle(ButtonStyle.Link)
            .setURL(datos.url)
    );

    if (resBoveda) {
        filaBotones.addComponents(
            new ButtonBuilder()
                .setLabel('Ir a la Bóveda')
                .setEmoji('📁')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${guild.id}/${resBoveda.canalId}/${resBoveda.mensajeId}`)
        );
    } else if (!resultadoServidor?.exito) {
        filaBotones.addComponents(
            new ButtonBuilder()
                .setCustomId(`stickers:add:${usuario.id}:${datos.id}`)
                .setLabel('Reintentar Agregar')
                .setEmoji('📥')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    return {
        error: false,
        embeds: [embed],
        components: [filaBotones],
        datos,
        resultadoServidor,
        resBoveda,
    };
}

module.exports = {
    extraerDeMensaje,
    agregarAServidor,
    guardarEnBoveda,
    procesarRobo,
};

// src/interactions/stickers.js
// Manejador de botones interactivos para el sistema de stickers y emojis.
const {
    PermissionFlagsBits,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const { agregarAServidor } = require('../services/stickers');
const { basePremium, COLORES } = require('../utils/embeds');
const { esSuperAdmin } = require('../services/evento');

module.exports = {
    prefijo: 'stickers',

    async ejecutar(interaction, partes, client) {
        const accion = partes[1];
        const guild = interaction.guild;
        const miembro = interaction.member;

        // Verificar permisos de administración de expresiones
        const tienePermiso = esSuperAdmin(miembro?.id)
            || miembro.permissions.has(PermissionFlagsBits.ManageGuildExpressions)
            || miembro.permissions.has(PermissionFlagsBits.ManageEmojisAndStickers)
            || miembro.permissions.has(PermissionFlagsBits.Administrator);

        if (!tienePermiso) {
            return interaction.reply({
                embeds: [basePremium('❌ Permiso Denegado', 'Necesitas el permiso **Gestionar Emojis y Stickers** para agregar expresiones al servidor.', COLORES.rojo)],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (accion === 'add') {
            await interaction.deferUpdate();

            // Obtener la URL del sticker del embed o del mensaje
            const embed = interaction.message.embeds?.[0];
            const imagenUrl = embed?.image?.url || embed?.thumbnail?.url;
            const titulo = embed?.title || '';
            const nombreRaw = titulo.split('•')[1]?.trim() || 'sticker_robado';

            if (!imagenUrl) {
                return interaction.followUp({
                    embeds: [basePremium('❌ Error', 'No se pudo obtener la imagen del sticker para agregarlo.', COLORES.rojo)],
                    flags: MessageFlags.Ephemeral,
                });
            }

            const datos = {
                tipo: imagenUrl.includes('/emojis/') ? 'emoji' : 'sticker',
                name: nombreRaw,
                url: imagenUrl,
                animado: imagenUrl.endsWith('.gif'),
            };

            const resultado = await agregarAServidor(guild, datos, nombreRaw, interaction.user.tag);

            if (resultado.exito) {
                // Actualizar los botones del mensaje original
                const fila = ActionRowBuilder.from(interaction.message.components[0]);
                fila.components.forEach((btn) => {
                    if (btn.data.custom_id?.startsWith('stickers:add')) {
                        btn.setDisabled(true).setLabel('Instalado en Servidor').setStyle(ButtonStyle.Success);
                    }
                });

                await interaction.editReply({ components: [fila] }).catch(() => {});

                return interaction.followUp({
                    embeds: [basePremium(
                        '✅ Sticker Añadido',
                        `El sticker **:${resultado.nombre}:** ha sido instalado exitosamente en **${guild.name}**.\nEspacios restantes: \`${resultado.disponibles}\``,
                        COLORES.verde
                    )],
                    flags: MessageFlags.Ephemeral,
                });
            } else {
                let mensajeError = 'No se pudo agregar el sticker al servidor.';
                if (resultado.motivo === 'LIMITE_ALCANZADO') {
                    mensajeError = `El servidor alcanzó el límite máximo de stickers (${resultado.actuales}/${resultado.max}). Libera un espacio para poder instalarlo.`;
                } else if (resultado.motivo === 'SIN_PERMISOS') {
                    mensajeError = 'El bot no tiene permisos suficientes para gestionar emojis y stickers.';
                } else if (resultado.error) {
                    mensajeError = `Error de Discord: ${resultado.error}`;
                }

                return interaction.followUp({
                    embeds: [basePremium('⚠️ No se pudo agregar', mensajeError, COLORES.naranja)],
                    flags: MessageFlags.Ephemeral,
                });
            }
        }
    },
};

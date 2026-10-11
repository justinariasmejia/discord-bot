// src/commands/steal.js
// Comando slash para robar y extraer stickers y emojis.
const {
    SlashCommandBuilder,
    MessageFlags,
} = require('discord.js');
const { procesarRobo } = require('../services/stickers');
const { basePremium, COLORES } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('steal')
        .setDescription('📥 Extrae y roba un sticker o emoji para agregarlo al servidor o bóveda')
        .addStringOption((opt) =>
            opt
                .setName('mensaje')
                .setDescription('Enlace o ID del mensaje que tiene el sticker (opcional: busca el último enviado)')
                .setRequired(false)
        )
        .addStringOption((opt) =>
            opt
                .setName('nombre')
                .setDescription('Nombre personalizado que tendrá el sticker en tu servidor')
                .setRequired(false)
        )
        .addStringOption((opt) =>
            opt
                .setName('destino')
                .setDescription('Dónde guardar la expresión')
                .setRequired(false)
                .addChoices(
                    { name: '🌐 Ambos (Servidor + Bóveda)', value: 'todo' },
                    { name: '📥 Solo Servidor', value: 'solo_servidor' },
                    { name: '📁 Solo Bóveda (Guardar)', value: 'solo_boveda' }
                )
        ),

    async ejecutar(interaction, client) {
        await interaction.deferReply();

        const inputMensaje = interaction.options.getString('mensaje');
        const nuevoNombre = interaction.options.getString('nombre') || '';
        const modo = interaction.options.getString('destino') || 'todo';

        let targetMessage = null;

        // 1. Si el usuario proporcionó enlace o ID de mensaje
        if (inputMensaje) {
            let msgId = inputMensaje.trim();
            const linkMatch = msgId.match(/channels\/\d+\/\d+\/(?<id>\d+)/);
            if (linkMatch?.groups?.id) {
                msgId = linkMatch.groups.id;
            }

            try {
                targetMessage = await interaction.channel.messages.fetch(msgId);
            } catch {
                return interaction.editReply({
                    embeds: [basePremium('❌ Mensaje no Encontrado', `No se pudo encontrar el mensaje con ID: \`${msgId}\` en este canal.`, COLORES.rojo)],
                });
            }
        } else {
            // 2. Si no se especificó, buscar en los últimos 20 mensajes del canal el más reciente con sticker o emoji
            try {
                const recientes = await interaction.channel.messages.fetch({ limit: 20 });
                for (const m of recientes.values()) {
                    if (m.id === interaction.id) continue;
                    if (m.stickers?.size > 0 || m.attachments?.size > 0 || (m.content && /<a?:\w+:\d+>/.test(m.content))) {
                        targetMessage = m;
                        break;
                    }
                }
            } catch (err) {
                console.error('Error buscando mensajes recientes:', err);
            }
        }

        if (!targetMessage) {
            return interaction.editReply({
                embeds: [basePremium(
                    '🔍 Ningún Sticker Encontrado',
                    'No se encontró ningún sticker o emoji reciente en este canal.\n\n' +
                    '💡 **Formas de usarlo:**\n' +
                    '• Usa `/steal mensaje: <enlace_o_id>`\n' +
                    '• Responde directamente al mensaje del sticker escribiendo `!st` o `!steal [nombre]`\n' +
                    '• Haz clic derecho en el mensaje -> **Apps** -> **Robar Sticker**',
                    COLORES.naranja
                )],
            });
        }

        const resultado = await procesarRobo({
            guild: interaction.guild,
            targetMessage,
            usuario: interaction.user,
            nuevoNombre,
            modo,
        });

        if (resultado.error) {
            return interaction.editReply({
                embeds: [basePremium('❌ Error al Robar', resultado.mensaje, COLORES.rojo)],
            });
        }

        return interaction.editReply({
            embeds: resultado.embeds,
            components: resultado.components,
        });
    },
};

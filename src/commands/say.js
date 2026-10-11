// /say → abre un modal; lo escrito lo envía el bot al canal.
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags,
} = require('discord.js');

const { esSuperAdmin } = require('../services/evento');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('📝 Abre una ventana para escribir un mensaje que el bot enviará'),

    async ejecutar(interaction) {
        if (!esSuperAdmin(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({
                content: '❌ No tienes permisos para usar esta función.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const modal = new ModalBuilder().setCustomId('say:modal').setTitle('📝 Enviar mensaje como bot');

        const input = new TextInputBuilder()
            .setCustomId('contenido')
            .setLabel('¿Qué quieres que diga el bot?')
            .setPlaceholder('Escribe tu mensaje aquí...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(2000);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    },
};

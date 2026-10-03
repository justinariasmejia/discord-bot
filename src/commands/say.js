// /say → abre un modal; lo escrito lo envía el bot al canal.
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('📝 Abre una ventana para escribir un mensaje que el bot enviará')
        // Por defecto solo quien pueda gestionar mensajes (se puede cambiar en Ajustes del servidor > Integraciones)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async ejecutar(interaction) {
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

// src/commands/duelo.js
// Comando /duelo para retarse por huesos.
const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags,
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('duelo')
        .setDescription('⚔️ Desafía a otro cazador a un duelo de reflejos por huesos')
        .addUserOption((opt) =>
            opt.setName('usuario').setDescription('El cazador al que deseas desafiar').setRequired(true)
        ),

    async ejecutar(interaction) {
        const rival = interaction.options.getUser('usuario');

        if (rival.id === interaction.user.id) {
            return interaction.reply({
                content: '💀 No puedes retarte en duelo a ti mismo.',
                flags: MessageFlags.Ephemeral,
            });
        }

        if (rival.bot) {
            return interaction.reply({
                content: '🤖 Los autómatas no tienen alma ni huesos para apostar.',
                flags: MessageFlags.Ephemeral,
            });
        }

        // Abre el modal como respuesta inmediata
        const modal = new ModalBuilder()
            .setCustomId(`duelo:modal_crear:${interaction.user.id}:${rival.id}`)
            .setTitle(`⚔️ Duelo vs ${rival.username.slice(0, 20)}`);

        const inputMonto = new TextInputBuilder()
            .setCustomId('monto')
            .setLabel('¿Cuántos huesos apuestas?')
            .setPlaceholder('Mínimo 10 huesos')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(6);

        modal.addComponents(new ActionRowBuilder().addComponents(inputMonto));
        await interaction.showModal(modal);
    },
};

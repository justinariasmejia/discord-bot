// src/commands/ayuda.js
// Comando /ayuda para explicar la dinámica y reglas del evento de Halloween.
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { panelAyuda } = require('../utils/paneles');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ayuda')
        .setDescription('🎃 Guía completa: cómo ganar huesos, actividades, minijuegos y reglas')
        .addBooleanOption((opt) =>
            opt
                .setName('compartir')
                .setDescription('¿Mostrar la guía públicamente a todos en el canal? (Por defecto: solo tú)')
        ),

    async ejecutar(interaction) {
        const compartir = interaction.options.getBoolean('compartir') || false;

        if (!compartir) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        } else {
            await interaction.deferReply();
        }

        const panel = panelAyuda(interaction.user.id);
        await interaction.editReply(panel);
    },
};

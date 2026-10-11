// src/commands/lockdown.js
// Comando para auditar la privacidad de canales y activar/desactivar el bloqueo general del servidor.
const {
    SlashCommandBuilder,
    MessageFlags,
} = require('discord.js');
const { esAdminAsync } = require('../services/evento');
const { construirPanelLockdown } = require('../services/lockdown');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lockdown')
        .setDescription('🛡️ Analiza canales públicos/privados y controla el bloqueo total de emergencia'),

    async ejecutar(interaction, client) {
        const autorizado = await esAdminAsync(interaction.member, interaction.guildId);
        if (!autorizado) {
            return interaction.reply({
                content: '🔒 No tienes permisos de administración para acceder al control de bloqueo del servidor.',
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply();
        const payload = await construirPanelLockdown(interaction.guild);
        return interaction.editReply(payload);
    },
};

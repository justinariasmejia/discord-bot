// src/interactions/lockdown.js
// Manejador de los botones interactivos del panel de Lockdown.
const { MessageFlags } = require('discord.js');
const { esAdminAsync } = require('../services/evento');
const {
    construirPanelLockdown,
    activarLockdown,
    desactivarLockdown,
} = require('../services/lockdown');

module.exports = {
    prefijo: 'lockdown',

    async ejecutar(interaction, partes) {
        const accion = partes[1];

        const autorizado = await esAdminAsync(interaction.member, interaction.guildId);
        if (!autorizado) {
            return interaction.reply({
                content: '🔒 No tienes autorización para modificar la seguridad del servidor.',
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferUpdate();

        if (accion === 'activar') {
            await activarLockdown(interaction.guild, interaction.user.id);
        } else if (accion === 'desactivar') {
            await desactivarLockdown(interaction.guild, interaction.user.id);
        }

        const payload = await construirPanelLockdown(interaction.guild);
        return interaction.editReply(payload);
    },
};

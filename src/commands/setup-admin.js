// src/commands/setup-admin.js
// Comando para fijar el canal permanente del Panel Maestro de Administración
const {
    SlashCommandBuilder,
    ChannelType,
    MessageFlags,
} = require('discord.js');
const { configurarCanalAdminPanel } = require('../services/panelAdmin');
const { basePremium, COLORES } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-admin')
        .setDescription('👑 Configura el canal permanente del Panel Maestro de Administración')
        .addChannelOption((opt) =>
            opt.setName('canal')
                .setDescription('Canal de texto donde se fijará el panel maestro permanente de administración')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        ),

    async ejecutar(interaction, client) {
        const { esAdminAsync } = require('../services/evento');
        const autorizado = await esAdminAsync(interaction.member, interaction.guildId);
        if (!autorizado) {
            return interaction.reply({
                content: '🔒 No tienes permisos de administración ni un rol autorizado para configurar este panel.',
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const canal = interaction.options.getChannel('canal');

        try {
            await configurarCanalAdminPanel(interaction.guildId, canal.id, client);
            return interaction.editReply({
                embeds: [basePremium(
                    '✅ Panel Maestro de Administración Configurado',
                    `El centro de mando permanente de administración y moderación ha sido fijado en ${canal}.\n\n` +
                    '✨ **Características activas:**\n' +
                    '• **Panel Interactivo Permanente:** Los administradores y moderadores pueden gestionar todo el sistema sin escribir comandos.\n' +
                    '• **Acciones Rápidas:** Controla mantenimiento, otorga/descuenta huesos, lanza drops/sorteos, fuerza eventos (incluyendo Oogie Boogie) y gestiona backups.\n' +
                    '• **Canal Limpio y Seguro:** Las interacciones responden de forma efímera para mantener el canal siempre ordenado y fijo.',
                    COLORES.morado
                )],
            });
        } catch (err) {
            console.error('Error en setup-admin:', err);
            return interaction.editReply({
                embeds: [basePremium('❌ Error al configurar', 'Hubo un error al fijar el panel en el canal. Verifica los permisos del bot.', COLORES.rojo)],
            });
        }
    },
};

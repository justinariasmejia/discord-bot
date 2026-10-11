// src/commands/setup-cripta.js
// Comando para fijar el panel permanente de La Cripta de los Huesos
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
} = require('discord.js');
const { configurarCanalCripta } = require('../services/canalCripta');
const { basePremium, COLORES } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-cripta')
        .setDescription('🎃 Configura el canal permanente de La Cripta con Ranking en vivo y botones')
        .addChannelOption((opt) =>
            opt.setName('canal')
                .setDescription('Canal de texto donde se fijará el centro de mando y ranking en vivo')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        ),

    async ejecutar(interaction, client) {
        const { esAdminAsync } = require('../services/evento');
        const autorizado = await esAdminAsync(interaction.member, interaction.guildId);
        if (!autorizado) {
            return interaction.reply({
                content: '🔒 No tienes permisos de administración ni un rol autorizado para configurar este canal.',
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const canal = interaction.options.getChannel('canal');

        try {
            await configurarCanalCripta(interaction.guildId, canal.id, client);
            return interaction.editReply({
                embeds: [basePremium(
                    '✅ Panel Maestro de La Cripta Configurado',
                    `El centro de mando interactivo en vivo ha sido fijado en ${canal}.\n\n` +
                    '✨ **Características activas en este canal:**\n' +
                    '• **Ranking en Tiempo Real:** El Top 10 se muestra arriba en vivo y se actualiza instantáneamente con cada cambio de huesos.\n' +
                    '• **Sin Escribir Comandos:** Los usuarios interactúan directamente con los botones del mensaje (`Cazar`, `Diario`, `Apostar`, `Duelo`, `Mi Perfil`).\n' +
                    '• **Canal Limpio:** El bot elimina automáticamente cualquier mensaje de texto que escriban los usuarios para mantener el panel siempre visible y fijo.\n' +
                    '• **Respuestas Privadas:** Cada acción envía respuestas efímeras para no saturar el canal.',
                    COLORES.verde
                )],
            });
        } catch (err) {
            console.error('Error en setup-cripta:', err);
            return interaction.editReply({
                embeds: [basePremium('❌ Error al configurar', 'Hubo un error al fijar el panel en el canal. Revisa los permisos del bot.', COLORES.rojo)],
            });
        }
    },
};

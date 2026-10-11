// src/commands/setup-cumpleanos.js
// Comando para fijar el panel permanente de los 10 cumpleaños más cercanos
const {
    SlashCommandBuilder,
    ChannelType,
    MessageFlags,
} = require('discord.js');
const { configurarCanalCumpleanos } = require('../services/cumpleanos');
const { basePremium, COLORES } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-cumpleanos')
        .setDescription('🎂 Configura el canal permanente del panel de los 10 cumpleaños más cercanos')
        .addChannelOption((opt) =>
            opt.setName('canal')
                .setDescription('Canal de texto donde se fijará el panel interactivo de cumpleaños')
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
            await configurarCanalCumpleanos(interaction.guildId, canal.id, client);
            return interaction.editReply({
                embeds: [basePremium(
                    '✅ Panel Maestro de Cumpleaños Configurado',
                    `El panel interactivo fijo ha sido establecido en ${canal}.\n\n` +
                    '✨ **Características activas:**\n' +
                    '• **Top 10 más cercanos en vivo:** Muestra los 10 cumpleaños más próximos ordenados por días restantes.\n' +
                    '• **Auto-actualización inmediata:** Si un usuario registra o actualiza una fecha más cercana, la lista se actualiza al instante.\n' +
                    '• **Botón interactivo:** Los usuarios pulsan `[🎂 Registrar mi Cumpleaños]` y se abre un modal sin necesidad de comandos.\n' +
                    '• **Felicitaciones automáticas:** Cada día a las 00:00 se felicita al cumpleañero y se le asigna el rol festivo.',
                    COLORES.verde
                )],
            });
        } catch (err) {
            console.error('Error en setup-cumpleanos:', err);
            return interaction.editReply({
                embeds: [basePremium('❌ Error al configurar', 'Hubo un error al fijar el panel en el canal. Revisa los permisos del bot.', COLORES.rojo)],
            });
        }
    },
};

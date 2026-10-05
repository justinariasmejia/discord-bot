// src/commands/setup-musica.js
// Comando para crear o vincular el canal dedicado de música con reproductor permanente y pedidos directos por texto.
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
} = require('discord.js');
const { configurarCanalMusica } = require('../services/canalMusica');
const { basePremium, COLORES } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-musica')
        .setDescription('🎧 Configura el canal dedicado interactivo de música (pedidos directos sin /play)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption((opt) =>
            opt.setName('canal')
                .setDescription('Canal de texto donde se fijará el reproductor y lista en tiempo real')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        ),

    async ejecutar(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const canal = interaction.options.getChannel('canal');

        try {
            await configurarCanalMusica(interaction.guildId, canal.id, client);
            return interaction.editReply({
                embeds: [basePremium(
                    '✅ Canal Dedicado de Música Configurado',
                    `El reproductor maestro en vivo ha sido fijado en ${canal}.\n\n` +
                    '✨ **Características activas en ese canal:**\n' +
                    '• **Pedidos Directos:** Los usuarios pueden escribir nombres de canciones o pegar enlaces sin usar `/play`.\n' +
                    '• **Canal Limpio:** El bot elimina automáticamente los mensajes de texto de los usuarios para no estorbar.\n' +
                    '• **Lista en Tiempo Real:** El cuadro maestro se actualiza en vivo con la canción actual y los próximos temas en cola.\n' +
                    '• **Controles Táctiles:** Botones de pausa, salto, repetición, volumen y menú desplegable para saltar de pista.',
                    COLORES.verde
                )],
            });
        } catch (err) {
            console.error('Error en setup-musica:', err);
            return interaction.editReply({
                embeds: [basePremium('❌ Error al configurar', 'Hubo un error al fijar el reproductor en el canal. Revisa los permisos del bot.', COLORES.rojo)],
            });
        }
    },
};

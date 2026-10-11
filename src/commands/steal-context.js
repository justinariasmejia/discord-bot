// src/commands/steal-context.js
// Comando de Menú Contextual (Clic derecho en mensaje -> Apps -> Robar Sticker).
const {
    ContextMenuCommandBuilder,
    ApplicationCommandType,
} = require('discord.js');
const { procesarRobo } = require('../services/stickers');
const { basePremium, COLORES } = require('../utils/embeds');

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('Robar Sticker')
        .setType(ApplicationCommandType.Message),

    async ejecutar(interaction, client) {
        await interaction.deferReply();

        const targetMessage = interaction.targetMessage;
        if (!targetMessage) {
            return interaction.editReply({
                embeds: [basePremium('❌ Mensaje no Encontrado', 'No se pudo leer el mensaje seleccionado.', COLORES.rojo)],
            });
        }

        const resultado = await procesarRobo({
            guild: interaction.guild,
            targetMessage,
            usuario: interaction.user,
        });

        if (resultado.error) {
            return interaction.editReply({
                embeds: [basePremium('❌ Error al Robar', resultado.mensaje, COLORES.rojo)],
            });
        }

        return interaction.editReply({
            embeds: resultado.embeds,
            components: resultado.components,
        });
    },
};

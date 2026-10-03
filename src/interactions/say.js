// src/interactions/say.js
// Manejador del modal del comando /say.
const { MessageFlags, PermissionFlagsBits } = require('discord.js');

module.exports = {
    prefijo: 'say',

    async ejecutar(interaction, partes) {
        const accion = partes[1];

        if (accion === 'modal') {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({
                    content: '❌ No tienes permisos para usar esta función.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const contenido = interaction.fields.getTextInputValue('contenido');
            if (!contenido || !contenido.trim()) {
                return interaction.reply({
                    content: '❌ El mensaje no puede estar vacío.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            await interaction.channel.send({ content: contenido });
            return interaction.reply({
                content: '✅ Mensaje enviado exitosamente.',
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};

// src/interactions/admin.js
// Manejador de confirmaciones de acciones de seguridad del panel administrativo.
const { MessageFlags } = require('discord.js');
const Usuario = require('../models/Usuario');
const Transaccion = require('../models/Transaccion');
const { base, COLORES } = require('../utils/embeds');

module.exports = {
    prefijo: 'admin',

    async ejecutar(interaction, partes) {
        const accion = partes[1];
        const duenoId = partes[2];

        if (interaction.user.id !== duenoId) {
            return interaction.reply({
                content: '🔒 No tienes permiso para utilizar este botón de confirmación.',
                flags: MessageFlags.Ephemeral,
            });
        }

        if (accion === 'reset_cancelar') {
            return interaction.update({
                content: '✅ Operación cancelada. La economía se mantiene intacta.',
                embeds: [],
                components: [],
            });
        }

        if (accion === 'reset_confirmar') {
            await interaction.deferUpdate();

            // Borrado y reinicio de la colección de usuarios para este servidor
            await Usuario.deleteMany({ guildId: interaction.guildId });
            await Transaccion.deleteMany({ guildId: interaction.guildId });

            const embedFinal = base(
                '💣 ECONOMÍA REINICIADA',
                'Todos los registros de cazadores, inventarios y saldos han sido reseteados a cero en este servidor.',
                COLORES.rojo
            );

            return interaction.editReply({
                embeds: [embedFinal],
                components: [],
            });
        }
    },
};

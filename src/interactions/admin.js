// src/interactions/admin.js
// Manejador de confirmaciones de acciones de seguridad del panel administrativo.
const { MessageFlags } = require('discord.js');
const Usuario = require('../models/Usuario');
const Transaccion = require('../models/Transaccion');
const { basePremium, COLORES } = require('../utils/embeds');
const { logAdmin } = require('../services/logger');

module.exports = {
    prefijo: 'admin',

    async ejecutar(interaction, partes) {
        const accion = partes[1];
        const duenoId = partes[2];

        if (interaction.user.id !== duenoId) {
            return interaction.reply({
                content: '🔒 No tienes permiso para utilizar este botón.',
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

            const totalBorrados = await Usuario.countDocuments({ guildId: interaction.guildId });
            await Usuario.deleteMany({ guildId: interaction.guildId });
            await Transaccion.deleteMany({ guildId: interaction.guildId });

            const embedFinal = basePremium(
                '💣 ECONOMÍA REINICIADA',
                `Se han eliminado **${totalBorrados}** registros de cazadores.\n\n` +
                'Todos los huesos, inventarios, estadísticas y transacciones han sido borrados.',
                COLORES.rojo
            );

            await logAdmin(interaction.guildId, interaction.user.id, 'Reset Economía', `${totalBorrados} cazadores eliminados.`);
            return interaction.editReply({ embeds: [embedFinal], components: [] });
        }
    },
};

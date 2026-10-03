// src/interactions/ruleta_grupal.js
// Manejador de interacciones para la Ruleta Grupal pública.
const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags,
} = require('discord.js');
const { unirseRondaGrupal } = require('../services/ruletaGrupal');
const { formatoNum } = require('../utils/embeds');

module.exports = {
    prefijo: 'ruleta_grupal',

    async ejecutar(interaction, partes) {
        const accion = partes[1];
        const extra = partes[3];

        // ── Botón Unirme / Apostar ──
        if (accion === 'unirse') {
            const rondaId = extra;

            const modal = new ModalBuilder()
                .setCustomId(`ruleta_grupal:modal_apostar:${interaction.user.id}:${rondaId}`)
                .setTitle('🎡 Apostar en Ruleta Grupal');

            const inputMonto = new TextInputBuilder()
                .setCustomId('monto')
                .setLabel('¿Cuántos huesos deseas apostar?')
                .setPlaceholder('Ej: 20 (mínimo 10)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(6);

            modal.addComponents(new ActionRowBuilder().addComponents(inputMonto));
            return interaction.showModal(modal);
        }

        // ── Envío del modal de apuesta ──
        if (accion === 'modal_apostar') {
            const rondaId = extra;
            const montoStr = interaction.fields.getTextInputValue('monto');

            const res = await unirseRondaGrupal(rondaId, interaction.user.id, interaction.guildId, montoStr);

            if (!res.ok) {
                if (res.motivo === 'ronda_inactiva') {
                    return interaction.reply({
                        content: '❌ Esta ronda ya ha finalizado o ha expirado.',
                        flags: MessageFlags.Ephemeral,
                    });
                }
                if (res.motivo === 'monto_invalido') {
                    return interaction.reply({
                        content: `❌ Monto inválido. La apuesta mínima es de **${res.min}** huesos.`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
                if (res.motivo === 'saldo_insuficiente') {
                    return interaction.reply({
                        content: `❌ No tienes suficientes huesos. Saldo actual: **${formatoNum(res.saldo)}** huesos.`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
                if (res.motivo === 'ya_subio') {
                    return interaction.reply({
                        content: '❌ Ya has incrementado tu apuesta una vez en esta ronda (máximo 1 incremento).',
                        flags: MessageFlags.Ephemeral,
                    });
                }
                return interaction.reply({
                    content: '⏳ La Cripta está procesando tu acción. Intenta de nuevo.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            return interaction.reply({
                content: `✅ ¡Apuesta de **${formatoNum(res.monto)}** huesos registrada en la Ruleta Grupal!\nTu saldo actual es de **${formatoNum(res.nuevoSaldo)}** huesos.`,
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};

// src/interactions/ruleta_grupal.js
// Manejador de interacciones para la Ruleta Grupal pública.
// Unirse es en 1 solo clic con ticket de precio fijo y actualización inmediata del pozo.
const { MessageFlags } = require('discord.js');
const { unirseRondaGrupal } = require('../services/ruletaGrupal');
const { formatoNum } = require('../utils/embeds');

module.exports = {
    prefijo: 'ruleta_grupal',

    async ejecutar(interaction, partes) {
        const accion = partes[1];
        const extra = partes[3];

        // ── Botón Unirme (1 solo clic con precio fijo) ──
        if (accion === 'unirse') {
            const rondaId = extra;

            const res = await unirseRondaGrupal(rondaId, interaction.user.id, interaction.guildId, interaction.channel);

            if (!res.ok) {
                if (res.motivo === 'ronda_inactiva') {
                    return interaction.reply({
                        content: '❌ Esta ronda ya ha finalizado o ha expirado.',
                        flags: MessageFlags.Ephemeral,
                    });
                }
                if (res.motivo === 'ya_participa') {
                    return interaction.reply({
                        content: `⚠️ Ya estás registrado en esta ruleta con tu ticket de **${formatoNum(res.precio)}** huesos. Todos los cazadores tienen exactamente 1 ticket para igualdad de condiciones.`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
                if (res.motivo === 'saldo_insuficiente') {
                    return interaction.reply({
                        content: `❌ No tienes suficientes huesos para comprar este ticket. Necesitas **${formatoNum(res.precio)}** huesos (Saldo actual: **${formatoNum(res.saldo)}** 🦴).`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
                return interaction.reply({
                    content: '⏳ La Cripta está procesando tu acción. Intenta de nuevo.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            return interaction.reply({
                content: `✅ ¡Ticket adquirido por **${formatoNum(res.precio)}** huesos!\n` +
                    `💰 El pozo acumulado subió a **${formatoNum(res.nuevoPozo)}** huesos con **${res.totalParticipantes}** participantes.\n` +
                    `🦴 Tu saldo actual es de **${formatoNum(res.nuevoSaldo)}** huesos. ¡Mucha suerte!`,
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};

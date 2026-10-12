// src/interactions/ruleta_grupal.js
// Manejador de interacciones para la Ruleta Grupal pública.
// Optimizado para alta concurrencia con deferReply inmediato para evitar Unknown interaction (10062).
const { MessageFlags } = require('discord.js');
const { unirseRondaGrupal } = require('../services/ruletaGrupal');
const { formatoNum } = require('../utils/embeds');

module.exports = {
    prefijo: 'ruleta_grupal',

    async ejecutar(interaction, partes) {
        const accion = partes[1];
        const extra = partes[3];

        if (accion === 'cerrada') {
            return interaction.reply({
                content: '🛑 Las inscripciones para esta ruleta ya han cerrado. Nadie más puede unirse mientras la ruleta está girando.',
                flags: MessageFlags.Ephemeral,
            }).catch(() => null);
        }

        // ── Botón Unirme (Respuesta diferida inmediata anti-lag) ──
        if (accion === 'unirse') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => null);
            const rondaId = extra;

            const res = await unirseRondaGrupal(rondaId, interaction.user.id, interaction.guildId, interaction.channel);

            if (!res.ok) {
                if (res.motivo === 'inscripciones_cerradas' || res.motivo === 'ronda_inactiva') {
                    return interaction.editReply({
                        content: '🛑 **¡Inscripciones Cerradas!** El minuto de participación ha terminado y la ruleta ya está girando para decidir al ganador. Nadie más puede unirse.',
                    });
                }
                if (res.motivo === 'ya_participa') {
                    return interaction.editReply({
                        content: `⚠️ Ya estás registrado en esta ruleta con tu ticket de **${formatoNum(res.precio)}** huesos. Todos los cazadores tienen exactamente 1 ticket para igualdad de condiciones.`,
                    });
                }
                if (res.motivo === 'saldo_insuficiente') {
                    return interaction.editReply({
                        content: `❌ No tienes suficientes huesos para comprar este ticket. Necesitas **${formatoNum(res.precio)}** huesos (Saldo actual: **${formatoNum(res.saldo)}** 🦴).`,
                    });
                }
                return interaction.editReply({
                    content: '⏳ La Cripta está procesando tu acción. Intenta de nuevo.',
                });
            }

            return interaction.editReply({
                content: `✅ ¡Ticket adquirido por **${formatoNum(res.precio)}** huesos!\n` +
                    `💰 El pozo acumulado subió a **${formatoNum(res.nuevoPozo)}** huesos con **${res.totalParticipantes}** cazadores.\n` +
                    `🦴 Tu saldo actual es de **${formatoNum(res.nuevoSaldo)}** huesos. ¡Mucha suerte!`,
            });
        }
    },
};

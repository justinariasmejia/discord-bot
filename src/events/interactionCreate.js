// Enrutador central de interacciones.
const { MessageFlags } = require('discord.js');
const { embedError } = require('../utils/embeds');

async function responderError(interaction, texto) {
    const payload = { embeds: [embedError(texto)], components: [] };
    try {
        if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
        else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    } catch {
        /* la interacción pudo expirar; no hay nada más que hacer */
    }
}

const COMANDOS_EVENTO = ['cripta', 'duelo', 'ayuda'];
const PREFIJOS_EVENTO = ['cripta', 'duelo', 'evento', 'apuesta', 'ruleta_grupal'];
const { obtenerConfig, puedeInteractuarEvento } = require('../services/evento');

module.exports = {
    name: 'interactionCreate',

    async ejecutar(interaction, client) {
        try {
            // ── Slash commands ──
            if (interaction.isChatInputCommand()) {
                const comando = client.commands.get(interaction.commandName);
                if (!comando) return;
                if (!interaction.inGuild()) {
                    return interaction.reply({ content: 'Este comando solo funciona dentro de un servidor.', flags: MessageFlags.Ephemeral });
                }

                // Verificación de Modo Test para comandos del evento
                if (COMANDOS_EVENTO.includes(interaction.commandName)) {
                    const conf = await obtenerConfig(interaction.guildId);
                    const check = puedeInteractuarEvento(conf, interaction.member, interaction.channelId);
                    if (!check.permitido) {
                        return interaction.reply({ content: check.mensaje, flags: MessageFlags.Ephemeral });
                    }
                }

                return await comando.ejecutar(interaction, client);
            }

            // ── Botones, menús y modales:  prefijo:accion:duenoId:extra ──
            if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
                const partes = interaction.customId.split(':');
                const prefijo = partes[0];
                const handler = client.interacciones.get(prefijo);
                if (!handler) return;

                // Verificación de Modo Test para interacciones del evento
                if (PREFIJOS_EVENTO.includes(prefijo)) {
                    const conf = await obtenerConfig(interaction.guildId);
                    const check = puedeInteractuarEvento(conf, interaction.member, interaction.channelId);
                    if (!check.permitido) {
                        if (interaction.deferred || interaction.replied) {
                            return interaction.editReply({ content: check.mensaje });
                        }
                        return interaction.reply({ content: check.mensaje, flags: MessageFlags.Ephemeral });
                    }
                }

                // Solo quien abrió el panel puede usar sus botones (excepto música y eventos comunitarios abiertos a todos)
                const dueno = partes[2];
                if (prefijo !== 'musica' && dueno && dueno !== 'todos' && /^\d+$/.test(dueno) && dueno !== interaction.user.id) {
                    return interaction.reply({
                        content: '🔒 Este panel no es tuyo. Usa `/cripta` para abrir el tuyo.',
                        flags: MessageFlags.Ephemeral,
                    });
                }
                return await handler.ejecutar(interaction, partes, client);
            }
        } catch (error) {
            console.error('❌ Error en interacción:', error);
            await responderError(interaction, 'Un espíritu travieso interfirió. Inténtalo de nuevo en unos segundos.');
        }
    },
};

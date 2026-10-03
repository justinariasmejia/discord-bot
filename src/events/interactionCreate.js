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
                return await comando.ejecutar(interaction, client);
            }

            // ── Botones, menús y modales:  prefijo:accion:duenoId:extra ──
            if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
                const partes = interaction.customId.split(':');
                const handler = client.interacciones.get(partes[0]);
                if (!handler) return;

                // Solo quien abrió el panel puede usar sus botones
                const dueno = partes[2];
                if (dueno && /^\d+$/.test(dueno) && dueno !== interaction.user.id) {
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

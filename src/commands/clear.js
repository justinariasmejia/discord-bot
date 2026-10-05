const { SlashCommandBuilder } = require('discord.js');
const { ejecutarClear } = require('../services/accionesMusica');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('🧹 Limpia y vacía las canciones en espera de la cola'),

    async ejecutar(interaction, client) {
        return await ejecutarClear(interaction);
    },
};

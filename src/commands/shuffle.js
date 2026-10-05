const { SlashCommandBuilder } = require('discord.js');
const { ejecutarShuffle } = require('../services/accionesMusica');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('🔀 Mezcla aleatoriamente las canciones en la cola'),

    async ejecutar(interaction, client) {
        return await ejecutarShuffle(interaction);
    },
};

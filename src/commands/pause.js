const { SlashCommandBuilder } = require('discord.js');
const { ejecutarPause } = require('../services/accionesMusica');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('⏸️ Pausa la canción actual'),

    async ejecutar(interaction, client) {
        return await ejecutarPause(interaction);
    },
};

const { SlashCommandBuilder } = require('discord.js');
const { ejecutarNp } = require('../services/accionesMusica');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('np')
        .setDescription('🎶 Muestra el reproductor actual con sus controles'),

    async ejecutar(interaction, client) {
        return await ejecutarNp(interaction);
    },
};

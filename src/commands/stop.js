const { SlashCommandBuilder } = require('discord.js');
const { ejecutarStop } = require('../services/accionesMusica');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('⏹️ Detiene la música y desconecta el bot'),

    async ejecutar(interaction, client) {
        return await ejecutarStop(interaction);
    },
};

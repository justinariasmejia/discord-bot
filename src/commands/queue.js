const { SlashCommandBuilder } = require('discord.js');
const { ejecutarQueue } = require('../services/accionesMusica');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('📋 Muestra la cola de reproducción interactiva'),

    async ejecutar(interaction, client) {
        return await ejecutarQueue(interaction);
    },
};

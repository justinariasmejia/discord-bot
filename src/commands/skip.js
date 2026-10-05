const { SlashCommandBuilder } = require('discord.js');
const { ejecutarSkip } = require('../services/accionesMusica');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('⏭️ Salta a la siguiente canción en la cola'),

    async ejecutar(interaction, client) {
        return await ejecutarSkip(interaction);
    },
};

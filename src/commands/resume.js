const { SlashCommandBuilder } = require('discord.js');
const { ejecutarResume } = require('../services/accionesMusica');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('▶️ Reanuda la música pausada'),

    async ejecutar(interaction, client) {
        return await ejecutarResume(interaction);
    },
};

const { SlashCommandBuilder } = require('discord.js');
const { ejecutarLoop } = require('../services/accionesMusica');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('🔁 Alterna el modo de repetición (Off / Canción / Cola)'),

    async ejecutar(interaction, client) {
        return await ejecutarLoop(interaction);
    },
};

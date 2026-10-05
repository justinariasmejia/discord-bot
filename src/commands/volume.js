const { SlashCommandBuilder } = require('discord.js');
const { ejecutarVolume } = require('../services/accionesMusica');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('🔊 Ajusta el volumen de la música (0-150%)')
        .addIntegerOption((opt) =>
            opt.setName('nivel')
                .setDescription('Nivel de volumen (0 a 150)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(150)
        ),

    async ejecutar(interaction, client) {
        const nivel = interaction.options.getInteger('nivel');
        return await ejecutarVolume(interaction, nivel);
    },
};

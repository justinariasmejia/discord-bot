const { SlashCommandBuilder } = require('discord.js');
const { ejecutarPlay } = require('../services/accionesMusica');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('🎵 Reproduce una canción o playlist (YouTube, Spotify, SoundCloud)')
        .addStringOption((opt) =>
            opt.setName('cancion')
                .setDescription('Nombre de la canción, artista o enlace (YouTube/Spotify/SoundCloud)')
                .setRequired(true)
        ),

    async ejecutar(interaction, client) {
        const query = interaction.options.getString('cancion');
        return await ejecutarPlay(interaction, query);
    },
};

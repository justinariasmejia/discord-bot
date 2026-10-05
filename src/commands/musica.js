const { SlashCommandBuilder } = require('discord.js');
const {
    ejecutarPlay,
    ejecutarSkip,
    ejecutarStop,
    ejecutarPause,
    ejecutarResume,
    ejecutarQueue,
    ejecutarNp,
    ejecutarVolume,
    ejecutarShuffle,
    ejecutarLoop,
    ejecutarRemove,
    ejecutarClear,
} = require('../services/accionesMusica');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('musica')
        .setDescription('🎵 Sistema completo de música interactiva')
        .addSubcommand((sub) =>
            sub.setName('play')
                .setDescription('Reproduce directamente una canción o enlace')
                .addStringOption((opt) => opt.setName('busqueda').setDescription('Nombre o enlace').setRequired(true))
        )
        .addSubcommand((sub) => sub.setName('skip').setDescription('Salta a la siguiente canción'))
        .addSubcommand((sub) => sub.setName('stop').setDescription('Detiene la música y desconecta el bot'))
        .addSubcommand((sub) => sub.setName('pause').setDescription('Pausa la reproducción actual'))
        .addSubcommand((sub) => sub.setName('resume').setDescription('Reanuda la reproducción pausada'))
        .addSubcommand((sub) => sub.setName('queue').setDescription('Muestra y gestiona la cola interactiva'))
        .addSubcommand((sub) => sub.setName('np').setDescription('Muestra el reproductor interactivo con controles'))
        .addSubcommand((sub) =>
            sub.setName('volume')
                .setDescription('Ajusta el volumen de la música (0-150%)')
                .addIntegerOption((opt) => opt.setName('nivel').setDescription('Nivel (0-150)').setRequired(true).setMinValue(0).setMaxValue(150))
        )
        .addSubcommand((sub) => sub.setName('shuffle').setDescription('Mezcla aleatoriamente las canciones de la cola'))
        .addSubcommand((sub) => sub.setName('loop').setDescription('Alterna el modo de repetición (Off → Canción → Cola)'))
        .addSubcommand((sub) =>
            sub.setName('remove')
                .setDescription('Remueve una canción de la cola por su posición')
                .addIntegerOption((opt) => opt.setName('posicion').setDescription('Número de posición (1, 2, 3...)').setRequired(true).setMinValue(1))
        )
        .addSubcommand((sub) => sub.setName('clear').setDescription('Vacía todas las canciones en espera de la cola')),

    async ejecutar(interaction, client) {
        const sub = interaction.options.getSubcommand();
        if (sub === 'play') return await ejecutarPlay(interaction, interaction.options.getString('busqueda'));
        if (sub === 'skip') return await ejecutarSkip(interaction);
        if (sub === 'stop') return await ejecutarStop(interaction);
        if (sub === 'pause') return await ejecutarPause(interaction);
        if (sub === 'resume') return await ejecutarResume(interaction);
        if (sub === 'queue') return await ejecutarQueue(interaction);
        if (sub === 'np') return await ejecutarNp(interaction);
        if (sub === 'volume') return await ejecutarVolume(interaction, interaction.options.getInteger('nivel'));
        if (sub === 'shuffle') return await ejecutarShuffle(interaction);
        if (sub === 'loop') return await ejecutarLoop(interaction);
        if (sub === 'remove') return await ejecutarRemove(interaction, interaction.options.getInteger('posicion'));
        if (sub === 'clear') return await ejecutarClear(interaction);
    },
};

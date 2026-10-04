// src/commands/musica.js
// Comando slash interactivo principal para el sistema de música con Lavalink.
const {
    SlashCommandBuilder,
    MessageFlags,
} = require('discord.js');
const {
    buscar,
    guardarBusqueda,
    obtenerCola,
    conectar,
    reproducir,
    saltar,
    desconectar,
    pausar,
    reanudar,
    setVolumen,
    barajar,
    toggleLoop,
    remover,
    vaciarCola,
    formatearDuracion,
} = require('../services/musica');
const { panelNowPlaying, panelBusqueda, panelCola } = require('../utils/paneles-musica');
const { basePremium, COLORES } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('musica')
        .setDescription('🎵 Sistema de música interactivo de alta calidad')
        .addSubcommand((sub) =>
            sub
                .setName('play')
                .setDescription('Reproduce una canción, busca interactivamente o agrega una URL')
                .addStringOption((opt) => opt.setName('busqueda').setDescription('Nombre de la canción o enlace').setRequired(true))
        )
        .addSubcommand((sub) =>
            sub
                .setName('search')
                .setDescription('Búsqueda interactiva con menú de selección de hasta 10 canciones')
                .addStringOption((opt) => opt.setName('busqueda').setDescription('Título o artista a buscar').setRequired(true))
        )
        .addSubcommand((sub) => sub.setName('skip').setDescription('Salta a la siguiente canción'))
        .addSubcommand((sub) => sub.setName('stop').setDescription('Detiene la música y desconecta el bot'))
        .addSubcommand((sub) => sub.setName('pause').setDescription('Pausa la reproducción actual'))
        .addSubcommand((sub) => sub.setName('resume').setDescription('Reanuda la reproducción pausada'))
        .addSubcommand((sub) => sub.setName('queue').setDescription('Muestra y gestiona la cola interactiva'))
        .addSubcommand((sub) => sub.setName('np').setDescription('Muestra el reproductor interactivo con controles'))
        .addSubcommand((sub) =>
            sub
                .setName('volume')
                .setDescription('Ajusta el volumen de la música (0-150%)')
                .addIntegerOption((opt) => opt.setName('nivel').setDescription('Nivel de volumen (0-150)').setRequired(true).setMinValue(0).setMaxValue(150))
        )
        .addSubcommand((sub) => sub.setName('shuffle').setDescription('Mezcla aleatoriamente las canciones de la cola'))
        .addSubcommand((sub) => sub.setName('loop').setDescription('Alterna el modo de repetición (Off → Canción → Cola)'))
        .addSubcommand((sub) =>
            sub
                .setName('remove')
                .setDescription('Remueve una canción de la cola por su posición')
                .addIntegerOption((opt) => opt.setName('posicion').setDescription('Número de posición en la cola (1, 2, 3...)').setRequired(true).setMinValue(1))
        )
        .addSubcommand((sub) => sub.setName('clear').setDescription('Vacía todas las canciones en espera de la cola')),

    async ejecutar(interaction, client) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;
        const miembro = interaction.member;

        // ══════ 1. PLAY & SEARCH ══════
        if (sub === 'play' || sub === 'search') {
            const query = interaction.options.getString('busqueda');
            const canalVoz = miembro.voice?.channel;

            if (!canalVoz) {
                return interaction.reply({
                    embeds: [basePremium('❌ No estás en un canal de voz', 'Únete a un canal de voz primero para poner música.', COLORES.rojo)],
                    flags: MessageFlags.Ephemeral,
                });
            }

            await interaction.deferReply();

            const resultado = await buscar(query);

            if (!resultado || !resultado.data) {
                return interaction.editReply({
                    embeds: [basePremium('🔍 Sin Resultados', `No se encontró nada para: **${query}**\n\n💡 Intenta con un nombre más específico o una URL directa.`, COLORES.rojo)],
                });
            }

            if (resultado.error === 'NO_NODE') {
                return interaction.editReply({
                    embeds: [basePremium('⚠️ Servidor de Música no Disponible', 'El nodo Lavalink se está conectando o iniciando. Por favor inténtalo en unos momentos.', COLORES.naranja)],
                });
            }

            let tracks = [];
            let esPlaylist = false;
            let nombrePlaylist = '';

            if (resultado.loadType === 'playlist') {
                tracks = resultado.data.tracks || resultado.data;
                esPlaylist = true;
                nombrePlaylist = resultado.data.info?.name || 'Playlist';
            } else if (resultado.loadType === 'track') {
                tracks = [resultado.data];
            } else if (resultado.loadType === 'search') {
                tracks = Array.isArray(resultado.data) ? resultado.data : [resultado.data];
            }

            if (!tracks || tracks.length === 0) {
                return interaction.editReply({
                    embeds: [basePremium('🔍 Sin Resultados', `No se encontraron canciones para: **${query}**`, COLORES.rojo)],
                });
            }

            // Asignar requester
            const requester = {
                id: interaction.user.id,
                tag: interaction.user.tag,
                avatar: interaction.user.displayAvatarURL(),
            };

            // ── Búsqueda Interactiva con Select Menu ──
            // Si el usuario usó /musica search O si usó /musica play con texto libre y hay múltiples resultados
            const esUrl = /^https?:\/\//i.test(query.trim());
            if ((sub === 'search' || (sub === 'play' && !esUrl && tracks.length > 1))) {
                const searchId = `s_${Date.now()}_${interaction.user.id}`;
                const topTracks = tracks.slice(0, 10);
                guardarBusqueda(searchId, topTracks, interaction.user.id);
                return interaction.editReply(panelBusqueda(searchId, query, topTracks, interaction.user.id));
            }

            // ── Reproducción Directa (URL, Playlist o 1 solo resultado) ──
            let cola = obtenerCola(guildId);
            if (!cola) {
                try {
                    cola = await conectar(guildId, canalVoz.id, interaction.channelId, interaction.guild.shardId);
                } catch (err) {
                    console.error('Error al conectar a voz:', err);
                    return interaction.editReply({
                        embeds: [basePremium('❌ Error de Conexión', 'No se pudo conectar al canal de voz. Revisa los permisos del bot.', COLORES.rojo)],
                    });
                }
            }

            const yaSonando = !!cola.current;

            for (const t of tracks) {
                t.requester = requester;
                reproducir(guildId, t);
            }

            if (esPlaylist) {
                const embed = basePremium('📋 Playlist Añadida', `**${nombrePlaylist}**\n\n🎵 **${tracks.length}** canciones añadidas a la cola.\n📝 Cola total: **${cola.tracks.length}** canciones.`, COLORES.teal);
                return interaction.editReply({ embeds: [embed] });
            }

            const track = tracks[0];
            const info = track.info;

            if (yaSonando) {
                const embed = basePremium('➕ Añadida a la Cola', '', COLORES.verde)
                    .addFields(
                        { name: '🎵 Canción', value: `[${info.title}](${info.uri})`, inline: false },
                        { name: '👤 Artista', value: info.author || 'Desconocido', inline: true },
                        { name: '⏱️ Duración', value: formatearDuracion(info.length), inline: true },
                        { name: '#️⃣ Posición', value: `#${cola.tracks.length}`, inline: true }
                    );
                if (info.artworkUrl) embed.setThumbnail(info.artworkUrl);
                return interaction.editReply({ embeds: [embed] });
            }

            return interaction.editReply(panelNowPlaying(cola, interaction.user.id));
        }

        // ══════ 2. SKIP ══════
        if (sub === 'skip') {
            const cola = obtenerCola(guildId);
            if (!cola || !cola.current) {
                return interaction.reply({
                    embeds: [basePremium('❌ Sin Música', 'No hay ninguna canción reproduciéndose.', COLORES.rojo)],
                    flags: MessageFlags.Ephemeral,
                });
            }
            const saltada = cola.current.info.title;
            saltar(guildId);
            return interaction.reply({
                embeds: [basePremium('⏭️ Canción Saltada', `Se saltó **${saltada}**.`, COLORES.verde)],
            });
        }

        // ══════ 3. STOP ══════
        if (sub === 'stop') {
            const cola = obtenerCola(guildId);
            if (!cola) {
                return interaction.reply({
                    embeds: [basePremium('❌ Sin Música', 'El bot no está reproduciendo música en este servidor.', COLORES.rojo)],
                    flags: MessageFlags.Ephemeral,
                });
            }
            desconectar(guildId);
            return interaction.reply({
                embeds: [basePremium('⏹️ Música Detenida', 'Se detuvo la reproducción y el bot se desconectó.', COLORES.rojo)],
            });
        }

        // ══════ 4. PAUSE ══════
        if (sub === 'pause') {
            const exito = pausar(guildId);
            if (!exito) {
                return interaction.reply({
                    embeds: [basePremium('❌ Error', 'No hay música activa para pausar.', COLORES.rojo)],
                    flags: MessageFlags.Ephemeral,
                });
            }
            return interaction.reply({
                embeds: [basePremium('⏸️ Música Pausada', 'Usa `/musica resume` o el botón ▶️ del panel para continuar.', COLORES.naranja)],
            });
        }

        // ══════ 5. RESUME ══════
        if (sub === 'resume') {
            const exito = reanudar(guildId);
            if (!exito) {
                return interaction.reply({
                    embeds: [basePremium('❌ Error', 'No hay música pausada para reanudar.', COLORES.rojo)],
                    flags: MessageFlags.Ephemeral,
                });
            }
            return interaction.reply({
                embeds: [basePremium('▶️ Música Reanudada', 'La reproducción continúa.', COLORES.verde)],
            });
        }

        // ══════ 6. QUEUE ══════
        if (sub === 'queue') {
            const cola = obtenerCola(guildId);
            if (!cola || (!cola.current && cola.tracks.length === 0)) {
                return interaction.reply({
                    embeds: [basePremium('📋 Cola Vacía', 'No hay canciones en la cola.\n\nUsa `/musica play` o `/musica search` para agregar canciones.', COLORES.morado)],
                    flags: MessageFlags.Ephemeral,
                });
            }
            return interaction.reply(panelCola(cola, interaction.user.id, 0));
        }

        // ══════ 7. NOW PLAYING (NP) ══════
        if (sub === 'np') {
            const cola = obtenerCola(guildId);
            if (!cola || !cola.current) {
                return interaction.reply({
                    embeds: [basePremium('🔇 Silencio', 'No hay ninguna canción reproduciéndose.', COLORES.morado)],
                    flags: MessageFlags.Ephemeral,
                });
            }
            return interaction.reply(panelNowPlaying(cola, interaction.user.id));
        }

        // ══════ 8. VOLUME ══════
        if (sub === 'volume') {
            const nivel = interaction.options.getInteger('nivel');
            const exito = await setVolumen(guildId, nivel);
            if (!exito) {
                return interaction.reply({
                    embeds: [basePremium('❌ Error', 'No hay música activa para cambiar el volumen.', COLORES.rojo)],
                    flags: MessageFlags.Ephemeral,
                });
            }
            const emoji = nivel === 0 ? '🔇' : nivel < 50 ? '🔉' : '🔊';
            return interaction.reply({
                embeds: [basePremium(`${emoji} Volumen Ajustado`, `Volumen establecido a **${nivel}%**`, COLORES.verde)],
            });
        }

        // ══════ 9. SHUFFLE ══════
        if (sub === 'shuffle') {
            const exito = barajar(guildId);
            if (!exito) {
                return interaction.reply({
                    embeds: [basePremium('❌ Error', 'Se necesitan al menos 2 canciones en la cola para mezclar.', COLORES.rojo)],
                    flags: MessageFlags.Ephemeral,
                });
            }
            return interaction.reply({
                embeds: [basePremium('🔀 Cola Mezclada', 'El orden de las canciones ha sido barajado aleatoriamente.', COLORES.verde)],
            });
        }

        // ══════ 10. LOOP ══════
        if (sub === 'loop') {
            const modo = toggleLoop(guildId);
            if (modo === null) {
                return interaction.reply({
                    embeds: [basePremium('❌ Error', 'No hay música activa para cambiar el modo de repetición.', COLORES.rojo)],
                    flags: MessageFlags.Ephemeral,
                });
            }
            const textos = {
                off: '▶️ **Desactivado** — Las pistas se reproducen una vez.',
                track: '🔂 **Canción Actual** — La canción actual se repetirá continuamente.',
                queue: '🔁 **Toda la Cola** — La lista completa se repetirá al terminar.',
            };
            return interaction.reply({
                embeds: [basePremium('🔄 Modo de Repetición', textos[modo], COLORES.verde)],
            });
        }

        // ══════ 11. REMOVE ══════
        if (sub === 'remove') {
            const pos = interaction.options.getInteger('posicion') - 1;
            const removida = remover(guildId, pos);
            if (!removida) {
                return interaction.reply({
                    embeds: [basePremium('❌ Posición Inválida', 'No existe ninguna canción en esa posición. Usa `/musica queue` para ver la lista.', COLORES.rojo)],
                    flags: MessageFlags.Ephemeral,
                });
            }
            return interaction.reply({
                embeds: [basePremium('🗑️ Canción Removida', `Se quitó **${removida.info.title}** de la cola.`, COLORES.verde)],
            });
        }

        // ══════ 12. CLEAR ══════
        if (sub === 'clear') {
            const total = vaciarCola(guildId);
            return interaction.reply({
                embeds: [basePremium('🧹 Cola Vaciada', `Se eliminaron **${total}** canciones de la cola de espera.`, COLORES.verde)],
            });
        }
    },
};

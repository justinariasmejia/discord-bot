// src/events/messageCreate.js
// Manejador de comandos tradicionales por texto/prefijo (en!p, !enp, en!play, etc.)
const {
    buscar,
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
    formatearDuracion,
} = require('../services/musica');
const { panelNowPlaying, panelCola } = require('../utils/paneles-musica');
const { basePremium, COLORES } = require('../utils/embeds');

module.exports = {
    name: 'messageCreate',

    async ejecutar(message, client) {
        if (message.author.bot || !message.guild) return;

        const contenido = message.content.trim();
        const lower = contenido.toLowerCase();

        let cmd = null;
        let args = '';

        if (lower.startsWith('!enp')) {
            cmd = 'p';
            args = contenido.slice(4).trim();
        } else if (lower.startsWith('!play ')) {
            cmd = 'p';
            args = contenido.slice(6).trim();
        } else if (lower.startsWith('!p ')) {
            cmd = 'p';
            args = contenido.slice(3).trim();
        } else if (lower.startsWith('en!') || lower.startsWith('!en ')) {
            const prefijoLen = lower.startsWith('en!') ? 3 : 4;
            const sinPrefijo = contenido.slice(prefijoLen).trim();
            const espacioIdx = sinPrefijo.indexOf(' ');
            if (espacioIdx === -1) {
                cmd = sinPrefijo.toLowerCase();
                args = '';
            } else {
                cmd = sinPrefijo.slice(0, espacioIdx).toLowerCase();
                args = sinPrefijo.slice(espacioIdx + 1).trim();
            }
        } else if (
            lower.startsWith('!skip') ||
            lower.startsWith('!stop') ||
            lower.startsWith('!pause') ||
            lower.startsWith('!resume') ||
            lower.startsWith('!queue') ||
            lower.startsWith('!np') ||
            lower.startsWith('!vol') ||
            lower.startsWith('!loop') ||
            lower.startsWith('!shuffle')
        ) {
            const sinExcl = contenido.slice(1).trim();
            const espacioIdx = sinExcl.indexOf(' ');
            if (espacioIdx === -1) {
                cmd = sinExcl.toLowerCase();
                args = '';
            } else {
                cmd = sinExcl.slice(0, espacioIdx).toLowerCase();
                args = sinExcl.slice(espacioIdx + 1).trim();
            }
        } else {
            return;
        }

        const guildId = message.guild.id;
        const canalVoz = message.member?.voice?.channel;

        // ── COMANDO: en!p / !enp / en!play ──
        if (cmd === 'p' || cmd === 'play') {
            if (!canalVoz) {
                return message.reply({
                    embeds: [basePremium('❌ No estás en un canal de voz', 'Únete a un canal de voz primero para poner música.', COLORES.rojo)],
                });
            }

            if (!args) {
                return message.reply({
                    embeds: [basePremium('❓ Falta la canción', 'Escribe el nombre de la canción o un enlace.\n\nEjemplo: `en!p bad bunny` o `en!p <enlace de spotify>`', COLORES.naranja)],
                });
            }

            message.channel.sendTyping().catch(() => {});

            const resultado = await buscar(args);

            if (resultado && resultado.error === 'NO_NODE') {
                return message.reply({
                    embeds: [basePremium('⚠️ Conectando al Servidor de Música', 'El servidor de música (Lavalink) se está conectando. Por favor inténtalo en 5 segundos.', COLORES.naranja)],
                });
            }

            if (!resultado || !resultado.data) {
                return message.reply({
                    embeds: [basePremium('🔍 Sin Resultados', `No se encontró ninguna canción para: **${args}**\n\n💡 Tip: Intenta con un nombre más descriptivo o un enlace de YouTube/Spotify.`, COLORES.rojo)],
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
                return message.reply({
                    embeds: [basePremium('🔍 Sin Resultados', `No se encontraron canciones para: **${args}**`, COLORES.rojo)],
                });
            }

            let cola = obtenerCola(guildId);
            if (!cola) {
                try {
                    cola = await conectar(guildId, canalVoz.id, message.channel.id, message.guild.shardId);
                } catch (err) {
                    console.error('Error al conectar con en!p:', err);
                    return message.reply({
                        embeds: [basePremium('❌ Error de Conexión', 'No se pudo conectar al canal de voz.', COLORES.rojo)],
                    });
                }
            }

            const requester = {
                id: message.author.id,
                tag: message.author.tag,
                avatar: message.author.displayAvatarURL(),
            };

            const yaSonando = !!cola.current;
            const cancionesAñadir = esPlaylist ? tracks : [tracks[0]];

            for (const t of cancionesAñadir) {
                t.requester = requester;
                reproducir(guildId, t);
            }

            if (esPlaylist) {
                return message.reply({
                    embeds: [basePremium('📋 Playlist Añadida', `**${nombrePlaylist}**\n\n🎵 **${cancionesAñadir.length}** canciones añadidas a la cola.\n📝 Cola total: **${cola.tracks.length}** canciones.`, COLORES.teal)],
                });
            }

            const track = cancionesAñadir[0];
            const info = track.info;

            if (yaSonando) {
                const embed = basePremium('➕ Añadida a la Cola', 'Se añadió exitosamente a la lista de reproducción.', COLORES.verde)
                    .addFields(
                        { name: '🎵 Canción', value: `[${info.title}](${info.uri})`, inline: false },
                        { name: '👤 Artista', value: info.author || 'Desconocido', inline: true },
                        { name: '⏱️ Duración', value: formatearDuracion(info.length), inline: true },
                        { name: '#️⃣ Posición', value: `#${cola.tracks.length}`, inline: true }
                    );
                if (info.artworkUrl) embed.setThumbnail(info.artworkUrl);
                return message.reply({ embeds: [embed] });
            }

            return message.reply(panelNowPlaying(cola, message.author.id));
        }

        // ── COMANDO: en!skip / en!s ──
        if (cmd === 'skip' || cmd === 's') {
            const cola = obtenerCola(guildId);
            if (!cola || !cola.current) {
                return message.reply({
                    embeds: [basePremium('❌ Sin Música', 'No hay ninguna canción reproduciéndose.', COLORES.rojo)],
                });
            }
            const saltada = cola.current.info.title;
            saltar(guildId);
            return message.reply({
                embeds: [basePremium('⏭️ Canción Saltada', `Se saltó **${saltada}**.`, COLORES.verde)],
            });
        }

        // ── COMANDO: en!stop ──
        if (cmd === 'stop') {
            const cola = obtenerCola(guildId);
            if (!cola) {
                return message.reply({
                    embeds: [basePremium('❌ Sin Música', 'El bot no está reproduciendo música en este servidor.', COLORES.rojo)],
                });
            }
            desconectar(guildId);
            return message.reply({
                embeds: [basePremium('⏹️ Música Detenida', 'Se detuvo la reproducción y el bot se desconectó.', COLORES.rojo)],
            });
        }

        // ── COMANDO: en!pause ──
        if (cmd === 'pause') {
            const exito = pausar(guildId);
            if (!exito) {
                return message.reply({ embeds: [basePremium('❌ Error', 'No hay música activa para pausar.', COLORES.rojo)] });
            }
            return message.reply({ embeds: [basePremium('⏸️ Música Pausada', 'Usa `en!resume` o el botón ▶️ del panel para continuar.', COLORES.naranja)] });
        }

        // ── COMANDO: en!resume / en!r ──
        if (cmd === 'resume' || cmd === 'r') {
            const exito = reanudar(guildId);
            if (!exito) {
                return message.reply({ embeds: [basePremium('❌ Error', 'No hay música pausada.', COLORES.rojo)] });
            }
            return message.reply({ embeds: [basePremium('▶️ Música Reanudada', 'La reproducción continúa.', COLORES.verde)] });
        }

        // ── COMANDO: en!queue / en!q ──
        if (cmd === 'queue' || cmd === 'q') {
            const cola = obtenerCola(guildId);
            if (!cola || (!cola.current && cola.tracks.length === 0)) {
                return message.reply({
                    embeds: [basePremium('📋 Cola Vacía', 'No hay canciones en la cola.\n\nUsa `en!p <canción>` para agregar.', COLORES.morado)],
                });
            }
            return message.reply(panelCola(cola, message.author.id, 0));
        }

        // ── COMANDO: en!np ──
        if (cmd === 'np') {
            const cola = obtenerCola(guildId);
            if (!cola || !cola.current) {
                return message.reply({
                    embeds: [basePremium('🔇 Silencio', 'No hay ninguna canción reproduciéndose.', COLORES.morado)],
                });
            }
            return message.reply(panelNowPlaying(cola, message.author.id));
        }

        // ── COMANDO: en!vol ──
        if (cmd === 'vol' || cmd === 'volume') {
            const num = parseInt(args, 10);
            if (isNaN(num)) {
                return message.reply({ embeds: [basePremium('❓ Volumen', 'Uso: `en!vol <0-150>`', COLORES.naranja)] });
            }
            const exito = await setVolumen(guildId, num);
            if (!exito) {
                return message.reply({ embeds: [basePremium('❌ Error', 'No hay música activa.', COLORES.rojo)] });
            }
            return message.reply({
                embeds: [basePremium('🔊 Volumen Ajustado', `Volumen fijado en **${Math.max(0, Math.min(150, num))}%**`, COLORES.verde)],
            });
        }

        // ── COMANDO: en!loop ──
        if (cmd === 'loop') {
            const modo = toggleLoop(guildId);
            if (!modo) {
                return message.reply({ embeds: [basePremium('❌ Error', 'No hay música activa.', COLORES.rojo)] });
            }
            return message.reply({
                embeds: [basePremium('🔄 Modo de Repetición', `Modo actual: **${modo}**`, COLORES.verde)],
            });
        }

        // ── COMANDO: en!shuffle ──
        if (cmd === 'shuffle') {
            const exito = barajar(guildId);
            if (!exito) {
                return message.reply({ embeds: [basePremium('❌ Error', 'Se necesitan al menos 2 canciones en cola.', COLORES.rojo)] });
            }
            return message.reply({ embeds: [basePremium('🔀 Cola Mezclada', 'La cola de reproducción fue barajada.', COLORES.verde)] });
        }
    },
};

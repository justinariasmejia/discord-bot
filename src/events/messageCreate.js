// src/events/messageCreate.js
// Manejador de comandos de texto y pedidos directos en el canal dedicado de música.
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
const { esCanalMusicaDedicado, procesarMensajeCanalMusica } = require('../services/canalMusica');
const { procesarActividadTexto } = require('../services/actividad');

module.exports = {
    name: 'messageCreate',

    async ejecutar(message, client) {
        try {
            if (message.author.bot || !message.guild) return;

            const guildId = message.guild.id;

            // ── 1. CANAL DEDICADO DE MÚSICA (Escribe directo sin /play) ──
            if (esCanalMusicaDedicado(guildId, message.channel.id)) {
                return await procesarMensajeCanalMusica(message, client);
            }

            let contenido = message.content?.trim() || '';

            // Si el contenido está vacío pero recibimos el evento (Message Content Intent)
            if (!contenido) {
                if (message.mentions.has(client.user)) {
                    message.channel.send({
                        embeds: [basePremium(
                            '👋 ¡Hola! Soy el Bot de Música y Comunidad',
                            'Puedes usar directamente los **comandos slash**:\n\n' +
                            '• `/play <cancion>` — Reproduce música (YouTube, Spotify, SoundCloud)\n' +
                            '• `/skip` — Salta a la siguiente canción\n' +
                            '• `/stop` — Detiene la música\n' +
                            '• `/queue` — Ver la lista de espera\n' +
                            '• `/setup-musica` — Crea un canal dedicado para pedir canciones solo escribiendo el nombre.\n\n' +
                            '💡 *Tip: Si prefieres comandos con prefijo como `!play`, activa MESSAGE CONTENT INTENT en Discord Developer Portal.*',
                            COLORES.morado
                        )],
                    }).catch(() => {});
                }
                return;
            }

            // Manejo de mención como prefijo (@Bot play cancion)
            const botMention = `<@${client.user.id}>`;
            const botMentionNick = `<@!${client.user.id}>`;
            if (contenido.startsWith(botMention)) {
                contenido = contenido.slice(botMention.length).trim();
            } else if (contenido.startsWith(botMentionNick)) {
                contenido = contenido.slice(botMentionNick.length).trim();
            }

            const lower = contenido.toLowerCase();
            let cmd = null;
            let args = '';

            const prefijos = ['en!', '!', '-'];
            let prefijoUsado = null;

            for (const p of prefijos) {
                if (lower.startsWith(p)) {
                    prefijoUsado = p;
                    break;
                }
            }

            if (prefijoUsado) {
                const sinPrefijo = contenido.slice(prefijoUsado.length).trim();
                const espacioIdx = sinPrefijo.indexOf(' ');
                if (espacioIdx === -1) {
                    cmd = sinPrefijo.toLowerCase();
                    args = '';
                } else {
                    cmd = sinPrefijo.slice(0, espacioIdx).toLowerCase();
                    args = sinPrefijo.slice(espacioIdx + 1).trim();
                }
            } else if (lower.startsWith('play ') || lower.startsWith('p ')) {
                const partes = contenido.split(/\s+/);
                cmd = partes[0].toLowerCase();
                args = partes.slice(1).join(' ').trim();
            } else {
                // Mensaje normal de chat: otorgar recompensa de actividad
                await procesarActividadTexto(message, client);
                return;
            }

            if (cmd === 'p') cmd = 'play';
            if (cmd === 's') cmd = 'skip';
            if (cmd === 'q') cmd = 'queue';
            if (cmd === 'v' || cmd === 'vol') cmd = 'volume';

            const comandosMusica = ['play', 'skip', 'stop', 'pause', 'resume', 'queue', 'np', 'volume', 'shuffle', 'loop'];
            if (!comandosMusica.includes(cmd)) {
                await procesarActividadTexto(message, client);
                return;
            }

            const canalVoz = message.member?.voice?.channel;

            const responder = async (opciones) => {
                try {
                    return await message.reply(opciones);
                } catch {
                    return await message.channel.send(opciones).catch(() => {});
                }
            };

            // ── COMANDO DE TEXTO: PLAY ──
            if (cmd === 'play') {
                if (!canalVoz) {
                    return responder({
                        embeds: [basePremium('❌ No estás en un canal de voz', 'Únete a un canal de voz primero para poner música.', COLORES.rojo)],
                    });
                }

                if (!args) {
                    return responder({
                        embeds: [basePremium('❓ ¿Qué canción quieres escuchar?', 'Escribe el nombre o enlace después del comando.\n\nEjemplo: `!play Bad Bunny` o `/play cancion: Ojitos Lindos`', COLORES.naranja)],
                    });
                }

                const msgCargando = await responder({
                    embeds: [basePremium('🔍 Buscando...', `Buscando **${args}**...`, COLORES.morado)],
                });

                const resultado = await buscar(args);

                if (!resultado || !resultado.data) {
                    const embedVacio = basePremium('🔍 Sin Resultados', `No se encontró ninguna canción para: **${args}**`, COLORES.rojo);
                    return msgCargando ? msgCargando.edit({ embeds: [embedVacio] }) : responder({ embeds: [embedVacio] });
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

                let cola = obtenerCola(guildId);
                if (!cola) {
                    try {
                        cola = await conectar(guildId, canalVoz.id, message.channel.id, message.guild.shardId);
                    } catch (err) {
                        console.error('Error conectando a voz:', err);
                        const embedErr = basePremium('❌ Error de Conexión', 'No se pudo conectar al canal de voz.', COLORES.rojo);
                        return msgCargando ? msgCargando.edit({ embeds: [embedErr] }) : responder({ embeds: [embedErr] });
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

                if (yaSonando) {
                    const track = cancionesAñadir[0];
                    const info = track.info;
                    const embedConfirm = basePremium('➕ Añadida a la Cola', 'Se añadió a la lista de reproducción.', COLORES.verde)
                        .addFields(
                            { name: '🎵 Canción', value: `[${info.title}](${info.uri})`, inline: false },
                            { name: '⏱️ Duración', value: formatearDuracion(info.length), inline: true },
                            { name: '#️⃣ Posición en Cola', value: `#${cola.tracks.length}`, inline: true }
                        );
                    if (info.artworkUrl) embedConfirm.setThumbnail(info.artworkUrl);
                    if (msgCargando) {
                        await msgCargando.edit({ embeds: [embedConfirm] });
                        setTimeout(() => msgCargando.delete().catch(() => {}), 5000);
                    }
                    const { actualizarPanelDedicado } = require('../services/canalMusica');
                    await actualizarPanelDedicado(client, guildId);
                    return;
                }

                const panel = panelNowPlaying(cola, message.author.id);
                const respFinal = msgCargando ? await msgCargando.edit(panel) : await responder(panel);
                if (respFinal?.id) cola.mensajeId = respFinal.id;
                const { actualizarPanelDedicado } = require('../services/canalMusica');
                await actualizarPanelDedicado(client, guildId);
            }

            // ── RESTO DE COMANDOS DE TEXTO ──
            if (cmd === 'skip') {
                const cola = obtenerCola(guildId);
                if (!cola || !cola.current) return responder({ embeds: [basePremium('❌ Sin Música', 'No hay canciones reproduciéndose.', COLORES.rojo)] });
                saltar(guildId);
                const { actualizarPanelDedicado } = require('../services/canalMusica');
                await actualizarPanelDedicado(client, guildId);
                return responder({ embeds: [basePremium('⏭️ Canción Saltada', 'Se saltó a la siguiente canción.', COLORES.verde)] });
            }

            if (cmd === 'stop') {
                desconectar(guildId);
                const { actualizarPanelDedicado } = require('../services/canalMusica');
                await actualizarPanelDedicado(client, guildId);
                return responder({ embeds: [basePremium('⏹️ Música Detenida', 'Se detuvo la reproducción y el bot se desconectó.', COLORES.rojo)] });
            }

            if (cmd === 'queue') {
                const cola = obtenerCola(guildId);
                if (!cola || (!cola.current && cola.tracks.length === 0)) return responder({ embeds: [basePremium('📋 Cola Vacía', 'No hay canciones en la cola.', COLORES.morado)] });
                return responder(panelCola(cola, message.author.id, 0));
            }

            if (cmd === 'np') {
                const cola = obtenerCola(guildId);
                if (!cola || !cola.current) return responder({ embeds: [basePremium('🔇 Silencio', 'No hay ninguna canción reproduciéndose.', COLORES.morado)] });
                return responder(panelNowPlaying(cola, message.author.id));
            }
        } catch (error) {
            console.error('❌ Error en comando de texto:', error);
        }
    },
};

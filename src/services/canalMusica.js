// src/services/canalMusica.js
// Gestión del canal dedicado interactivo de música:
// - Mensaje maestro permanente con reproductor y lista de espera en vivo.
// - Entrada directa de canciones escribiendo en el chat sin /play.
// - Borrado instantáneo del mensaje de texto y confirmación ultra-rápida.
// - Limpieza automática de mensajes residuales en el canal.
const ConfigEvento = require('../models/ConfigEvento');
const {
    buscar,
    obtenerCola,
    conectar,
    reproducir,
    formatearDuracion,
} = require('./musica');
const { esUrlSpotify, resolverSpotify } = require('./spotify');
const { panelNowPlaying, panelEsperaMusica } = require('../utils/paneles-musica');
const { basePremium, COLORES } = require('../utils/embeds');

const canalesMusicaCache = new Map(); // guildId -> { canalId, mensajeId }

async function cargarCanalesMusica(client) {
    try {
        const configs = await ConfigEvento.find({ canalMusicaId: { $ne: null } });
        for (const c of configs) {
            canalesMusicaCache.set(c.guildId, {
                canalId: c.canalMusicaId,
                mensajeId: c.mensajeMusicaId,
            });
            // Al arrancar, refrescar el panel maestro y limpiar mensajes residuales
            actualizarPanelDedicado(client, c.guildId).catch(() => {});
        }
        console.log(`🎧 Canales dedicados de música cargados: ${canalesMusicaCache.size}`);
    } catch (e) {
        console.error('Error cargando canales de música:', e?.message || e);
    }
}

function esCanalMusicaDedicado(guildId, canalId) {
    const config = canalesMusicaCache.get(guildId);
    return Boolean(config && config.canalId === canalId);
}

async function configurarCanalMusica(guildId, canalId, client) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return null;
    const canal = guild.channels.cache.get(canalId);
    if (!canal) return null;

    const cola = obtenerCola(guildId);
    const payload = cola?.current ? panelNowPlaying(cola) : panelEsperaMusica();
    const mensajeMaestro = await canal.send(payload);

    await ConfigEvento.findOneAndUpdate(
        { guildId },
        { $set: { canalMusicaId: canalId, mensajeMusicaId: mensajeMaestro.id } },
        { upsert: true, new: true }
    );

    canalesMusicaCache.set(guildId, {
        canalId,
        mensajeId: mensajeMaestro.id,
    });

    return mensajeMaestro;
}

async function actualizarPanelDedicado(client, guildId) {
    let config = canalesMusicaCache.get(guildId);
    if (!config || !config.canalId) {
        const dbConf = await ConfigEvento.findOne({ guildId, canalMusicaId: { $ne: null } });
        if (dbConf) {
            config = { canalId: dbConf.canalMusicaId, mensajeId: dbConf.mensajeMusicaId };
            canalesMusicaCache.set(guildId, config);
        }
    }
    if (!config || !config.canalId) return;

    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;
        const canal = guild.channels.cache.get(config.canalId);
        if (!canal) return;

        const cola = obtenerCola(guildId);
        const payload = cola?.current ? panelNowPlaying(cola) : panelEsperaMusica();

        // 1. Limpieza de mensajes residuales en el canal para mantenerlo 100% impecable
        try {
            const recientes = await canal.messages.fetch({ limit: 15 }).catch(() => null);
            if (recientes) {
                const sobrantes = recientes.filter(m => m.id !== config.mensajeId);
                if (sobrantes.size > 0) {
                    await canal.bulkDelete(sobrantes).catch(() => {});
                }
            }
        } catch {}

        // 2. Editar el mensaje maestro o enviarlo si no existe
        if (config.mensajeId) {
            const mensaje = await canal.messages.fetch(config.mensajeId).catch(() => null);
            if (mensaje) {
                return await mensaje.edit(payload).catch(() => {});
            }
        }

        const nuevo = await canal.send(payload).catch(() => null);
        if (nuevo) {
            config.mensajeId = nuevo.id;
            await ConfigEvento.findOneAndUpdate({ guildId }, { $set: { mensajeMusicaId: nuevo.id } });
        }
    } catch (e) {
        console.error('Error actualizando panel dedicado de música:', e?.message || e);
    }
}

async function procesarMensajeCanalMusica(message, client) {
    const guildId = message.guild.id;
    const query = message.content?.trim();

    // 1. Borrar el mensaje del usuario DE INMEDIATO para mantener el canal impecable
    message.delete().catch(() => {});

    if (!query) return;

    // Obtener miembro con voz de forma robusta
    const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
    const canalVoz = member?.voice?.channel;

    if (!canalVoz) {
        const aviso = await message.channel.send({
            embeds: [basePremium('❌ No estás en un canal de voz', `${message.author}, únete a un canal de voz primero para poner música.`, COLORES.rojo)],
        }).catch(() => null);
        if (aviso) setTimeout(() => aviso.delete().catch(() => {}), 2500);
        return;
    }

    // 2. Conectar a voz si no está conectado
    let cola = obtenerCola(guildId);
    if (!cola) {
        try {
            cola = await conectar(guildId, canalVoz.id, message.channel.id, message.guild.shardId);
        } catch (err) {
            console.error('Error conectando a voz:', err);
            const aviso = await message.channel.send({
                embeds: [basePremium('❌ Error de Conexión', 'No se pudo conectar a tu canal de voz.', COLORES.rojo)],
            }).catch(() => null);
            if (aviso) setTimeout(() => aviso.delete().catch(() => {}), 2500);
            return;
        }
    }

    const requester = {
        id: message.author.id,
        tag: message.author.tag,
        avatar: message.author.displayAvatarURL(),
    };

    // ── 3. Manejo de Spotify (Playlists, Álbumes o Canción) ──
    if (esUrlSpotify(query)) {
        const spotData = await resolverSpotify(query);
        if (spotData && spotData.esPlaylist && spotData.tracks?.length > 0) {
            const avisoPl = await message.channel.send({
                embeds: [basePremium('⏳ Cargando Playlist', `Cargando **${spotData.nombre}** (${spotData.tracks.length} canciones)... Para ${message.author}`, COLORES.morado)],
            }).catch(() => null);

            // Cargar la primera canción de inmediato
            const primerTrackData = await buscar(spotData.tracks[0].query);
            if (primerTrackData && primerTrackData.data) {
                const primerTrack = Array.isArray(primerTrackData.data) ? primerTrackData.data[0] : (primerTrackData.data.tracks ? primerTrackData.data.tracks[0] : primerTrackData.data);
                if (primerTrack) {
                    primerTrack.requester = requester;
                    reproducir(guildId, primerTrack);
                    await actualizarPanelDedicado(client, guildId);
                }
            }

            if (avisoPl) {
                await avisoPl.edit({
                    embeds: [basePremium('📋 Playlist Añadida', `**${spotData.nombre}**\n🎵 **${spotData.tracks.length}** canciones añadidas por ${message.author}.`, COLORES.verde)],
                }).catch(() => {});
                setTimeout(() => avisoPl.delete().catch(() => {}), 2500);
            }

            // Añadir el resto de canciones a la cola en segundo plano
            (async () => {
                for (let i = 1; i < spotData.tracks.length; i++) {
                    const c = obtenerCola(guildId);
                    if (!c) break;
                    try {
                        const trkRes = await buscar(spotData.tracks[i].query);
                        if (trkRes && trkRes.data) {
                            const track = Array.isArray(trkRes.data) ? trkRes.data[0] : (trkRes.data.tracks ? trkRes.data.tracks[0] : trkRes.data);
                            if (track) {
                                track.requester = requester;
                                reproducir(guildId, track);
                            }
                        }
                    } catch {}
                    if (i % 5 === 0 || i === spotData.tracks.length - 1) {
                        await actualizarPanelDedicado(client, guildId);
                    }
                }
                await actualizarPanelDedicado(client, guildId);
            })();
            return;
        }
    }

    // ── 4. Búsqueda Directa (YouTube Music, YouTube, SoundCloud, Enlace directo) ──
    const resultado = await buscar(query);

    if (!resultado || !resultado.data) {
        const aviso = await message.channel.send({
            embeds: [basePremium('🔍 Sin Resultados', `No se encontró música para: **${query}**`, COLORES.rojo)],
        }).catch(() => null);
        if (aviso) setTimeout(() => aviso.delete().catch(() => {}), 2500);
        return;
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
        const aviso = await message.channel.send({
            embeds: [basePremium('🔍 Sin Resultados', `No se encontraron canciones para: **${query}**`, COLORES.rojo)],
        }).catch(() => null);
        if (aviso) setTimeout(() => aviso.delete().catch(() => {}), 2500);
        return;
    }

    const cancionesAñadir = esPlaylist ? tracks : [tracks[0]];

    for (const t of cancionesAñadir) {
        t.requester = requester;
        reproducir(guildId, t);
    }

    // Notificación flash rápida que se auto-elimina en 2 segundos
    const avisoMsg = await message.channel.send({
        embeds: [esPlaylist
            ? basePremium('📋 Playlist Añadida', `**${nombrePlaylist}** (${cancionesAñadir.length} canciones) por ${message.author}.`, COLORES.verde)
            : basePremium('➕ Canción Añadida', `**[${cancionesAñadir[0].info.title}](${cancionesAñadir[0].info.uri})** añadida por ${message.author} • #${cola.tracks.length}`, COLORES.verde)
        ],
    }).catch(() => null);

    if (avisoMsg) setTimeout(() => avisoMsg.delete().catch(() => {}), 2000);

    // Actualizar el reproductor maestro de inmediato
    await actualizarPanelDedicado(client, guildId);
}

module.exports = {
    cargarCanalesMusica,
    esCanalMusicaDedicado,
    configurarCanalMusica,
    actualizarPanelDedicado,
    procesarMensajeCanalMusica,
};

// src/services/musica.js
// Gestor de colas de reproducción y control de música con Shoukaku/Lavalink.
const { Shoukaku, Connectors } = require('shoukaku');
const { esUrlSpotify, resolverSpotify } = require('./spotify');

const colas = new Map();
const searchCache = new Map();

let _shoukaku = null;
let _client = null;

function inicializarShoukaku(client) {
    _client = client;
    const host = process.env.LAVALINK_HOST || 'miami2.visihost.in:2691';
    const auth = process.env.LAVALINK_PASSWORD || 'youshallnotpass';
    const secure = process.env.LAVALINK_SECURE === 'true';

    const nodos = [{
        name: 'ZeroMusic',
        url: host,
        auth: auth,
        secure: secure,
    }];

    try {
        _shoukaku = new Shoukaku(new Connectors.DiscordJS(client), nodos, {
            moveOnDisconnect: false,
            reconnectTries: Infinity,
            reconnectInterval: 5000,
            restTimeout: 15000,
        });

        _shoukaku.on('ready', (name) => {
            console.log(`🎵 [Lavalink] Nodo "${name}" conectado y listo para reproducir música.`);
        });

        _shoukaku.on('error', (name, err) => {
            console.warn(`⚠️ [Lavalink] Nodo "${name}" aviso: ${err?.message || err}`);
        });

        _shoukaku.on('close', (name, code, reason) => {
            console.warn(`⚠️ [Lavalink] Nodo "${name}" cerrado (código: ${code}, razón: ${reason || 'ninguna'}).`);
        });

        _shoukaku.on('disconnect', (name, count) => {
            console.warn(`⚠️ [Lavalink] Nodo "${name}" desconectado. Reintentando (#${count})...`);
        });

        client.shoukaku = _shoukaku;
    } catch (err) {
        console.error('❌ Error inicializando Shoukaku:', err);
    }

    return _shoukaku;
}

function getShoukaku() {
    return _shoukaku;
}

function nodoDisponible() {
    if (!_shoukaku) return null;
    try {
        return _shoukaku.getIdealNode();
    } catch {
        return null;
    }
}

function esResultadoValido(res) {
    if (!res || !res.data) return false;
    if (res.loadType === 'empty' || res.loadType === 'error') return false;
    if (Array.isArray(res.data) && res.data.length === 0) return false;
    return true;
}

// ── Búsqueda de Canciones (Spotify -> YouTube Music -> YouTube -> SoundCloud) ──
async function buscar(query) {
    const node = nodoDisponible();
    if (!node) {
        return { error: 'NO_NODE', loadType: 'error', data: null };
    }

    let busqueda = query.trim();

    // 1. Detección y resolución de enlaces de Spotify
    if (esUrlSpotify(busqueda)) {
        try {
            const spotData = await resolverSpotify(busqueda);
            if (spotData && spotData.query) {
                console.log(`🟢 [Spotify] Resuelto enlace a búsqueda: "${spotData.query}"`);
                busqueda = spotData.query;
            }
        } catch (e) {
            console.error('Error resolviendo Spotify:', e);
        }
    }

    // 2. Si es URL directa (SoundCloud, YouTube directo, stream HTTP)
    if (/^https?:\/\//i.test(busqueda)) {
        try {
            const resUrl = await node.rest.resolve(busqueda);
            if (esResultadoValido(resUrl)) return resUrl;
        } catch (err) {
            console.error('Error buscando URL:', err?.message || err);
        }
    }

    // 3. Probar YouTube Music (ytmsearch:) primero (rápido, sin timeouts y sin 404s)
    try {
        const resYtm = await node.rest.resolve(`ytmsearch:${busqueda}`);
        if (esResultadoValido(resYtm)) {
            return resYtm;
        }
    } catch (err) {
        console.warn('ytmsearch fallo o no disponible:', err?.message || err);
    }

    // 4. Probar YouTube estándar (ytsearch:)
    try {
        const resYt = await node.rest.resolve(`ytsearch:${busqueda}`);
        if (esResultadoValido(resYt)) {
            return resYt;
        }
    } catch (err) {
        console.warn('ytsearch fallo o no disponible:', err?.message || err);
    }

    // 5. Fallback a SoundCloud (scsearch:)
    try {
        const resSc = await node.rest.resolve(`scsearch:${busqueda}`);
        if (esResultadoValido(resSc)) {
            return resSc;
        }
    } catch (err) {
        console.error('Error buscando SoundCloud:', err?.message || err);
    }

    return null;
}

function guardarBusqueda(searchId, tracks, userId) {
    if (searchCache.has(searchId)) {
        clearTimeout(searchCache.get(searchId).timeout);
    }
    const timeout = setTimeout(() => {
        searchCache.delete(searchId);
    }, 120000);

    searchCache.set(searchId, { tracks, userId, timeout });
}

function obtenerBusqueda(searchId) {
    return searchCache.get(searchId) || null;
}

function limpiarBusqueda(searchId) {
    if (searchCache.has(searchId)) {
        clearTimeout(searchCache.get(searchId).timeout);
        searchCache.delete(searchId);
    }
}

function obtenerCola(guildId) {
    return colas.get(guildId) || null;
}

function crearCola(guildId, player, canalTextoId, canalVozId) {
    const cola = {
        guildId,
        player,
        tracks: [],
        current: null,
        canalTextoId,
        canalVozId,
        loop: 'off',
        volume: 80,
        volumenAnterior: 80,
        paused: false,
        timeoutDisconnect: null,
    };
    colas.set(guildId, cola);
    return cola;
}

function eliminarCola(guildId) {
    const cola = colas.get(guildId);
    if (cola?.timeoutDisconnect) {
        clearTimeout(cola.timeoutDisconnect);
    }
    colas.delete(guildId);
}

async function conectar(guildId, canalVozId, canalTextoId, shardId = 0) {
    const node = nodoDisponible();
    if (!node) throw new Error('No hay nodos Lavalink disponibles.');

    if (_shoukaku.connections.has(guildId)) {
        try {
            await _shoukaku.leaveVoiceChannel(guildId);
        } catch {}
    }

    const player = await _shoukaku.joinVoiceChannel({
        guildId,
        channelId: canalVozId,
        shardId,
        deaf: true,
    });

    const cola = crearCola(guildId, player, canalTextoId, canalVozId);
    await player.setGlobalVolume(cola.volume);

    player.on('end', (data) => {
        if (data.reason === 'replaced') return;
        manejarFinCancion(guildId);
    });

    player.on('stuck', () => {
        console.warn(`⚠️ Canción atascada en servidor ${guildId}, saltando...`);
        manejarFinCancion(guildId);
    });

    player.on('exception', (err) => {
        console.error(`❌ Excepción en pista (servidor ${guildId}):`, err?.message || err);
        const c = obtenerCola(guildId);
        if (c?.canalTextoId && _client) {
            const ch = _client.channels.cache.get(c.canalTextoId);
            if (ch) {
                const { basePremium, COLORES } = require('../utils/embeds');
                ch.send({
                    embeds: [basePremium('⚠️ Pista no reproducible', `No se pudo reproducir **${c.current?.info?.title || 'la pista'}** (la fuente retornó error o está restringida).\n\n💡 *Tip: Puedes probar con otra canción o pegar un enlace directo de YouTube/SoundCloud.*\nSaltando a la siguiente canción...`, COLORES.rojo)],
                }).catch(() => {});
            }
        }
        manejarFinCancion(guildId);
    });

    player.on('closed', () => {
        desconectar(guildId);
    });

    return cola;
}

function manejarFinCancion(guildId) {
    const cola = obtenerCola(guildId);
    if (!cola) return;

    if (cola.loop === 'track' && cola.current) {
        cola.player.playTrack({ track: { encoded: cola.current.encoded } });
        return;
    }

    if (cola.loop === 'queue' && cola.current) {
        cola.tracks.push(cola.current);
    }

    if (cola.tracks.length > 0) {
        const siguiente = cola.tracks.shift();
        cola.current = siguiente;
        cola.player.playTrack({ track: { encoded: siguiente.encoded } });
    } else {
        cola.current = null;
        if (cola.timeoutDisconnect) clearTimeout(cola.timeoutDisconnect);
        cola.timeoutDisconnect = setTimeout(() => {
            const c = obtenerCola(guildId);
            if (c && !c.current && c.tracks.length === 0) {
                desconectar(guildId);
            }
        }, 120000);
    }
}

function reproducir(guildId, track) {
    const cola = obtenerCola(guildId);
    if (!cola) return false;

    if (cola.timeoutDisconnect) {
        clearTimeout(cola.timeoutDisconnect);
        cola.timeoutDisconnect = null;
    }

    if (!cola.current) {
        cola.current = track;
        cola.player.playTrack({ track: { encoded: track.encoded } });
    } else {
        cola.tracks.push(track);
    }
    return true;
}

function saltar(guildId) {
    const cola = obtenerCola(guildId);
    if (!cola || !cola.current) return false;

    const loopAnterior = cola.loop;
    if (cola.loop === 'track') cola.loop = 'off';

    cola.player.stopTrack();

    if (loopAnterior === 'track') {
        setTimeout(() => {
            const c = obtenerCola(guildId);
            if (c) c.loop = loopAnterior;
        }, 600);
    }
    return true;
}

function saltarA(guildId, index) {
    const cola = obtenerCola(guildId);
    if (!cola || index < 0 || index >= cola.tracks.length) return false;

    const seleccionada = cola.tracks.splice(index, 1)[0];
    cola.tracks.unshift(seleccionada);
    saltar(guildId);
    return true;
}

function desconectar(guildId) {
    const cola = obtenerCola(guildId);
    if (!cola) return;

    try { cola.player.destroy(); } catch {}
    try { _shoukaku.leaveVoiceChannel(guildId); } catch {}
    eliminarCola(guildId);
}

function pausar(guildId) {
    const cola = obtenerCola(guildId);
    if (!cola || !cola.current) return false;
    cola.player.setPaused(true);
    cola.paused = true;
    return true;
}

function reanudar(guildId) {
    const cola = obtenerCola(guildId);
    if (!cola || !cola.current) return false;
    cola.player.setPaused(false);
    cola.paused = false;
    return true;
}

async function setVolumen(guildId, vol) {
    const cola = obtenerCola(guildId);
    if (!cola) return false;
    vol = Math.max(0, Math.min(150, vol));
    if (vol > 0) cola.volumenAnterior = vol;
    cola.volume = vol;
    await cola.player.setGlobalVolume(vol);
    return true;
}

function toggleMute(guildId) {
    const cola = obtenerCola(guildId);
    if (!cola) return 0;
    if (cola.volume === 0) {
        const restaurado = cola.volumenAnterior || 80;
        setVolumen(guildId, restaurado);
        return restaurado;
    } else {
        cola.volumenAnterior = cola.volume;
        setVolumen(guildId, 0);
        return 0;
    }
}

function barajar(guildId) {
    const cola = obtenerCola(guildId);
    if (!cola || cola.tracks.length < 2) return false;
    for (let i = cola.tracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cola.tracks[i], cola.tracks[j]] = [cola.tracks[j], cola.tracks[i]];
    }
    return true;
}

function toggleLoop(guildId) {
    const cola = obtenerCola(guildId);
    if (!cola) return null;
    if (cola.loop === 'off') cola.loop = 'track';
    else if (cola.loop === 'track') cola.loop = 'queue';
    else cola.loop = 'off';
    return cola.loop;
}

function remover(guildId, index) {
    const cola = obtenerCola(guildId);
    if (!cola || index < 0 || index >= cola.tracks.length) return null;
    const [removido] = cola.tracks.splice(index, 1);
    return removido;
}

function vaciarCola(guildId) {
    const cola = obtenerCola(guildId);
    if (!cola) return 0;
    const total = cola.tracks.length;
    cola.tracks = [];
    return total;
}

function formatearDuracion(ms) {
    if (!ms || ms <= 0) return '🔴 En vivo';
    const seg = Math.floor(ms / 1000);
    const min = Math.floor(seg / 60);
    const hrs = Math.floor(min / 60);
    const s = (seg % 60).toString().padStart(2, '0');
    const m = (min % 60).toString().padStart(2, '0');
    if (hrs > 0) return `${hrs}:${m}:${s}`;
    return `${m}:${s}`;
}

function barraProgreso(posicion, total, largo = 14) {
    if (!total || total <= 0) return '🔴 Transmisión en Vivo';
    const pct = Math.min(Math.max(posicion / total, 0), 1);
    const llenos = Math.round(pct * largo);
    const vacios = largo - llenos;
    return '▬'.repeat(llenos) + '🔘' + '▬'.repeat(vacios);
}

module.exports = {
    inicializarShoukaku,
    getShoukaku,
    nodoDisponible,
    buscar,
    guardarBusqueda,
    obtenerBusqueda,
    limpiarBusqueda,
    obtenerCola,
    conectar,
    reproducir,
    saltar,
    saltarA,
    desconectar,
    pausar,
    reanudar,
    setVolumen,
    toggleMute,
    barajar,
    toggleLoop,
    remover,
    vaciarCola,
    formatearDuracion,
    barraProgreso,
};

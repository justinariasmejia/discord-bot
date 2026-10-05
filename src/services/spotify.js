// src/services/spotify.js
// Extractor de metadatos de Spotify para Tracks, Playlists y Álbumes sin requerir API keys.
const https = require('https');

const SPOTIFY_REGEX = /spotify\.com\/(?:intl-[a-zA-Z-]+\/)?(track|album|playlist)\/([a-zA-Z0-9]+)/i;

function esUrlSpotify(url) {
    if (!url || typeof url !== 'string') return false;
    return SPOTIFY_REGEX.test(url.trim());
}

function fetchText(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(fetchText(res.headers.location));
            }
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function resolverSpotify(url) {
    const match = url.trim().match(SPOTIFY_REGEX);
    if (!match) return null;

    const tipo = match[1].toLowerCase();
    const id = match[2];

    try {
        const embedUrl = `https://open.spotify.com/embed/${tipo}/${id}`;
        const html = await fetchText(embedUrl);
        const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);

        if (m) {
            const json = JSON.parse(m[1]);
            const entity = json?.props?.pageProps?.state?.data?.entity;

            if (entity) {
                if (tipo === 'track') {
                    const title = entity.name || entity.title;
                    const artist = entity.artists?.map(a => a.name).join(', ') || entity.subtitle || '';
                    const fullQuery = `${artist} - ${title}`.trim();
                    return {
                        tipo: 'track',
                        titulo: title,
                        artista: artist,
                        query: fullQuery,
                        esPlaylist: false,
                        tracks: [{ query: fullQuery, title, artist }]
                    };
                }

                // Playlist o Álbum
                const trackList = entity.trackList || [];
                const parsedTracks = trackList.map(t => {
                    const title = t.title || t.name;
                    const artist = t.subtitle || t.artists?.map(a => a.name).join(', ') || '';
                    return {
                        title,
                        artist,
                        query: `${artist} - ${title}`.trim()
                    };
                }).filter(t => t.title);

                return {
                    tipo: tipo,
                    nombre: entity.name || (tipo === 'album' ? 'Álbum de Spotify' : 'Playlist de Spotify'),
                    esPlaylist: true,
                    tracks: parsedTracks
                };
            }
        }
    } catch (e) {
        console.warn('Error resolviendo Spotify embed, intentando fallback oembed:', e?.message || e);
    }

    // Fallback a oembed para track único
    try {
        const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url.trim())}`;
        const resOembed = await fetchText(oembedUrl);
        const data = JSON.parse(resOembed);
        if (data && data.title) {
            return {
                tipo: tipo,
                titulo: data.title,
                query: data.title,
                esPlaylist: false,
                tracks: [{ query: data.title, title: data.title, artist: '' }]
            };
        }
    } catch {}

    return null;
}

module.exports = {
    esUrlSpotify,
    resolverSpotify,
};

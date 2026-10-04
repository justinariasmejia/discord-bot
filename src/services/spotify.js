// src/services/spotify.js
// Extractor de metadatos de Spotify sin necesidad de credenciales complejas.
const https = require('https');

function esUrlSpotify(url) {
    if (!url || typeof url !== 'string') return false;
    return /https?:\/\/(open|play)\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/i.test(url.trim());
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
            let data = '';
            res.on('data', (d) => data += d);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function resolverSpotify(url) {
    const match = url.trim().match(/https?:\/\/(open|play)\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/i);
    if (!match) return null;

    const tipo = match[2].toLowerCase();

    // ── Track individual de Spotify ──
    if (tipo === 'track') {
        try {
            const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url.trim())}`;
            const data = await fetchJson(oembedUrl);
            if (data && data.title) {
                return {
                    tipo: 'track',
                    titulo: data.title,
                    thumbnail: data.thumbnail_url || null,
                    query: data.title,
                };
            }
        } catch (e) {
            console.error('Error resolviendo Spotify track oembed:', e?.message || e);
        }
    }

    // ── Álbum o Playlist de Spotify ──
    if (tipo === 'playlist' || tipo === 'album') {
        try {
            const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url.trim())}`;
            const data = await fetchJson(oembedUrl);
            if (data && data.title) {
                return {
                    tipo: tipo,
                    titulo: data.title,
                    thumbnail: data.thumbnail_url || null,
                    query: data.title,
                };
            }
        } catch (e) {
            console.error('Error resolviendo Spotify playlist oembed:', e?.message || e);
        }
    }

    return null;
}

module.exports = {
    esUrlSpotify,
    resolverSpotify,
};

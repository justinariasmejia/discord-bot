// src/services/spotify.js
// Extractor de metadatos de Spotify compatible con URLs internacionales (/intl-es/, etc.)
const https = require('https');

const SPOTIFY_REGEX = /spotify\.com\/(?:intl-[a-zA-Z-]+\/)?(track|album|playlist)\/([a-zA-Z0-9]+)/i;

function esUrlSpotify(url) {
    if (!url || typeof url !== 'string') return false;
    return SPOTIFY_REGEX.test(url.trim());
}

function fetchJson(url, redirects = 5) {
    return new Promise((resolve, reject) => {
        if (redirects < 0) return reject(new Error('Demasiados redireccionamientos'));
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(fetchJson(res.headers.location, redirects - 1));
            }
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
    const match = url.trim().match(SPOTIFY_REGEX);
    if (!match) return null;

    const tipo = match[1].toLowerCase();

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
        console.error('Error resolviendo Spotify oembed:', e?.message || e);
    }

    return null;
}

module.exports = {
    esUrlSpotify,
    resolverSpotify,
};

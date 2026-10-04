// src/utils/embeds.js
// Sistema central de embeds premium con estética de Halloween profesional.
const { EmbedBuilder } = require('discord.js');

const COLORES = {
    naranja: 0xff7518,
    morado: 0x6a0dad,
    negro: 0x1a1a1a,
    rojo: 0xb00020,
    verde: 0x2e7d32,
    azul: 0x1565c0,
    dorado: 0xffd700,
    teal: 0x00897b,
    rosa: 0xe91e63,
};

const formatoNum = (n) => Number(n).toLocaleString('es-DO');
const tiempoRelativo = (ms) => `<t:${Math.floor(ms / 1000)}:R>`;
const tiempoCorto = (ms) => `<t:${Math.floor(ms / 1000)}:f>`;

function base(titulo, descripcion, color = COLORES.naranja) {
    const emb = new EmbedBuilder()
        .setColor(color)
        .setTitle(titulo)
        .setTimestamp()
        .setFooter({ text: '🎃 La Cripta de los Huesos • Temporada Activa', iconURL: 'https://cdn.discordapp.com/emojis/1159187838853275708.webp' });

    if (descripcion && typeof descripcion === 'string' && descripcion.trim().length > 0) {
        emb.setDescription(descripcion);
    }
    return emb;
}

function basePremium(titulo, descripcion, color = COLORES.naranja) {
    const emb = new EmbedBuilder()
        .setColor(color)
        .setTitle(titulo)
        .setTimestamp()
        .setFooter({ text: '🎃 La Cripta de los Huesos', iconURL: 'https://cdn.discordapp.com/emojis/1159187838853275708.webp' });

    if (descripcion && typeof descripcion === 'string' && descripcion.trim().length > 0) {
        emb.setDescription(descripcion);
    }
    return emb;
}

const embedError = (descripcion) => base('💀 Algo salió mal', descripcion, COLORES.rojo);

const SEPARADOR = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
const SEPARADOR_FINO = '─────────────────────────────';
const BARRA_PROGRESO = (pct, largo = 10) => {
    const llenos = Math.round(pct * largo);
    const vacios = largo - llenos;
    return '█'.repeat(llenos) + '░'.repeat(vacios);
};

module.exports = { COLORES, formatoNum, tiempoRelativo, tiempoCorto, base, basePremium, embedError, SEPARADOR, SEPARADOR_FINO, BARRA_PROGRESO };

// Sistema central de embeds con la estética de Halloween.
const { EmbedBuilder } = require('discord.js');

const COLORES = {
    naranja: 0xff7518,
    morado: 0x6a0dad,
    negro: 0x1a1a1a,
    rojo: 0xb00020,
    verde: 0x2e7d32,
};

const formatoNum = (n) => Number(n).toLocaleString('es-DO');
const tiempoRelativo = (ms) => `<t:${Math.floor(ms / 1000)}:R>`;

function base(titulo, descripcion, color = COLORES.naranja) {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(titulo)
        .setDescription(descripcion)
        .setFooter({ text: '🎃 La Cripta de los Huesos' });
}

const embedError = (descripcion) => base('💀 Algo salió mal', descripcion, COLORES.rojo);

module.exports = { COLORES, formatoNum, tiempoRelativo, base, embedError };

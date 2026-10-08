// src/data/loot.js
// Tabla de botín para la cacería en la Cripta (Simplificada y gratificante).
const config = require('./config');

const TABLA_BOTIN = [
    {
        tipo: 'hueso_comun',
        peso: 55,
        titulo: '🦴 Huesos Comunes',
        descripcion: '¡Removiste la tierra fresca del cementerio y desenterraste huesos antiguos!',
    },
    {
        tipo: 'hueso_raro',
        peso: 25,
        titulo: '✨ Cráneo Dorado Ancestral',
        descripcion: '¡Increíble hallazgo! Un cráneo de oro puro descansaba bajo un mausoleo.',
    },
    {
        tipo: 'calabaza_sorpresa',
        peso: 20,
        titulo: '🎃 Calabaza Encantada',
        descripcion: '¡Encontraste una calabaza brillante repleta de huesos espectrales!',
    },
];

function numeroAleatorio(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function seleccionarResultadoPonderado() {
    const pesoTotal = TABLA_BOTIN.reduce((acc, entrada) => acc + entrada.peso, 0);
    let tiro = Math.random() * pesoTotal;

    for (const entrada of TABLA_BOTIN) {
        if (tiro < entrada.peso) return entrada;
        tiro -= entrada.peso;
    }
    return TABLA_BOTIN[0];
}

function generarBotinCaza() {
    const seleccion = seleccionarResultadoPonderado();

    if (seleccion.tipo === 'hueso_comun') {
        const huesos = numeroAleatorio(config.CAZAR.HUESOS_COMUN_MIN, config.CAZAR.HUESOS_COMUN_MAX);
        return {
            tipo: seleccion.tipo,
            titulo: seleccion.titulo,
            descripcion: seleccion.descripcion,
            huesosBase: huesos,
        };
    }

    if (seleccion.tipo === 'hueso_raro') {
        const huesos = numeroAleatorio(config.CAZAR.HUESOS_RARO_MIN, config.CAZAR.HUESOS_RARO_MAX);
        return {
            tipo: seleccion.tipo,
            titulo: seleccion.titulo,
            descripcion: seleccion.descripcion,
            huesosBase: huesos,
        };
    }

    // Calabaza sorpresa
    const huesos = numeroAleatorio(50, 110);
    return {
        tipo: seleccion.tipo,
        titulo: seleccion.titulo,
        descripcion: seleccion.descripcion,
        huesosBase: huesos,
    };
}

module.exports = {
    TABLA_BOTIN,
    generarBotinCaza,
    numeroAleatorio,
};

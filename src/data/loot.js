// src/data/loot.js
// Tabla de botín ponderada para la cacería en la Cripta.
const config = require('./config');
const { ITEMS } = require('./items');

const TABLA_BOTIN = [
    {
        tipo: 'hueso_comun',
        peso: 50,
        titulo: '🦴 Huesos Comunes',
        descripcion: '¡Removiste la tierra fresca y desenterraste huesos antiguos!',
    },
    {
        tipo: 'hueso_raro',
        peso: 15,
        titulo: '✨ Cráneo Dorado Ancestral',
        descripcion: '¡Increíble hallazgo! Un cráneo de oro puro descansaba bajo un mausoleo.',
    },
    {
        tipo: 'item',
        peso: 15,
        titulo: '🎁 Objeto Misterioso',
        descripcion: '¡Entre lápidas rotas y telarañas descubriste un artefacto intacto!',
    },
    {
        tipo: 'emboscada',
        peso: 10,
        titulo: '👻 ¡Emboscada de Espectros!',
        descripcion: '¡Un alma en pena emergió furiosa de las tumbas y te arrebató huesos en la oscuridad!',
    },
    {
        tipo: 'nada',
        peso: 10,
        titulo: '🍂 Tumba Vacía',
        descripcion: 'La niebla se disipa y solo encuentras polvo y lápidas rotas. Nada por aquí...',
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

    if (seleccion.tipo === 'item') {
        const clavesItems = Object.keys(ITEMS);
        const claveElegida = clavesItems[Math.floor(Math.random() * clavesItems.length)];
        const item = ITEMS[claveElegida];
        return {
            tipo: seleccion.tipo,
            titulo: seleccion.titulo,
            descripcion: seleccion.descripcion,
            item,
        };
    }

    if (seleccion.tipo === 'emboscada') {
        return {
            tipo: seleccion.tipo,
            titulo: seleccion.titulo,
            descripcion: seleccion.descripcion,
        };
    }

    // Tipo: 'nada'
    return {
        tipo: seleccion.tipo,
        titulo: seleccion.titulo,
        descripcion: seleccion.descripcion,
        huesosBase: 0,
    };
}

module.exports = {
    TABLA_BOTIN,
    generarBotinCaza,
    numeroAleatorio,
};

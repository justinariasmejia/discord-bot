// src/data/items.js
// Catálogo de ítems de la Cripta de los Huesos.

const ITEMS = {
    amuleto: {
        id: 'amuleto',
        nombre: 'Amuleto de Protección',
        emoji: '🧿',
        precio: 250,
        descripcion: 'Protege contra robos de otros jugadores durante 6 horas.',
        tipo: 'defensivo',
        duracionMs: 6 * 60 * 60 * 1000, // 6 horas
    },
    pocion_suerte: {
        id: 'pocion_suerte',
        nombre: 'Poción de Suerte',
        emoji: '🧪',
        precio: 180,
        descripcion: 'Aumenta en +5% tu probabilidad de victoria en tus próximas 3 apuestas.',
        tipo: 'consumible',
        usos: 3,
        bonoProbabilidad: 0.05,
    },
    doble_o_nada: {
        id: 'doble_o_nada',
        nombre: 'Doble o Nada',
        emoji: '⚡',
        precio: 120,
        descripcion: 'Tu próxima cacería duplica sus huesos o los pierde todos (50/50).',
        tipo: 'consumible',
        usos: 1,
    },
    linterna: {
        id: 'linterna',
        nombre: 'Linterna Espectral',
        emoji: '🏮',
        precio: 200,
        descripcion: 'Ilumina las sombras del cementerio mejorando el botín de caza por 2 horas.',
        tipo: 'herramienta',
        duracionMs: 2 * 60 * 60 * 1000, // 2 horas
    },
    llave_cofre: {
        id: 'llave_cofre',
        nombre: 'Llave del Cofre Maldito',
        emoji: '🗝️',
        precio: 300,
        descripcion: 'Llave forjada en el averno. Permite abrir cofres malditos en eventos aleatorios.',
        tipo: 'herramienta',
        usos: 1,
    },
};

module.exports = { ITEMS };

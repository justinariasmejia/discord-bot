// src/models/Usuario.js
const { Schema, model } = require('mongoose');

const usuarioSchema = new Schema(
    {
        userId: { type: String, required: true },
        guildId: { type: String, required: true },
        huesos: { type: Number, default: 100, min: 0 },
        rachaDiaria: { type: Number, default: 0 },
        ultimoDiario: { type: Date, default: null },
        ultimoCazar: { type: Date, default: null },
        ultimaLimosna: { type: Date, default: null },
        inventario: [{ _id: false, itemId: String, cantidad: { type: Number, default: 0 } }],
        efectos: [{ _id: false, tipo: String, expiraEn: Date, usosRestantes: Number, valor: Number }],
        estadisticas: {
            diarios: { type: Number, default: 0 },
            cazados: { type: Number, default: 0 },
            apostado: { type: Number, default: 0 },
            ganado: { type: Number, default: 0 },
            perdido: { type: Number, default: 0 },
            duelosGanados: { type: Number, default: 0 },
            duelosPerdidos: { type: Number, default: 0 },
            robosExitosos: { type: Number, default: 0 },
            robosFallidos: { type: Number, default: 0 },
            vecesRobado: { type: Number, default: 0 },
        },
    },
    { timestamps: true }
);

usuarioSchema.index({ userId: 1, guildId: 1 }, { unique: true });
usuarioSchema.index({ guildId: 1, huesos: -1 }); // para el ranking

module.exports = model('Usuario', usuarioSchema);

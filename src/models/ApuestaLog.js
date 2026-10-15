// src/models/ApuestaLog.js
const { Schema, model } = require('mongoose');

const apuestaLogSchema = new Schema(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    juego: { type: String, required: true }, // cara_cruz, dados, ruleta, tragamonedas, etc.
    monto: { type: Number, required: true },
    gano: { type: Boolean, required: true },
    premio: { type: Number, default: 0 },
    detalle: { type: String }, // texto descriptivo del resultado
    creadoEn: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = model('ApuestaLog', apuestaLogSchema);

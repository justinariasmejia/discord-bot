// src/models/DuelLog.js
const { Schema, model } = require('mongoose');

const duelLogSchema = new Schema(
  {
    guildId: { type: String, required: true },
    retadorId: { type: String, required: true },
    rivalId: { type: String, required: true },
    ganadorId: { type: String, required: true },
    perdedorId: { type: String, required: true },
    monto: { type: Number, required: true },
    premio: { type: Number, required: true },
    detalle: { type: String }, // texto descriptivo del duelo
    creadoEn: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = model('DuelLog', duelLogSchema);

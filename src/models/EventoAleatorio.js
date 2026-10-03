// src/models/EventoAleatorio.js
// Registro y estado de eventos aleatorios comunitarios activos en el servidor.
const { Schema, model } = require('mongoose');

const eventoAleatorioSchema = new Schema({
    guildId: { type: String, required: true },
    canalId: { type: String, required: true },
    mensajeId: { type: String, required: true },
    tipo: { type: String, enum: ['fantasma', 'trivia', 'cofre'], required: true },
    reclamado: { type: Boolean, default: false },
    reclamadoPor: { type: String, default: null },
    datos: { type: Schema.Types.Mixed, default: {} },
    expiraEn: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
});

module.exports = model('EventoAleatorio', eventoAleatorioSchema);

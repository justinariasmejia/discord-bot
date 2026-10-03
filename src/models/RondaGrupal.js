// src/models/RondaGrupal.js
const { Schema, model } = require('mongoose');

const rondaGrupalSchema = new Schema(
    {
        guildId: { type: String, required: true },
        canalId: { type: String, required: true },
        mensajeId: { type: String, default: null },
        estado: {
            type: String,
            enum: ['activa', 'finalizada', 'cancelada'],
            default: 'activa',
            index: true,
        },
        pozo: { type: Number, default: 0 },
        participantes: [
            {
                _id: false,
                userId: { type: String, required: true },
                monto: { type: Number, required: true },
                haSubido: { type: Boolean, default: false },
                fecha: { type: Date, default: Date.now },
            },
        ],
        ganadorId: { type: String, default: null },
        premioEntregado: { type: Number, default: 0 },
        expiraEn: { type: Date, required: true },
    },
    { timestamps: true }
);

rondaGrupalSchema.index({ canalId: 1, estado: 1 });

module.exports = model('RondaGrupal', rondaGrupalSchema);

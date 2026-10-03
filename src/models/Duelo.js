// src/models/Duelo.js
const { Schema, model } = require('mongoose');

const dueloSchema = new Schema(
    {
        guildId: { type: String, required: true },
        canalId: { type: String, required: true },
        mensajeId: { type: String, default: null },
        retadorId: { type: String, required: true, index: true },
        rivalId: { type: String, required: true, index: true },
        monto: { type: Number, required: true },
        estado: {
            type: String,
            enum: ['pendiente', 'activo', 'finalizado', 'cancelado', 'expirado'],
            default: 'pendiente',
            index: true,
        },
        fondosBloqueados: { type: Boolean, default: false },
        ganadorId: { type: String, default: null },
        premioEntregado: { type: Number, default: 0 },
        expiraEn: { type: Date, required: true },
    },
    { timestamps: true }
);

dueloSchema.index({ guildId: 1, estado: 1 });

module.exports = model('Duelo', dueloSchema);

const { Schema, model } = require('mongoose');

const cumpleanosSchema = new Schema(
    {
        guildId: { type: String, required: true, index: true },
        userId: { type: String, required: true, index: true },
        dia: { type: Number, required: true, min: 1, max: 31 },
        mes: { type: Number, required: true, min: 1, max: 12 },
        anio: { type: Number, default: null }, // Opcional
        ultimoFestejadoAnio: { type: Number, default: 0 }, // Para evitar felicitar doble en el mismo año
    },
    {
        timestamps: true,
    }
);

cumpleanosSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = model('Cumpleanos', cumpleanosSchema);

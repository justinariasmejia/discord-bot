const { Schema, model } = require('mongoose');

const lockdownSchema = new Schema(
    {
        guildId: { type: String, required: true, unique: true },
        activo: { type: Boolean, default: false },
        activadoPor: { type: String, default: null },
        fechaActivacion: { type: Date, default: null },
        canalesBloqueadosIds: { type: [String], default: [] },
    },
    { timestamps: true }
);

module.exports = model('Lockdown', lockdownSchema);

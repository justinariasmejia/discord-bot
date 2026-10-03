const { Schema, model } = require('mongoose');

// Registro de auditoría: cada movimiento de huesos queda guardado.
const transaccionSchema = new Schema({
    userId: { type: String, required: true, index: true },
    guildId: { type: String, required: true },
    tipo: { type: String, required: true }, // bienvenida, diario, cazar, apuesta, admin...
    monto: { type: Number, required: true }, // positivo = gana, negativo = pierde
    saldoDespues: { type: Number, required: true },
    detalle: { type: String, default: '' },
    fecha: { type: Date, default: Date.now },
});

transaccionSchema.index({ guildId: 1, fecha: -1 });

module.exports = model('Transaccion', transaccionSchema);

const { Schema, model } = require('mongoose');

const configSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    canalEventosId: { type: String, default: null },
    canalSalonFamaId: { type: String, default: null },
    mensajeSalonFamaId: { type: String, default: null },
    fechaCierre: { type: Date, required: true },
    estado: { type: String, enum: ['activo', 'finalizado'], default: 'activo' },
    multiplicador: { type: Number, default: 1 },
    multiplicadorExpira: { type: Date, default: null },
});

module.exports = model('ConfigEvento', configSchema);

const { Schema, model } = require('mongoose');

const ganadoresSchema = new Schema({
    guildId: { type: String, required: true },
    fecha: { type: Date, default: Date.now },
    top: [{ _id: false, puesto: Number, userId: String, huesos: Number }],
});

module.exports = model('Ganadores', ganadoresSchema);

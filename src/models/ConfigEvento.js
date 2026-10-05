const { Schema, model } = require('mongoose');

const configSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    // ── Canales Configurables ──
    canalEventosId: { type: String, default: null },       // Eventos aleatorios comunitarios
    canalSalonFamaId: { type: String, default: null },     // Ranking fijo (top 5 en vivo)
    mensajeSalonFamaId: { type: String, default: null },   // ID del mensaje editable del ranking
    canalLogsId: { type: String, default: null },           // Logs detallados de toda actividad
    canalAnunciosId: { type: String, default: null },       // Anuncios admin/moderación
    canalJuegosId: { type: String, default: null },         // Canal exclusivo para juegos/apuestas
    canalMusicaId: { type: String, default: null },         // Canal dedicado para pedidos de música
    mensajeMusicaId: { type: String, default: null },       // ID del panel permanente de música
    // ── Estado del Evento ──
    fechaCierre: { type: Date, required: true },
    estado: { type: String, enum: ['activo', 'finalizado'], default: 'activo' },
    multiplicador: { type: Number, default: 1 },
    multiplicadorExpira: { type: Date, default: null },
});

module.exports = model('ConfigEvento', configSchema);

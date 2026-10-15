const { Schema, model } = require('mongoose');

const configSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    // ── Canales Configurables ──
    canalEventosId: { type: String, default: null },       // Eventos aleatorios comunitarios
    canalSalonFamaId: { type: String, default: null },     // Ranking fijo (top 5 en vivo)
    mensajeSalonFamaId: { type: String, default: null },   // ID del mensaje editable del ranking
    canalLogsId: { type: String, default: null },           // Logs detallados de administración y seguridad
    canalLogsPublicosId: { type: String, default: null },   // Logs públicos en tiempo real de justificación de huesos
    canalLogsApuestasId: { type: String, default: null },   // Logs privados detallados de apuestas
    canalLogsDuelosId: { type: String, default: null },     // Logs privados detallados de duelos
    canalSancionesId: { type: String, default: null },       // Canal dedicado para el panel y registro de sanciones
    mensajeSancionesId: { type: String, default: null },     // ID del mensaje maestro fijo del panel de sanciones
    canalAnunciosId: { type: String, default: null },       // Anuncios admin/moderación
    canalJuegosId: { type: String, default: null },         // Canal exclusivo para juegos/apuestas
    canalMusicaId: { type: String, default: null },         // Canal dedicado para pedidos de música
    mensajeMusicaId: { type: String, default: null },       // ID del panel permanente de música
    canalStickersId: { type: String, default: null },       // Canal bóveda para guardar stickers y emojis robados
    canalCriptaId: { type: String, default: null },         // Canal dedicado para el centro interactivo de La Cripta
    mensajeCriptaId: { type: String, default: null },       // ID del mensaje maestro fijo con ranking en vivo
    canalAdminPanelId: { type: String, default: null },     // Canal dedicado para el panel permanente de administración
    mensajeAdminPanelId: { type: String, default: null },   // ID del mensaje maestro fijo del panel de administración
    // ── Panel y Sistema de Cumpleaños ──
    canalCumpleanosId: { type: String, default: null },     // Canal dedicado para el panel fijo de cumpleaños
    mensajeCumpleanosId: { type: String, default: null },   // ID del mensaje maestro fijo de cumpleaños
    canalAnunciosCumpleId: { type: String, default: '1332507353454743674' }, // Canal para felicitaciones y anuncios de cumpleaños
    rolCumpleanosId: { type: String, default: null },       // Rol asignado al cumpleañero del día
    rolNotificacionesCumpleId: { type: String, default: null }, // Rol para pings de avisos de cumpleaños
    // ── Notificaciones de Eventos de Halloween ──
    rolNotificacionesEventoId: { type: String, default: null }, // Rol para pings de trivias y eventos
    // ── Canales Permitidos para Recompensas de Chat ──
    canalesRecompensaChatIds: { type: [String], default: [] }, // Canales donde chatear da huesos
    cooldownChatSegundos: { type: Number, default: 60 },       // Cooldown en segundos entre ganancias por chat
    // ── Permisos de Administración del Evento ──
    rolesAdminIds: { type: [String], default: [] },        // Roles de Discord con acceso a comandos/panel admin
    usuariosAdminIds: { type: [String], default: [] },     // Usuarios directos con acceso a comandos/panel admin
    // ── Lista Negra del Evento (Blacklist) ──
    blacklistRolesIds: { type: [String], default: [] },       // Roles excluidos del evento
    blacklistUsuariosIds: { type: [String], default: [] },    // Usuarios excluidos del evento
    // ── Estado del Evento ──
    fechaCierre: { type: Date, required: true },
    estado: { type: String, enum: ['activo', 'finalizado'], default: 'activo' },
    multiplicador: { type: Number, default: 1 },
    multiplicadorExpira: { type: Date, default: null },
    // ── Modo de Pruebas (Test Mode) ──
    modoTest: { type: Boolean, default: false },
    canalTestId: { type: String, default: null },
    rolTesterId: { type: String, default: null }, // Rol para testers durante mantenimiento / modoTest
    testersIds: [{ type: String }], // IDs de usuarios testers individuales
});

module.exports = model('ConfigEvento', configSchema);

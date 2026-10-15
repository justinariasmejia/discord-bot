// src/events/ready.js
// Inicializador de servicios del bot al conectar.
const { iniciarServicioSalonFama } = require('../services/salonFama');
const { recuperarRondasPendientes } = require('../services/ruletaGrupal');
const { reembolsarDuelosPendientes } = require('../services/duelos');
const { iniciarServicioEventosAleatorios, limpiarMensajesExpiradosCanal } = require('../services/eventos-aleatorios');
const { iniciarServicioCierre } = require('../services/cierre');
const { setLogClient } = require('../services/logger');
const { cargarCanalesMusica } = require('../services/canalMusica');
const { cargarCanalesCripta, sincronizarPermisosCanalesFijos } = require('../services/canalCripta');
const { cargarCanalesAdminPanel } = require('../services/panelAdmin');
const { cargarCanalesCumpleanos, iniciarServicioCumpleanos } = require('../services/cumpleanos');
const { iniciarServicioBackups } = require('../services/backup');
const { iniciarServicioVoz } = require('../services/actividad');
const { setClientSanciones, actualizarPanelSanciones } = require('../services/panelSanciones');

module.exports = {
    name: 'clientReady',
    once: true,
    async ejecutar(client) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✅ Bot conectado como: ${client.user.tag}`);
        console.log(`📡 Servidores: ${client.guilds.cache.size}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Inicializar el cliente del logger
        setLogClient(client);

        // Asegurar que no existan comandos duplicados a nivel de servidor
        try {
            for (const guild of client.guilds.cache.values()) {
                await guild.commands.set([]);
            }
        } catch (err) {
            console.warn('⚠️ No se pudieron limpiar comandos duplicados de servidor:', err?.message || err);
        }

        // Cargar configuración de canales dedicados de música
        await cargarCanalesMusica(client);

        // Cargar panel permanente de La Cripta con Ranking en vivo
        await cargarCanalesCripta(client);

        // Asegurar que los canales dedicados (Cripta, Logs públicos, etc.) sean de solo lectura para @everyone
        await sincronizarPermisosCanalesFijos(client).catch(() => null);

        // Cargar panel permanente de Administración
        await cargarCanalesAdminPanel(client);

        // Cargar panel permanente de Cumpleaños
        await cargarCanalesCumpleanos(client);

        // Cargar y sincronizar panel permanente de Sanciones
        setClientSanciones(client);
        for (const guild of client.guilds.cache.values()) {
            actualizarPanelSanciones(guild.id, client).catch(() => null);
        }

        // Limpieza preventiva de mensajes de eventos o trivias expiradas en el canal
        for (const guild of client.guilds.cache.values()) {
            limpiarMensajesExpiradosCanal(client, guild.id).catch(() => null);
        }

        // Inicia el servicio de respaldos automáticos de base de datos cada 1 hora
        iniciarServicioBackups(client);

        // Reembolsar apuestas y duelos pendientes tras un reinicio inesperado
        await recuperarRondasPendientes(client);
        await reembolsarDuelosPendientes();

        // Inicia el servicio recurrente del Salón de la Fama (Ranking en vivo)
        iniciarServicioSalonFama(client);

        // Inicia el servicio de eventos aleatorios comunitarios
        iniciarServicioEventosAleatorios(client);

        // Inicia el verificador de cierre automático de eventos
        iniciarServicioCierre(client);

        // Inicia el servicio de recompensas por actividad en canales de voz
        iniciarServicioVoz(client);

        // Inicia el servicio de verificación y felicitación de cumpleaños
        iniciarServicioCumpleanos(client);
    },
};

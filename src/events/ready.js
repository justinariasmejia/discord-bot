// src/events/ready.js
// Inicializador de servicios del bot al conectar.
const { iniciarServicioSalonFama } = require('../services/salonFama');
const { reembolsarRondasPendientes } = require('../services/ruletaGrupal');
const { reembolsarDuelosPendientes } = require('../services/duelos');
const { iniciarServicioEventosAleatorios } = require('../services/eventos-aleatorios');
const { iniciarServicioCierre } = require('../services/cierre');
const { setLogClient } = require('../services/logger');

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

        // Reembolsar apuestas y duelos pendientes tras un reinicio inesperado
        await reembolsarRondasPendientes();
        await reembolsarDuelosPendientes();

        // Inicia el servicio recurrente del Salón de la Fama (Ranking en vivo)
        iniciarServicioSalonFama(client);

        // Inicia el servicio de eventos aleatorios comunitarios
        iniciarServicioEventosAleatorios(client);

        // Inicia el verificador de cierre automático de eventos
        iniciarServicioCierre(client);
    },
};

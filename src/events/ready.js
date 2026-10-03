// src/events/ready.js
// Inicializador de servicios del bot al conectar.
const { iniciarServicioSalonFama } = require('../services/salonFama');
const { reembolsarRondasPendientes } = require('../services/ruletaGrupal');
const { reembolsarDuelosPendientes } = require('../services/duelos');
const { iniciarServicioEventosAleatorios } = require('../services/eventos-aleatorios');
const { iniciarServicioCierre } = require('../services/cierre');

module.exports = {
    name: 'clientReady',
    once: true,
    async ejecutar(client) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✅ Bot conectado como: ${client.user.tag}`);
        console.log(`📡 Servidores: ${client.guilds.cache.size}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Reembolsar apuestas y duelos pendientes tras un reinicio inesperado
        await reembolsarRondasPendientes();
        await reembolsarDuelosPendientes();

        // Inicia el servicio recurrente del Salón de la Fama
        iniciarServicioSalonFama(client);

        // Inicia el servicio de eventos aleatorios comunitarios (Fase 5)
        iniciarServicioEventosAleatorios(client);

        // Inicia el verificador de cierre automático de eventos (Fase 5)
        iniciarServicioCierre(client);
    },
};

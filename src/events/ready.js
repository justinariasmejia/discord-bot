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

        // Sincronizar comandos slash al instante en todos los servidores
        try {
            const comandosData = Array.from(client.commands.values()).map((c) => c.data.toJSON());
            for (const guild of client.guilds.cache.values()) {
                await guild.commands.set(comandosData);
                console.log(`⚡ Comandos slash actualizados al instante en: ${guild.name}`);
            }
        } catch (err) {
            console.warn('⚠️ No se pudieron registrar comandos de servidor automáticamente:', err?.message || err);
        }

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

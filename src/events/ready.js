const { iniciarServicioSalonFama } = require('../services/salonFama');
const { reembolsarRondasPendientes } = require('../services/ruletaGrupal');
const { reembolsarDuelosPendientes } = require('../services/duelos');

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
    },
};

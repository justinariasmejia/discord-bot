// index.js - Punto de entrada de "La Cripta de los Huesos"
require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { conectarDB } = require('./src/database');
const { cargarComandos, cargarInteracciones, cargarEventos } = require('./src/loader');
const { inicializarShoukaku } = require('./src/services/musica');

// ─── Que el bot nunca se caiga por un error suelto ───
process.on('unhandledRejection', (error) => console.error('⚠️ unhandledRejection:', error));
process.on('uncaughtException', (error) => console.error('⚠️ uncaughtException:', error));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});
client.commands = new Collection();       // slash commands por nombre
client.interacciones = new Collection();  // botones/selects/modales por prefijo de customId

(async () => {
    for (const variable of ['DISCORD_TOKEN', 'CLIENT_ID', 'MONGODB_URI']) {
        if (!process.env[variable]) {
            console.error(`❌ Falta la variable de entorno ${variable}`);
            process.exit(1);
        }
    }

    await conectarDB();
    cargarComandos(client);
    cargarInteracciones(client);
    cargarEventos(client);

    // Inicializar Shoukaku para el sistema de música
    inicializarShoukaku(client);

    await client.login(process.env.DISCORD_TOKEN);
})();

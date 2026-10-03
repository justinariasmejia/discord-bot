// deploy-commands.js
// Registra o actualiza los comandos slash globalmente en la API de Discord.
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const comandos = [];
const rutaComandos = path.join(__dirname, 'src', 'commands');
const archivos = fs.readdirSync(rutaComandos).filter((f) => f.endsWith('.js'));

for (const archivo of archivos) {
    const comando = require(path.join(rutaComandos, archivo));
    if ('data' in comando && 'ejecutar' in comando) {
        comandos.push(comando.data.toJSON());
        console.log(`  + Preparado comando: /${comando.data.name}`);
    }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`📡 Registrando ${comandos.length} comandos slash globales...`);
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: comandos }
        );
        console.log(`✅ ${data.length} comandos slash registrados exitosamente con Discord.`);
    } catch (error) {
        console.error('❌ Error registrando comandos:', error);
    }
})();

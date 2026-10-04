// deploy-commands.js
// Registra o actualiza los comandos slash tanto globalmente como por servidor (disponibilidad instantánea).
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
        console.log(`✅ ${data.length} comandos slash globales registrados.`);

        // Sincronizar directamente en cada servidor para que aparezcan AL INSTANTE (0 segundos)
        const guilds = await rest.get(Routes.userGuilds());
        console.log(`⚡ Sincronizando comandos instantáneos en ${guilds.length} servidor(es)...`);
        for (const g of guilds) {
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, g.id),
                { body: comandos }
            );
            console.log(`   └─ ✅ Sincronizado instantáneo en: ${g.name} (${g.id})`);
        }
        console.log('🎉 ¡Todos los comandos están activos e instantáneamente disponibles en Discord!');
    } catch (error) {
        console.error('❌ Error registrando comandos:', error);
    }
})();

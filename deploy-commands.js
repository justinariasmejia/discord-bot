// deploy-commands.js
// Registra automáticamente todos los comandos de /src/commands.
// Uso: npm run deploy   (solo cuando agregues o cambies comandos)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const dir = path.join(__dirname, 'src', 'commands');
const commands = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => require(path.join(dir, f)).data.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('🔄 Registrando slash commands...');
        const ruta = process.env.GUILD_ID
            ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
            : Routes.applicationCommands(process.env.CLIENT_ID);

        await rest.put(ruta, { body: commands });

        console.log(`✅ Registrados (${process.env.GUILD_ID ? 'solo servidor' : 'globales'}):`);
        commands.forEach((c) => console.log(`   /${c.name} - ${c.description}`));
    } catch (error) {
        console.error('❌ Error registrando commands:', error);
        process.exit(1);
    }
})();

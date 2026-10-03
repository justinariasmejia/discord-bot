// deploy-commands.js
// Ejecuta este archivo UNA VEZ para registrar los slash commands en Discord
// Uso: node deploy-commands.js

require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('say')
        .setDescription('📝 Abre una ventana para escribir un mensaje que el bot enviará')
        .toJSON(),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('🔄 Registrando slash commands...');

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log('✅ Slash commands registrados exitosamente!');
        console.log('📋 Comandos registrados:');
        commands.forEach(cmd => {
            console.log(`   /${cmd.name} - ${cmd.description}`);
        });
    } catch (error) {
        console.error('❌ Error registrando commands:', error);
    }
})();

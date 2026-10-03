// index.js - Bot principal de Discord
// Comando /say → Abre un Modal → Bot envía el mensaje

require('dotenv').config();
const {
    Client,
    GatewayIntentBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

// ─── Crear el cliente del bot ───
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
    ],
});

// ─── Evento: Bot listo ───
client.once('ready', () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Bot conectado como: ${client.user.tag}`);
    console.log(`📡 Servidores: ${client.guilds.cache.size}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// ─── Evento: Interacción recibida ───
client.on('interactionCreate', async (interaction) => {

    // ── Manejar el slash command /say ──
    if (interaction.isChatInputCommand() && interaction.commandName === 'say') {

        // Crear el Modal (ventana emergente)
        const modal = new ModalBuilder()
            .setCustomId('sayModal')
            .setTitle('📝 Enviar mensaje como bot');

        // Campo de texto para el mensaje
        const messageInput = new TextInputBuilder()
            .setCustomId('messageContent')
            .setLabel('¿Qué quieres que diga el bot?')
            .setPlaceholder('Escribe tu mensaje aquí...')
            .setStyle(TextInputStyle.Paragraph) // Párrafo = múltiples líneas
            .setRequired(true)
            .setMaxLength(2000); // Límite de Discord

        // Agregar el campo al modal
        const actionRow = new ActionRowBuilder().addComponents(messageInput);
        modal.addComponents(actionRow);

        // Mostrar el modal al usuario
        await interaction.showModal(modal);
    }

    // ── Manejar la respuesta del Modal ──
    if (interaction.isModalSubmit() && interaction.customId === 'sayModal') {

        // Obtener el texto que escribió el usuario
        const message = interaction.fields.getTextInputValue('messageContent');

        // Enviar el mensaje en el canal como el bot
        await interaction.channel.send(message);

        // Responder al usuario de forma efímera (solo él lo ve)
        await interaction.reply({
            content: '✅ ¡Mensaje enviado!',
            flags: 64, // Ephemeral - solo el usuario lo ve
        });
    }
});

// ─── Iniciar el bot ───
client.login(process.env.DISCORD_TOKEN);

// src/commands/tts.js
// Comando slash para activar, configurar y controlar el lector de chat de voz (Text-to-Speech / TTS).

const {
    SlashCommandBuilder,
    ChannelType,
    MessageFlags,
} = require('discord.js');
const {
    activarTTS,
    desactivarTTS,
    encolarTexto,
    obtenerEstadoTTS,
    cambiarIdiomaTTS,
    alternarNombreTTS,
    IDIOMAS_SOPORTADOS,
} = require('../services/tts');
const { basePremium, COLORES } = require('../utils/embeds');

const OPCIONES_IDIOMA = [
    { name: 'Español (Latino/Neutro)', value: 'es' },
    { name: 'Español (España)', value: 'es-es' },
    { name: 'Inglés', value: 'en' },
    { name: 'Portugués', value: 'pt' },
    { name: 'Francés', value: 'fr' },
    { name: 'Italiano', value: 'it' },
    { name: 'Alemán', value: 'de' },
    { name: 'Japonés', value: 'ja' },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tts')
        .setDescription('🗣️ Lector de chat de voz (Text-to-Speech / Say)')
        // ── Subcomando: Activar ──
        .addSubcommand((sub) =>
            sub
                .setName('activar')
                .setDescription('Conecta el bot a tu canal de voz y lee lo que escribas en el chat')
                .addStringOption((opt) =>
                    opt
                        .setName('idioma')
                        .setDescription('Idioma o acento de la voz (Por defecto: Español)')
                        .setRequired(false)
                        .addChoices(...OPCIONES_IDIOMA)
                )
                .addBooleanOption((opt) =>
                    opt
                        .setName('decir_nombre')
                        .setDescription('¿Indicar quién escribió el mensaje antes de leerlo? (Por defecto: Sí)')
                        .setRequired(false)
                )
        )
        // ── Subcomando: Desactivar / Salir ──
        .addSubcommand((sub) =>
            sub
                .setName('desactivar')
                .setDescription('Desactiva el lector de voz y desconecta al bot de la llamada')
        )
        // ── Subcomando: Decir directamente ──
        .addSubcommand((sub) =>
            sub
                .setName('decir')
                .setDescription('Hace que el bot pronuncie una frase específica en tu canal de voz')
                .addStringOption((opt) =>
                    opt
                        .setName('texto')
                        .setDescription('Texto que el bot dirá en voz alta (Máx. 200 caracteres)')
                        .setRequired(true)
                        .setMaxLength(200)
                )
        )
        // ── Subcomando: Cambiar Idioma ──
        .addSubcommand((sub) =>
            sub
                .setName('idioma')
                .setDescription('Cambia el idioma o acento de la voz activa')
                .addStringOption((opt) =>
                    opt
                        .setName('nuevo_idioma')
                        .setDescription('Elige el idioma deseado')
                        .setRequired(true)
                        .addChoices(...OPCIONES_IDIOMA)
                )
        )
        // ── Subcomando: Estado ──
        .addSubcommand((sub) =>
            sub
                .setName('estado')
                .setDescription('Verifica si el lector de voz está activo y en qué canal')
        ),

    async ejecutar(interaction, client) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;
        const canalVoz = interaction.member?.voice?.channel;

        // ── 1. ACTIVAR TTS ──
        if (sub === 'activar') {
            if (!canalVoz) {
                return interaction.reply({
                    embeds: [basePremium('❌ No estás en un canal de voz', 'Únete a un canal de voz primero para activar el lector TTS.', COLORES.rojo)],
                    flags: MessageFlags.Ephemeral,
                });
            }

            await interaction.deferReply();
            const idioma = interaction.options.getString('idioma') || 'es';
            const incluirNombre = interaction.options.getBoolean('decir_nombre') ?? true;

            try {
                await activarTTS({
                    guildId,
                    canalVozId: canalVoz.id,
                    canalTextoId: interaction.channelId,
                    idioma,
                    incluirNombre,
                    client,
                });

                const embed = basePremium(
                    '🗣️ Lector de Voz Activado',
                    `El bot se ha unido a **${canalVoz.name}** y leerá en voz alta todo lo que escriban en el chat.\n\n` +
                    `• 🎙️ **Canal de Voz:** <#${canalVoz.id}>\n` +
                    `• 🌐 **Idioma / Acento:** \`${IDIOMAS_SOPORTADOS[idioma] || idioma}\`\n` +
                    `• 👤 **Decir autor:** ${incluirNombre ? '✅ Activado ("Usuario dice: ...")' : '❌ Desactivado (Solo el texto)'}\n` +
                    `• ⏱️ **Auto-desconexión:** Se desconectará automáticamente si pasa 5 minutos sin actividad.\n\n` +
                    `💡 *¡Solo escribe en este chat y el bot lo pronunciará en llamada! Para desconectarlo usa \`/tts desactivar\`.*`,
                    COLORES.verde
                );

                return interaction.editReply({ embeds: [embed] });
            } catch (err) {
                return interaction.editReply({
                    embeds: [basePremium('❌ Error al activar TTS', err.message, COLORES.rojo)],
                });
            }
        }

        // ── 2. DESACTIVAR TTS ──
        if (sub === 'desactivar') {
            const estado = obtenerEstadoTTS(guildId);
            if (!estado.activo) {
                return interaction.reply({
                    embeds: [basePremium('ℹ️ Lector de Voz Inactivo', 'El lector de voz no está activo actualmente en este servidor.', COLORES.morado)],
                    flags: MessageFlags.Ephemeral,
                });
            }

            desactivarTTS(guildId, 'desactivado por comando');

            return interaction.reply({
                embeds: [basePremium(
                    '🔇 Lector de Voz Desactivado',
                    'El bot ha detenido la lectura y se ha desconectado del canal de voz.',
                    COLORES.rojo
                )],
            });
        }

        // ── 3. DECIR TEXTO DIRECTO ──
        if (sub === 'decir') {
            const texto = interaction.options.getString('texto');
            let estado = obtenerEstadoTTS(guildId);

            if (!estado.activo) {
                if (!canalVoz) {
                    return interaction.reply({
                        embeds: [basePremium('❌ No estás en un canal de voz', 'Únete a un canal de voz primero para que el bot hable.', COLORES.rojo)],
                        flags: MessageFlags.Ephemeral,
                    });
                }

                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                try {
                    await activarTTS({
                        guildId,
                        canalVozId: canalVoz.id,
                        canalTextoId: interaction.channelId,
                        idioma: 'es',
                        incluirNombre: false,
                        client,
                    });
                } catch (err) {
                    return interaction.editReply({
                        embeds: [basePremium('❌ Error al conectar', err.message, COLORES.rojo)],
                    });
                }
            } else {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            }

            const autor = interaction.member?.displayName || interaction.user.username;
            encolarTexto(guildId, texto, interaction.user.id, autor);

            return interaction.editReply({
                embeds: [basePremium(
                    '📢 Mensaje Enviado a Voz',
                    `🗣️ Reproduciendo en llamada:\n> *"${texto}"*`,
                    COLORES.verde
                )],
            });
        }

        // ── 4. CAMBIAR IDIOMA ──
        if (sub === 'idioma') {
            const estado = obtenerEstadoTTS(guildId);
            if (!estado.activo) {
                return interaction.reply({
                    embeds: [basePremium('ℹ️ Lector Inactivo', 'Activa primero el lector con `/tts activar`.', COLORES.morado)],
                    flags: MessageFlags.Ephemeral,
                });
            }

            const nuevoIdioma = interaction.options.getString('nuevo_idioma');
            const cambiado = cambiarIdiomaTTS(guildId, nuevoIdioma);

            if (!cambiado) {
                return interaction.reply({
                    content: '❌ Idioma no soportado.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            return interaction.reply({
                embeds: [basePremium(
                    '🌐 Idioma de Voz Actualizado',
                    `El lector ahora hablará en: **${IDIOMAS_SOPORTADOS[nuevoIdioma]}**.`,
                    COLORES.verde
                )],
            });
        }

        // ── 5. CONSULTAR ESTADO ──
        if (sub === 'estado') {
            const estado = obtenerEstadoTTS(guildId);

            if (!estado.activo) {
                return interaction.reply({
                    embeds: [basePremium(
                        '🔇 Estado del Lector de Voz',
                        'El lector TTS **no está activo** actualmente.\n\nPara iniciarlo, únete a un canal de voz y escribe `/tts activar`.',
                        COLORES.morado
                    )],
                    flags: MessageFlags.Ephemeral,
                });
            }

            const embed = basePremium(
                '🗣️ Estado del Lector de Voz (TTS)',
                `• 🟢 **Estado:** Activo en llamada\n` +
                `• 🎙️ **Canal de Voz:** <#${estado.canalVozId}>\n` +
                `• 💬 **Canal de Texto:** <#${estado.canalTextoId}>\n` +
                `• 🌐 **Idioma:** \`${estado.idiomaNombre}\`\n` +
                `• 👤 **Decir Autor:** ${estado.incluirNombre ? 'Sí' : 'No'}\n` +
                `• 📋 **Mensajes en cola:** \`${estado.colaLength}\`\n` +
                `• 🔊 **Hablando ahora:** ${estado.hablando ? 'Sí' : 'En espera'}`,
                COLORES.verde
            );

            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    },
};

// src/commands/canales-chat.js
// Configuración de canales habilitados para ganar huesos por actividad de chat y cooldown.
const {
    SlashCommandBuilder,
    ChannelType,
    MessageFlags,
} = require('discord.js');
const ConfigEvento = require('../models/ConfigEvento');
const { esAdminAsync } = require('../services/evento');
const { basePremium, COLORES } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('canales-chat')
        .setDescription('💬 Configura en qué canales se ganan huesos al chatear y su cooldown')
        // ── Agregar Canal ──
        .addSubcommand((sub) =>
            sub
                .setName('agregar')
                .setDescription('Habilita un canal para otorgar huesos por chatear')
                .addChannelOption((opt) =>
                    opt.setName('canal')
                        .setDescription('Canal de texto a habilitar')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
        )
        // ── Quitar Canal ──
        .addSubcommand((sub) =>
            sub
                .setName('quitar')
                .setDescription('Remueve un canal de las recompensas de chat')
                .addChannelOption((opt) =>
                    opt.setName('canal')
                        .setDescription('Canal de texto a remover')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
        )
        // ── Listar Canales y Cooldown ──
        .addSubcommand((sub) =>
            sub
                .setName('listar')
                .setDescription('Muestra los canales habilitados y el cooldown configurado')
        )
        // ── Fijar Cooldown ──
        .addSubcommand((sub) =>
            sub
                .setName('cooldown')
                .setDescription('Configura el tiempo de espera (en segundos) entre ganancias por chatear')
                .addIntegerOption((opt) =>
                    opt.setName('segundos')
                        .setDescription('Tiempo de espera en segundos (ej. 60)')
                        .setRequired(true)
                        .setMinValue(10)
                        .setMaxValue(600)
                )
        )
        // ── Habilitar Todos ──
        .addSubcommand((sub) =>
            sub
                .setName('todos')
                .setDescription('Permite ganar huesos en cualquier canal de texto general (con cooldown)')
        ),

    async ejecutar(interaction, client) {
        const autorizado = await esAdminAsync(interaction.member, interaction.guildId);
        if (!autorizado) {
            return interaction.reply({
                content: '🔒 No tienes permisos de administración para configurar los canales de recompensas.',
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        let conf = await ConfigEvento.findOne({ guildId });
        if (!conf) {
            conf = await ConfigEvento.create({
                guildId,
                fechaCierre: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            });
        }

        // ── 1. Agregar Canal ──
        if (sub === 'agregar') {
            const canal = interaction.options.getChannel('canal');
            const lista = conf.canalesRecompensaChatIds || [];

            if (lista.includes(canal.id)) {
                return interaction.editReply({
                    content: `ℹ️ El canal <#${canal.id}> ya estaba habilitado para recompensas de chat.`,
                });
            }

            conf.canalesRecompensaChatIds = [...lista, canal.id];
            await conf.save();

            return interaction.editReply({
                embeds: [basePremium(
                    '✅ Canal de Recompensa Habilitado',
                    `Los miembros ahora podrán ganar huesos al escribir en <#${canal.id}> (respetando el cooldown de ${conf.cooldownChatSegundos || 60}s).`,
                    COLORES.verde
                )],
            });
        }

        // ── 2. Quitar Canal ──
        if (sub === 'quitar') {
            const canal = interaction.options.getChannel('canal');
            const lista = conf.canalesRecompensaChatIds || [];

            if (!lista.includes(canal.id)) {
                return interaction.editReply({
                    content: `ℹ️ El canal <#${canal.id}> no estaba en la lista de recompensas de chat.`,
                });
            }

            conf.canalesRecompensaChatIds = lista.filter((id) => id !== canal.id);
            await conf.save();

            return interaction.editReply({
                embeds: [basePremium(
                    '🗑️ Canal de Recompensa Removido',
                    `El canal <#${canal.id}> ha sido retirado. Ya no otorgará huesos al chatear.`,
                    COLORES.naranja
                )],
            });
        }

        // ── 3. Listar Canales y Cooldown ──
        if (sub === 'listar') {
            const lista = conf.canalesRecompensaChatIds || [];
            const cd = conf.cooldownChatSegundos || 60;

            let canalesStr = '';
            if (lista.length === 0) {
                canalesStr = '🌐 **Modo General:** Todos los canales de texto estándar otorgan huesos (excepto canales dedicados de La Cripta o logs).';
            } else {
                canalesStr = '### 💬 Canales Exclusivos Habilitados:\n' + lista.map((id) => `• <#${id}>`).join('\n');
            }

            const embed = basePremium(
                '⚙️ Configuración de Recompensas de Chat',
                `${canalesStr}\n\n` +
                `⏱️ **Cooldown actual:** **${cd} segundos** *(cada usuario puede ganar huesos como máximo 1 vez cada ${cd}s).*\n\n` +
                `🦴 **Recompensa por mensaje:** entre 2 y 5 huesos (afectado por multiplicador global de eventos).`,
                COLORES.azul
            );

            return interaction.editReply({ embeds: [embed] });
        }

        // ── 4. Modificar Cooldown ──
        if (sub === 'cooldown') {
            const segundos = interaction.options.getInteger('segundos');
            conf.cooldownChatSegundos = segundos;
            await conf.save();

            return interaction.editReply({
                embeds: [basePremium(
                    '⏱️ Cooldown de Chat Actualizado',
                    `Se ha establecido un tiempo de espera de **${segundos} segundos** entre ganancias de huesos por chatear.`,
                    COLORES.verde
                )],
            });
        }

        // ── 5. Permitir Todos los Canales ──
        if (sub === 'todos') {
            conf.canalesRecompensaChatIds = [];
            await conf.save();

            return interaction.editReply({
                embeds: [basePremium(
                    '🌐 Modo General Activado',
                    'Ahora cualquier canal de texto general del servidor otorgará recompensas de huesos al chatear (manteniendo el cooldown configurado de ' + (conf.cooldownChatSegundos || 60) + 's).',
                    COLORES.verde
                )],
            });
        }
    },
};

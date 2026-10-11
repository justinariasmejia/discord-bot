// src/commands/duelos.js
// Comando /duelos directo para retarse por huesos en el canal donde se escribe.
const {
    SlashCommandBuilder,
    MessageFlags,
} = require('discord.js');
const { crearDuelo, filaInvitacionDuelo } = require('../services/duelos');
const { obtenerConfig, puedeInteractuarEvento } = require('../services/evento');
const { base, COLORES, formatoNum } = require('../utils/embeds');
const Duelo = require('../models/Duelo');
const config = require('../data/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('duelos')
        .setDescription('⚔️ Desafía a otro cazador a un duelo de reflejos por huesos')
        .addUserOption((opt) =>
            opt
                .setName('usuario')
                .setDescription('El cazador al que deseas desafiar')
                .setRequired(true)
        )
        .addIntegerOption((opt) =>
            opt
                .setName('monto')
                .setDescription('Cantidad de huesos a apostar (mínimo 10)')
                .setMinValue(10)
                .setRequired(true)
        ),

    async ejecutar(interaction) {
        const rival = interaction.options.getUser('usuario');
        const monto = interaction.options.getInteger('monto');
        const canal = interaction.channel;

        // 1. Verificación de permisos y estado del evento
        const conf = await obtenerConfig(interaction.guildId);
        const check = puedeInteractuarEvento(conf, interaction.member, interaction.channelId);
        if (!check.permitido) {
            return interaction.reply({ content: check.mensaje, flags: MessageFlags.Ephemeral });
        }

        // 2. No permitir duelos en canales fijos protegidos de solo lectura (Cripta o Logs)
        if (interaction.channelId === conf.canalCriptaId || interaction.channelId === conf.canalLogsPublicosId) {
            return interaction.reply({
                content: `⚠️ No puedes iniciar duelos en este canal de solo lectura. Escribe `/duelos` en <#${conf.canalEventosId || interaction.channelId}> o en cualquier canal de chat general.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        // 3. Validaciones de participantes
        if (rival.id === interaction.user.id) {
            return interaction.reply({
                content: '💀 No puedes retarte en duelo a ti mismo.',
                flags: MessageFlags.Ephemeral,
            });
        }

        if (rival.bot) {
            return interaction.reply({
                content: '🤖 Los autómatas no tienen alma ni huesos para apostar.',
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // 4. Crear el duelo en la base de datos exactamente en este canal
        const res = await crearDuelo(interaction.guildId, canal.id, interaction.user.id, rival.id, monto);

        if (!res.ok) {
            if (res.motivo === 'monto_invalido') {
                return interaction.editReply({
                    content: `❌ Monto inválido. La apuesta mínima es de **${res.min}** huesos.`,
                });
            }
            if (res.motivo === 'saldo_insuficiente') {
                return interaction.editReply({
                    content: `❌ Saldo insuficiente. Tienes **${formatoNum(res.saldo)}** huesos.`,
                });
            }
            if (res.motivo === 'duelo_en_progreso') {
                return interaction.editReply({
                    content: '❌ Uno de los dos jugadores ya tiene un duelo pendiente o activo.',
                });
            }
            if (res.motivo === 'blacklist') {
                return interaction.editReply({
                    content: '🚫 Uno de los participantes está en la lista negra y no puede participar en duelos.',
                });
            }
            if (res.motivo === 'modo_test') {
                return interaction.editReply({
                    content: '🛠️ **Duelos Deshabilitados:** El evento se encuentra actualmente en pausa/mantenimiento.',
                });
            }
            return interaction.editReply({
                content: '❌ No se pudo iniciar el duelo en este momento.',
            });
        }

        const duelo = res.duelo;
        const embedInvitacion = base(
            '⚔️ ¡DESAFÍO DE DUELO A MUERTE!',
            `¡<@${interaction.user.id}> ha arrojado el guante y reta a <@${rival.id}> a un duelo de honor!\n\n` +
            `🦴 **Apuesta por jugador:** **${formatoNum(duelo.monto)}** huesos\n` +
            `💰 **Pozo total en juego:** **${formatoNum(duelo.monto * 2)}** huesos\n` +
            `⏳ Tienes **60 segundos** para aceptar o declinar el reto.`,
            COLORES.naranja
        );

        // Enviar la invitación DIRECTAMENTE en el canal donde se ejecutó el comando
        const msgPublico = await canal.send({
            content: `🔔 ¡Atención <@${rival.id}>! Tienes un reto de duelo pendiente de <@${interaction.user.id}>.`,
            embeds: [embedInvitacion],
            components: [filaInvitacionDuelo(duelo._id.toString())],
        });

        duelo.mensajeId = msgPublico.id;
        await duelo.save();

        // Temporizador de expiración a los 60s
        setTimeout(async () => {
            const dueloCheck = await Duelo.findOne({ _id: duelo._id, estado: 'pendiente' });
            if (dueloCheck) {
                dueloCheck.estado = 'expirado';
                await dueloCheck.save();
                const embedExpirado = base(
                    '⚔️ Duelo Expirado',
                    `El tiempo de respuesta se agotó. El desafío entre <@${duelo.retadorId}> y <@${duelo.rivalId}> ha quedado en el olvido.`,
                    COLORES.negro
                );
                await msgPublico.edit({ embeds: [embedExpirado], components: [filaInvitacionDuelo(duelo._id.toString(), true)] }).catch(() => null);
            }
        }, config.DUELOS.TIMEOUT_ACEPTAR_MS);

        return interaction.editReply({
            content: `✅ ¡Desafío enviado a <@${rival.id}> en este canal!`,
        });
    },
};

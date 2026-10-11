// src/commands/duelo.js
// Comando /duelo para retarse por huesos.
const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    UserSelectMenuBuilder,
    MessageFlags,
} = require('discord.js');
const { crearDuelo, filaInvitacionDuelo } = require('../services/duelos');
const { obtenerConfig } = require('../services/evento');
const { base, COLORES, formatoNum } = require('../utils/embeds');
const Duelo = require('../models/Duelo');
const config = require('../data/config');

async function procesarComandoDuelo(interaction) {
    const rival = interaction.options.getUser('usuario');
    const monto = interaction.options.getInteger('monto');

    // 1. Si no especificó rival, mostrar menú desplegable para elegir contrincante
    if (!rival) {
        const filaSelect = new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder()
                .setCustomId(`cripta:hub_sel_duelo:${interaction.user.id}`)
                .setPlaceholder('🎯 Selecciona un cazador para retar a duelo...')
                .setMinValues(1)
                .setMaxValues(1)
        );

        const embedDuelo = base(
            '⚔️ Desafío de Duelo PvP',
            'Selecciona al cazador al que deseas desafiar por huesos.\n' +
            'Ambos deberán reaccionar con rapidez cuando la campana fúnebre suene para quedarse con la apuesta.',
            COLORES.rojo
        );

        return interaction.reply({
            embeds: [embedDuelo],
            components: [filaSelect],
            flags: MessageFlags.Ephemeral,
        });
    }

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

    // 2. Si especificó rival pero NO monto, abrir modal para que ingrese la cantidad
    if (!monto) {
        const modal = new ModalBuilder()
            .setCustomId(`duelo:modal_crear:${interaction.user.id}:${rival.id}`)
            .setTitle(`⚔️ Duelo vs ${rival.username.slice(0, 20)}`);

        const inputMonto = new TextInputBuilder()
            .setCustomId('monto')
            .setLabel('¿Cuántos huesos apuestas?')
            .setPlaceholder('Mínimo 10 huesos')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(6);

        modal.addComponents(new ActionRowBuilder().addComponents(inputMonto));
        return interaction.showModal(modal);
    }

    // 3. Si especificó rival Y monto directamente (/duelo @usuario 50)
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Determinar canal de destino adecuado (no contaminar canales de solo lectura)
    const conf = await obtenerConfig(interaction.guildId);
    let targetCanal = interaction.channel;
    const canalDestinoId = conf?.canalJuegosId || conf?.canalEventosId;
    if (canalDestinoId && (interaction.channelId === conf?.canalCriptaId || interaction.channelId === conf?.canalLogsPublicosId)) {
        targetCanal = interaction.client.channels.cache.get(canalDestinoId) || await interaction.client.channels.fetch(canalDestinoId).catch(() => null) || interaction.channel;
    }

    const res = await crearDuelo(interaction.guildId, targetCanal.id, interaction.user.id, rival.id, monto);

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
                content: '🛠️ **Duelos Deshabilitados:** El evento se encuentra actualmente en pausa técnica.',
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

    const msgPublico = await targetCanal.send({
        content: `🔔 ¡Atención <@${rival.id}>! Tienes un reto de duelo pendiente.`,
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
        content: `✅ ¡Desafío enviado a <@${rival.id}> en <#${targetCanal.id}>! Que la suerte esté de tu lado.`,
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('duelo')
        .setDescription('⚔️ Desafía a otro cazador a un duelo de reflejos por huesos')
        .addUserOption((opt) =>
            opt.setName('usuario').setDescription('El cazador al que deseas desafiar').setRequired(false)
        )
        .addIntegerOption((opt) =>
            opt.setName('monto').setDescription('Cantidad de huesos a apostar (mínimo 10)').setMinValue(10).setRequired(false)
        ),

    ejecutar: procesarComandoDuelo,
    procesarComandoDuelo,
};

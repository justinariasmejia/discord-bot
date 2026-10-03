// src/services/duelos.js
// Sistema de duelos entre jugadores con juego de reacción y persistencia.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Duelo = require('../models/Duelo');
const Usuario = require('../models/Usuario');
const { modificarHuesos, obtenerUsuario } = require('./economia');
const { obtenerConfig, eventoActivo } = require('./evento');
const { conBloqueo } = require('../utils/locks');
const { base, COLORES, formatoNum } = require('../utils/embeds');
const config = require('../data/config');

// Reembolsa duelos interrumpidos si el bot se reinicia
async function reembolsarDuelosPendientes() {
    try {
        const activos = await Duelo.find({ estado: 'activo', fondosBloqueados: true });
        for (const duelo of activos) {
            await modificarHuesos(duelo.retadorId, duelo.guildId, duelo.monto, 'reembolso', 'Reembolso de Duelo por reinicio');
            await modificarHuesos(duelo.rivalId, duelo.guildId, duelo.monto, 'reembolso', 'Reembolso de Duelo por reinicio');
            duelo.estado = 'cancelado';
            await duelo.save();
        }
        await Duelo.updateMany({ estado: 'pendiente' }, { $set: { estado: 'expirado' } });
        if (activos.length > 0) {
            console.log(`🔄 Reembolsados ${activos.length} duelos activos tras reinicio.`);
        }
    } catch (err) {
        console.error('Error reembolsando duelos pendientes:', err);
    }
}

function filaInvitacionDuelo(dueloId, deshabilitado = false) {
    const btnAceptar = new ButtonBuilder()
        .setCustomId(`duelo:aceptar:publico:${dueloId}`)
        .setLabel('Aceptar Desafío ⚔️')
        .setStyle(ButtonStyle.Success)
        .setDisabled(deshabilitado);

    const btnRechazar = new ButtonBuilder()
        .setCustomId(`duelo:rechazar:publico:${dueloId}`)
        .setLabel('Declinar / Cancelar 🏳️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(deshabilitado);

    return new ActionRowBuilder().addComponents(btnAceptar, btnRechazar);
}

function filaSenueloDuelo(dueloId) {
    const btnSenuelo = new ButtonBuilder()
        .setCustomId(`duelo:senuelo:publico:${dueloId}`)
        .setLabel('⏳ ¡Espera la señal! (No toques)')
        .setStyle(ButtonStyle.Secondary);
    return new ActionRowBuilder().addComponents(btnSenuelo);
}

function filaDispararDuelo(dueloId) {
    const btnDisparar = new ButtonBuilder()
        .setCustomId(`duelo:disparar:publico:${dueloId}`)
        .setLabel('💥 ¡¡DISPARA YA!!')
        .setStyle(ButtonStyle.Danger);
    return new ActionRowBuilder().addComponents(btnDisparar);
}

async function crearDuelo(guildId, canalId, retadorId, rivalId, monto) {
    const confEvento = await obtenerConfig(guildId);
    if (!eventoActivo(confEvento)) return { ok: false, motivo: 'evento_cerrado' };

    const retador = await obtenerUsuario(retadorId, guildId);
    monto = Math.trunc(Number(monto));

    if (isNaN(monto) || monto < config.APUESTAS.MINIMA) {
        return { ok: false, motivo: 'monto_invalido', min: config.APUESTAS.MINIMA };
    }

    if (retador.huesos < monto) {
        return { ok: false, motivo: 'saldo_insuficiente', saldo: retador.huesos };
    }

    const dueloActivo = await Duelo.findOne({
        guildId,
        $or: [
            { retadorId, estado: { $in: ['pendiente', 'activo'] } },
            { rivalId: retadorId, estado: { $in: ['pendiente', 'activo'] } },
            { retadorId: rivalId, estado: { $in: ['pendiente', 'activo'] } },
            { rivalId, estado: { $in: ['pendiente', 'activo'] } },
        ],
    });

    if (dueloActivo) {
        return { ok: false, motivo: 'duelo_en_progreso' };
    }

    const expiraEn = new Date(Date.now() + config.DUELOS.TIMEOUT_ACEPTAR_MS);
    const duelo = await Duelo.create({
        guildId,
        canalId,
        retadorId,
        rivalId,
        monto,
        expiraEn,
        estado: 'pendiente',
    });

    return { ok: true, duelo };
}

async function iniciarMinijuegoDuelo(dueloId, canal) {
    const duelo = await Duelo.findById(dueloId);
    if (!duelo || duelo.estado !== 'activo') return;

    const mensaje = await canal.messages.fetch(duelo.mensajeId).catch(() => null);
    if (!mensaje) return;

    // Paso 1: Cuenta regresiva y señuelo
    const embedEspera = base(
        '⚔️ ¡Duelo en Progreso!',
        `**<@${duelo.retadorId}>** vs **<@${duelo.rivalId}>**\n\n` +
        `💰 **Pozo en disputa:** **${formatoNum(duelo.monto * 2)}** huesos 🦴\n\n` +
        `👀 *Prepárense... Desenvainen sus armas...*\n` +
        `⚠️ **¡Cuidado!** Presionar antes de la señal es un tiro en falso y perderás automáticamente.`,
        COLORES.morado
    );

    await mensaje.edit({
        embeds: [embedEspera],
        components: [filaSenueloDuelo(dueloId)],
    }).catch(() => null);

    // Retardo aleatorio de 2 a 5 segundos
    const delay = Math.floor(Math.random() * (config.DUELOS.DELAY_MAX_MS - config.DUELOS.DELAY_MIN_MS + 1)) + config.DUELOS.DELAY_MIN_MS;

    setTimeout(async () => {
        const dueloActual = await Duelo.findById(dueloId);
        // Si ya fue resuelto por tiro en falso (señuelo), no mostrar botón de disparo
        if (!dueloActual || dueloActual.estado !== 'activo') return;

        const embedDisparo = base(
            '💥 ¡¡FUEGOOO!!',
            `**<@${duelo.retadorId}>** vs **<@${duelo.rivalId}>**\n\n` +
            `¡¡PRESIONA EL BOTÓN AHORA!!`,
            COLORES.rojo
        );

        await mensaje.edit({
            embeds: [embedDisparo],
            components: [filaDispararDuelo(dueloId)],
        }).catch(() => null);
    }, delay);
}

async function resolverDisparo(dueloId, disparadorId, esSenuelo, canal) {
    // Bloqueo atómico del duelo para que solo el primer clic sea válido
    const duelo = await Duelo.findOneAndUpdate(
        { _id: dueloId, estado: 'activo' },
        { estado: 'finalizado' },
        { new: true }
    );
    if (!duelo) return; // Ya fue resuelto o expiró

    // Verificar que quien disparó sea uno de los participantes
    if (disparadorId !== duelo.retadorId && disparadorId !== duelo.rivalId) return;

    let ganadorId;
    let perdedorId;
    let motivoVictoria;

    if (esSenuelo) {
        // Tiro en falso: gana el oponente
        perdedorId = disparadorId;
        ganadorId = disparadorId === duelo.retadorId ? duelo.rivalId : duelo.retadorId;
        motivoVictoria = `¡<@${perdedorId}> se apresuró y disparó en falso antes de la señal!`;
    } else {
        // Disparo certero: gana el más rápido
        ganadorId = disparadorId;
        perdedorId = disparadorId === duelo.retadorId ? duelo.rivalId : duelo.retadorId;
        motivoVictoria = `¡<@${ganadorId}> tuvo los reflejos de ultratumba más veloces!`;
    }

    const pozoTotal = duelo.monto * 2;
    const corteCasa = Math.round(pozoTotal * config.DUELOS.CORTE_CASA);
    const premio = pozoTotal - corteCasa;

    await modificarHuesos(ganadorId, duelo.guildId, premio, 'apuesta', 'Victoria en Duelo');

    duelo.ganadorId = ganadorId;
    duelo.premioEntregado = premio;
    await duelo.save();

    // Actualizar estadísticas
    await Promise.all([
        Usuario.updateOne(
            { userId: ganadorId, guildId: duelo.guildId },
            { $inc: { 'estadisticas.apostado': duelo.monto, 'estadisticas.ganado': premio - duelo.monto, 'estadisticas.duelosGanados': 1 } }
        ),
        Usuario.updateOne(
            { userId: perdedorId, guildId: duelo.guildId },
            { $inc: { 'estadisticas.apostado': duelo.monto, 'estadisticas.perdido': duelo.monto, 'estadisticas.duelosPerdidos': 1 } }
        ),
    ]);

    const mensaje = await canal.messages.fetch(duelo.mensajeId).catch(() => null);
    const embedFinal = base(
        '🏆 ¡Fin del Duelo de Honor!',
        `${motivoVictoria}\n\n` +
        `👑 **Ganador:** <@${ganadorId}>\n` +
        `💀 **Derrotado:** <@${perdedorId}>\n` +
        `💰 **Premio entregado:** **+${formatoNum(premio)}** huesos 🦴\n` +
        `🏛️ _Comisión de la Cripta (5%): ${formatoNum(corteCasa)} huesos_`,
        COLORES.verde
    );

    if (mensaje) {
        await mensaje.edit({ embeds: [embedFinal], components: [] }).catch(() => null);
    }
}

module.exports = {
    crearDuelo,
    filaInvitacionDuelo,
    iniciarMinijuegoDuelo,
    resolverDisparo,
    reembolsarDuelosPendientes,
};

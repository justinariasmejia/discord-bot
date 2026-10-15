// src/services/duelos.js
const { sancionarUsuario } = require('./sanciones');
// Sistema de duelos entre jugadores con juego de reacción y persistencia.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Duelo = require('../models/Duelo');
const Usuario = require('../models/Usuario');
const { modificarHuesos, obtenerUsuario } = require('./economia');
const { obtenerConfig, eventoActivo, estaEnBlacklist, esAdminOTester } = require('./evento');
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
    monto = Math.trunc(Number(monto));

    if (isNaN(monto) || monto < config.APUESTAS.MINIMA) {
        return { ok: false, motivo: 'monto_invalido', min: config.APUESTAS.MINIMA };
    }

    const maxApuesta = config.DUELOS?.APUESTA_MAXIMA || 1000;
    if (monto > maxApuesta) {
        return { ok: false, motivo: 'monto_excedido', max: maxApuesta };
    }

    const inicioDia = new Date();
    inicioDia.setUTCHours(0, 0, 0, 0);

    // 1. Verificar límite diario de duelos completados por ambos usuarios
    if (config.DUELOS?.MAX_DUELS_PER_DAY) {
        const duelosRetadorHoy = await Duelo.countDocuments({
            guildId,
            estado: 'finalizado',
            $or: [{ retadorId }, { rivalId: retadorId }],
            createdAt: { $gte: inicioDia },
        });
        if (duelosRetadorHoy >= config.DUELOS.MAX_DUELS_PER_DAY) {
            return { ok: false, motivo: 'max_duelos_diario', max: config.DUELOS.MAX_DUELS_PER_DAY };
        }

        const duelosRivalHoy = await Duelo.countDocuments({
            guildId,
            estado: 'finalizado',
            $or: [{ retadorId: rivalId }, { rivalId }],
            createdAt: { $gte: inicioDia },
        });
        if (duelosRivalHoy >= config.DUELOS.MAX_DUELS_PER_DAY) {
            return { ok: false, motivo: 'rival_max_duelos_diario', max: config.DUELOS.MAX_DUELS_PER_DAY };
        }
    }

    // 2. Verificar cooldown entre el mismo adversario para evitar acuerdos o transferencias repetitivas
    if (config.DUELOS?.COOLDOWN_SAME_OPPONENT_MS) {
        const ultimoDuelo = await Duelo.findOne({
            guildId,
            estado: 'finalizado',
            $or: [
                { retadorId, rivalId },
                { retadorId: rivalId, rivalId: retadorId },
            ],
        }).sort({ createdAt: -1 });

        if (ultimoDuelo) {
            const transcurrido = Date.now() - ultimoDuelo.createdAt.getTime();
            if (transcurrido < config.DUELOS.COOLDOWN_SAME_OPPONENT_MS) {
                const restanteMs = config.DUELOS.COOLDOWN_SAME_OPPONENT_MS - transcurrido;
                return { ok: false, motivo: 'cooldown_mismo_oponente', restanteMs };
            }
        }
    }

    // 3. Cooldown global de duelos por usuario (evitar spam de duelos seguidos)
    const cooldownGlobalMs = config.DUELOS?.COOLDOWN_GLOBAL_MS || 45000;
    const ultimoDueloGeneral = await Duelo.findOne({
        guildId,
        estado: 'finalizado',
        $or: [{ retadorId }, { rivalId: retadorId }],
    }).sort({ createdAt: -1 });

    if (ultimoDueloGeneral) {
        const transcurrido = Date.now() - ultimoDueloGeneral.createdAt.getTime();
        if (transcurrido < cooldownGlobalMs) {
            const segundos = Math.ceil((cooldownGlobalMs - transcurrido) / 1000);
            return { ok: false, motivo: 'cooldown_global_duelo', segundos };
        }
    }

    const confEvento = await obtenerConfig(guildId);
    if (!eventoActivo(confEvento)) return { ok: false, motivo: 'evento_cerrado' };
    if (confEvento.modoTest) {
        if (!esAdminOTester(retadorId, confEvento) || !esAdminOTester(rivalId, confEvento)) {
            return { ok: false, motivo: 'modo_test_duelo' };
        }
    }

    if (estaEnBlacklist(retadorId, confEvento) || estaEnBlacklist(rivalId, confEvento)) {
        return { ok: false, motivo: 'blacklist' };
    }

    const ahora = Date.now();
    const retador = await obtenerUsuario(retadorId, guildId);
    if ((retador.silencioApuestasHasta && ahora < retador.silencioApuestasHasta.getTime()) ||
        (retador.bloqueoApuestasHasta && ahora < retador.bloqueoApuestasHasta.getTime())) {
        const expira = retador.bloqueoApuestasHasta || retador.silencioApuestasHasta;
        return { ok: false, motivo: 'silenciado', expira };
    }

    const rival = await obtenerUsuario(rivalId, guildId);
    if ((rival.silencioApuestasHasta && ahora < rival.silencioApuestasHasta.getTime()) ||
        (rival.bloqueoApuestasHasta && ahora < rival.bloqueoApuestasHasta.getTime())) {
        const expira = rival.bloqueoApuestasHasta || rival.silencioApuestasHasta;
        return { ok: false, motivo: 'rival_silenciado', expira };
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

    // Anuncio de combate en curso (100% aleatorio, sin botones de reacción)
    const embedEspera = base(
        '⚔️ ¡Duelo de Honor en Progreso!',
        `**<@${duelo.retadorId}>** ⚔️ **<@${duelo.rivalId}>**\n\n` +
        `🦴 **Apuesta individual:** **${formatoNum(duelo.monto)}** huesos\n` +
        `💰 **Pozo total acumulado:** **${formatoNum(duelo.monto * 2)}** huesos 🦴\n\n` +
        `🎲 *Las ánimas de la cripta están determinando el destino en combate...*\n` +
        `⏳ *El combate se resolverá de forma 100% aleatoria e imparcial en unos segundos...*`,
        COLORES.morado
    );

    await mensaje.edit({
        embeds: [embedEspera],
        components: [], // Sin botones
    }).catch(() => null);

    // Suspense de 3.5 segundos antes de resolver la tirada aleatoria
    setTimeout(async () => {
        await resolverDueloAleatorio(dueloId, canal);
    }, 3500);
}

async function resolverDueloAleatorio(dueloId, canal) {
    const duelo = await Duelo.findOneAndUpdate(
        { _id: dueloId, estado: 'activo' },
        { estado: 'finalizado' },
        { new: true }
    );
    if (!duelo) return;

    const pozoTotal = duelo.monto * 2;
    // Tirada 100% aleatoria e imparcial (50% / 50%)
    const retadorGana = Math.random() < 0.5;
    const ganadorId = retadorGana ? duelo.retadorId : duelo.rivalId;
    const perdedorId = retadorGana ? duelo.rivalId : duelo.retadorId;
    const motivoVictoria = `¡El destino de ultratumba favoreció a <@${ganadorId}> en el combate a muerte!`;

    duelo.ganadorId = ganadorId;

    // 🛡️ Detección preventiva de colusión / win-trading entre estos dos duelistas
    let esColusion = false;
    let motivoFraude = '';

    if (config.DUELOS?.ENABLE_ANTI_COLLUSION) {
        const unDiaAtras = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const duelosPrevios = await Duelo.find({
            guildId: duelo.guildId,
            estado: 'finalizado',
            _id: { $ne: duelo._id },
            $or: [
                { retadorId: duelo.retadorId, rivalId: duelo.rivalId },
                { retadorId: duelo.rivalId, rivalId: duelo.retadorId },
            ],
            createdAt: { $gte: unDiaAtras },
        }).sort({ createdAt: -1 });

        const derrotasPreviasContraGanador = duelosPrevios.filter((d) => d.ganadorId === ganadorId).length;
        const huesosGanadosPrevios = duelosPrevios
            .filter((d) => d.ganadorId === ganadorId)
            .reduce((sum, d) => sum + (d.monto || 0), 0);

        const totalHuesosPasados = huesosGanadosPrevios + duelo.monto;

        // Si el perdedor ya le había perdido 3 o más veces consecutivas hoy al mismo usuario
        if (derrotasPreviasContraGanador >= 3) {
            esColusion = true;
            motivoFraude = `Derrotas consecutivas intencionales (${derrotasPreviasContraGanador + 1} duelos perdidos hacia el mismo ganador hoy)`;
        } else if (totalHuesosPasados >= 800 && duelosPrevios.length >= 2) {
            esColusion = true;
            motivoFraude = `Traspaso excesivo y concentrado de capital (${totalHuesosPasados} huesos pasados hoy entre ambos)`;
        }
    }

    const { logDuelo, guardarLogDueloDB, logAdmin, logSospecha } = require('./logger');

    if (esColusion) {
        // 🚨 CASO DE FRAUDE: CONFISCACIÓN TOTAL DEL POZO Y SANCIONES DURAS
        duelo.premioEntregado = 0;
        await duelo.save();

        const factorSancion = config.DUELOS?.SANCTION_FACTOR || 0.20;
        const duracionSancionMs = config.DUELOS?.SANCTION_DURATION_MS || 2 * 60 * 60 * 1000;

        await sancionarUsuario(
            perdedorId,
            duelo.guildId,
            `Colusión en duelos a favor de <@${ganadorId}>: ${motivoFraude}`,
            { factor: factorSancion, duracionMs: duracionSancionMs }
        );

        await sancionarUsuario(
            ganadorId,
            duelo.guildId,
            `Beneficiario de colusión en duelos con <@${perdedorId}>: ${motivoFraude}`,
            { factor: factorSancion, duracionMs: duracionSancionMs }
        );

        await Promise.all([
            Usuario.updateOne(
                { userId: ganadorId, guildId: duelo.guildId },
                { $inc: { 'estadisticas.apostado': duelo.monto, 'estadisticas.duelosPerdidos': 1 } }
            ),
            Usuario.updateOne(
                { userId: perdedorId, guildId: duelo.guildId },
                { $inc: { 'estadisticas.apostado': duelo.monto, 'estadisticas.perdido': duelo.monto, 'estadisticas.duelosPerdidos': 1 } }
            ),
        ]);

        // Guardar logs de auditoría privada y administrativa
        await guardarLogDueloDB({
            guildId: duelo.guildId,
            retadorId: duelo.retadorId,
            rivalId: duelo.rivalId,
            ganadorId,
            perdedorId,
            monto: duelo.monto,
            premio: 0,
            detalle: `🚨 [COLUSIÓN DETECTADA] ${motivoFraude} • Pozo de ${pozoTotal} huesos confiscado`,
        }).catch(() => null);

        await logSospecha(duelo.guildId, perdedorId, {
            tipo: 'Colusión en Duelos',
            detalle: `Duelo intervenido por sospecha de traspaso de fondos entre <@${perdedorId}> y <@${ganadorId}> (${motivoFraude}).`,
            nivel: 'critico',
            campos: [
                { name: '⚔️ Duelistas', value: `<@${perdedorId}> vs <@${ganadorId}>`, inline: true },
                { name: '💰 Pozo Confiscado', value: `${pozoTotal} 🦴`, inline: true },
            ],
        });

        const mensaje = await canal.messages.fetch(duelo.mensajeId).catch(() => null);
        const embedFraude = base(
            '🚨 ¡FRAUDE Y COLUSIÓN DETECTADA EN DUELO!',
            `**El sistema preventivo de La Cripta ha intervenido la contienda.**\n\n` +
            `⚠️ **Infracción:** ${motivoFraude}\n` +
            `👤 **Cedente:** <@${perdedorId}>\n` +
            `👤 **Receptor:** <@${ganadorId}>\n\n` +
            `⚖️ **RESOLUCIÓN DISCIPLINARIA:**\n` +
            `• El pozo completo de **${formatoNum(pozoTotal)}** huesos ha sido **CONFISCADO POR LA CRIPTA**.\n` +
            `• Ambos participantes han sido **sancionados con multas de huesos y bloqueo temporal de apuestas/duelos**.\n\n` +
            `⏱️ _Este mensaje se eliminará automáticamente en 20 segundos._`,
            COLORES.rojo
        );

        if (mensaje) {
            await mensaje.edit({ content: null, embeds: [embedFraude], components: [] }).catch(() => null);
            setTimeout(() => {
                mensaje.delete().catch(() => null);
            }, 20000);
        }
        return;
    }

    // ── DUELO LIMPIO Y VÁLIDO ──
    const corteCasa = Math.round(pozoTotal * (config.DUELOS?.CORTE_CASA || 0.05));
    const premio = pozoTotal - corteCasa;

    await modificarHuesos(ganadorId, duelo.guildId, premio, 'duelo', 'Victoria en Duelo');

    duelo.premioEntregado = premio;
    await duelo.save();

    // Guardar en BD (DuelLog) y emitir logs públicos y en canal dedicado de duelos
    try {
        await guardarLogDueloDB({
            guildId: duelo.guildId,
            retadorId: duelo.retadorId,
            rivalId: duelo.rivalId,
            ganadorId,
            perdedorId,
            monto: duelo.monto,
            premio,
            detalle: motivoVictoria,
        }).catch(() => null);

        logDuelo(duelo.guildId, ganadorId, perdedorId, premio, duelo.monto, motivoVictoria).catch(() => null);
    } catch {}

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
        `🏛️ _Comisión de la Cripta (5%): ${formatoNum(corteCasa)} huesos_\n` +
        `🎲 _Mecánica: Combate resuelto de forma 100% aleatoria e imparcial._\n\n` +
        `⏱️ _Este mensaje se eliminará automáticamente en 15 segundos y quedará registrado en los logs públicos._`,
        COLORES.verde
    );

    if (mensaje) {
        await mensaje.edit({ content: null, embeds: [embedFinal], components: [] }).catch(() => null);
        setTimeout(() => {
            mensaje.delete().catch(() => null);
        }, 15000);
    }
}

module.exports = {
    crearDuelo,
    filaInvitacionDuelo,
    iniciarMinijuegoDuelo,
    resolverDueloAleatorio,
    resolverDisparo: resolverDueloAleatorio,
    reembolsarDuelosPendientes,
};

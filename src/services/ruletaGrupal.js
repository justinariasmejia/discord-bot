// src/services/ruletaGrupal.js
// Gestión de la Ruleta Grupal pública en canales de texto.
const RondaGrupal = require('../models/RondaGrupal');
const Usuario = require('../models/Usuario');
const { modificarHuesos, obtenerUsuario } = require('./economia');
const { obtenerConfig, eventoActivo } = require('./evento');
const { conBloqueo } = require('../utils/locks');
const { base, COLORES, formatoNum } = require('../utils/embeds');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../data/config');

const rondasEnMemoria = new Map(); // canalId -> timeoutId

async function reembolsarRondasPendientes() {
    try {
        const activas = await RondaGrupal.find({ estado: 'activa' });
        for (const ronda of activas) {
            for (const p of ronda.participantes) {
                await modificarHuesos(
                    p.userId,
                    ronda.guildId,
                    p.monto,
                    'reembolso',
                    'Reembolso por reinicio del bot (Ruleta Grupal)'
                );
            }
            ronda.estado = 'cancelada';
            await ronda.save();
        }
        if (activas.length > 0) {
            console.log(`🔄 Reembolsadas ${activas.length} ruletas grupales pendientes tras reinicio.`);
        }
    } catch (err) {
        console.error('Error reembolsando ruletas grupales pendientes:', err);
    }
}

function filaBotonUnirse(rondaId, deshabilitado = false) {
    const btn = new ButtonBuilder()
        .setCustomId(`ruleta_grupal:unirse:publico:${rondaId}`)
        .setLabel('Unirme / Apostar 🦴')
        .setStyle(ButtonStyle.Success)
        .setDisabled(deshabilitado);
    return new ActionRowBuilder().addComponents(btn);
}

function embedRondaActiva(ronda, segundosRestantes) {
    let desc = `🎡 **¡Ruleta de la Fortuna en vivo!**\n` +
        `Coloca tu apuesta antes de que el tiempo expire. ¡El ganador se lleva el pozo!\n\n` +
        `💰 **Pozo acumulado:** ${formatoNum(ronda.pozo)} 🦴\n` +
        `⏳ **Tiempo restante:** \`${segundosRestantes}s\`\n\n` +
        `👥 **Participantes (${ronda.participantes.length}):**\n`;

    if (ronda.participantes.length === 0) {
        desc += '_Aún nadie ha colocado huesos en el pozo..._\n';
    } else {
        ronda.participantes.forEach((p) => {
            const prob = ronda.pozo > 0 ? ((p.monto / ronda.pozo) * 100).toFixed(1) : 0;
            desc += `• <@${p.userId}> — **${formatoNum(p.monto)}** 🦴 (${prob}%)\n`;
        });
    }

    return base('🎡 Ruleta Grupal de Halloween', desc, COLORES.naranja);
}

async function iniciarRondaGrupal(canal, guildId, usuarioIniciador) {
    const confEvento = await obtenerConfig(guildId);
    if (!eventoActivo(confEvento)) return { ok: false, motivo: 'evento_cerrado' };

    const existente = await RondaGrupal.findOne({ canalId: canal.id, estado: 'activa' });
    if (existente) {
        return { ok: false, motivo: 'ya_activa' };
    }

    const expiraEn = new Date(Date.now() + config.APUESTAS.RULETA_GRUPAL.DURACION_SEGUNDOS * 1000);
    const ronda = await RondaGrupal.create({
        guildId,
        canalId: canal.id,
        pozo: 0,
        participantes: [],
        expiraEn,
        estado: 'activa',
    });

    const embed = embedRondaActiva(ronda, config.APUESTAS.RULETA_GRUPAL.DURACION_SEGUNDOS);
    const msg = await canal.send({
        embeds: [embed],
        components: [filaBotonUnirse(ronda._id.toString())],
    });

    ronda.mensajeId = msg.id;
    await ronda.save();

    // Cuenta regresiva y resolución
    let restantes = config.APUESTAS.RULETA_GRUPAL.DURACION_SEGUNDOS;
    const intervalId = setInterval(async () => {
        restantes -= 5;
        if (restantes > 0) {
            const rActual = await RondaGrupal.findById(ronda._id);
            if (rActual && rActual.estado === 'activa') {
                await msg.edit({
                    embeds: [embedRondaActiva(rActual, restantes)],
                    components: [filaBotonUnirse(ronda._id.toString())],
                }).catch(() => null);
            }
        } else {
            clearInterval(intervalId);
            rondasEnMemoria.delete(canal.id);
            await resolverRondaGrupal(ronda._id, canal);
        }
    }, 5000);

    rondasEnMemoria.set(canal.id, intervalId);
    return { ok: true, ronda };
}

async function resolverRondaGrupal(rondaId, canal) {
    const ronda = await RondaGrupal.findOneAndUpdate(
        { _id: rondaId, estado: 'activa' },
        { estado: 'finalizada' },
        { new: true }
    );
    if (!ronda) return;

    const mensaje = await canal.messages.fetch(ronda.mensajeId).catch(() => null);

    // Si menos de 2 participantes -> Cancelar y reembolsar
    if (ronda.participantes.length < config.APUESTAS.RULETA_GRUPAL.MINIMO_JUGADORES) {
        for (const p of ronda.participantes) {
            await modificarHuesos(
                p.userId,
                ronda.guildId,
                p.monto,
                'reembolso',
                'Ruleta Grupal cancelada (mínimo de jugadores no alcanzado)'
            );
        }
        ronda.estado = 'cancelada';
        await ronda.save();

        const cancelEmbed = base(
            '🎡 Ruleta Grupal — Cancelada',
            'No se unieron suficientes cazadores para girar la ruleta (mínimo 2 participantes).\n' +
            'Todos los huesos apostados han sido reembolsados íntegramente.',
            COLORES.negro
        );

        if (mensaje) {
            await mensaje.edit({ embeds: [cancelEmbed], components: [filaBotonUnirse(rondaId, true)] }).catch(() => null);
        }
        return;
    }

    // Elegir ganador proporcional a su apuesta
    const totalPozo = ronda.pozo;
    let tiro = Math.random() * totalPozo;
    let ganador = ronda.participantes[0];

    for (const p of ronda.participantes) {
        if (tiro < p.monto) {
            ganador = p;
            break;
        }
        tiro -= p.monto;
    }

    const corteCasa = Math.round(totalPozo * config.APUESTAS.RULETA_GRUPAL.CORTE_CASA);
    const premio = totalPozo - corteCasa;

    await modificarHuesos(ganador.userId, ronda.guildId, premio, 'apuesta', 'Premio Ruleta Grupal');
    ronda.ganadorId = ganador.userId;
    ronda.premioEntregado = premio;
    await ronda.save();

    // Actualizar estadísticas
    for (const p of ronda.participantes) {
        if (p.userId === ganador.userId) {
            await Usuario.updateOne(
                { userId: p.userId, guildId: ronda.guildId },
                { $inc: { 'estadisticas.apostado': p.monto, 'estadisticas.ganado': premio - p.monto } }
            );
        } else {
            await Usuario.updateOne(
                { userId: p.userId, guildId: ronda.guildId },
                { $inc: { 'estadisticas.apostado': p.monto, 'estadisticas.perdido': p.monto } }
            );
        }
    }

    const probGanador = ((ganador.monto / totalPozo) * 100).toFixed(1);
    const winEmbed = base(
        '🎉 ¡Tenemos un Ganador en la Ruleta Grupal!',
        `¡La ruleta se detuvo y la fortuna favoreció a <@${ganador.userId}>!\n\n` +
        `🏆 **Ganador:** <@${ganador.userId}> (${probGanador}% de probabilidad)\n` +
        `💰 **Premio entregado:** **+${formatoNum(premio)}** huesos 🦴\n` +
        `🏛️ _Comisión de la Cripta (5%): ${formatoNum(corteCasa)} huesos_\n\n` +
        `Gracias a todos los valientes que apostaron sus almas y huesos.`,
        COLORES.verde
    );

    if (mensaje) {
        await mensaje.edit({ embeds: [winEmbed], components: [filaBotonUnirse(rondaId, true)] }).catch(() => null);
    }
}

async function unirseRondaGrupal(rondaId, userId, guildId, monto) {
    const bloqueo = await conBloqueo(`${guildId}:${userId}`, async () => {
        const ronda = await RondaGrupal.findOne({ _id: rondaId, estado: 'activa' });
        if (!ronda) return { ok: false, motivo: 'ronda_inactiva' };

        const usuario = await obtenerUsuario(userId, guildId);
        monto = Math.trunc(Number(monto));
        if (isNaN(monto) || monto < config.APUESTAS.MINIMA) {
            return { ok: false, motivo: 'monto_invalido', min: config.APUESTAS.MINIMA };
        }

        if (usuario.huesos < monto) {
            return { ok: false, motivo: 'saldo_insuficiente', saldo: usuario.huesos };
        }

        const partExistente = ronda.participantes.find((p) => p.userId === userId);
        if (partExistente && partExistente.haSubido) {
            return { ok: false, motivo: 'ya_subio' };
        }

        // Deducción atómica
        const deducido = await modificarHuesos(userId, guildId, -monto, 'apuesta', 'Apuesta en Ruleta Grupal');
        if (!deducido) return { ok: false, motivo: 'saldo_insuficiente' };

        if (partExistente) {
            await RondaGrupal.updateOne(
                { _id: rondaId, 'participantes.userId': userId },
                {
                    $inc: { pozo: monto, 'participantes.$.monto': monto },
                    $set: { 'participantes.$.haSubido': true },
                }
            );
        } else {
            await RondaGrupal.updateOne(
                { _id: rondaId },
                {
                    $inc: { pozo: monto },
                    $push: { participantes: { userId, monto, haSubido: false, fecha: new Date() } },
                }
            );
        }

        return { ok: true, monto, nuevoSaldo: deducido.huesos };
    });

    if (bloqueo.ocupado) return { ok: false, motivo: 'ocupado' };
    return bloqueo.resultado;
}

module.exports = {
    iniciarRondaGrupal,
    unirseRondaGrupal,
    reembolsarRondasPendientes,
    resolverRondaGrupal,
};

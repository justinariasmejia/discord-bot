// src/services/ruletaGrupal.js
// Sistema de Ruleta Grupal Comunitaria en Dos Fases:
// • FASE 1 (1 minuto / 60s): Inscripciones abiertas con botón [🎟️ Unirme (X 🦴)]. Pozo en tiempo real.
// • FASE 2 (1 minuto / 60s): Inscripciones cerradas, botón deshabilitado, la ruleta gira en suspenso.
// • FASE 3: Se revela el ganador, visible 1 minuto antes de auto-eliminarse.
// • Cooldown de 60s para abrir otra ronda.
const RondaGrupal = require('../models/RondaGrupal');
const Usuario = require('../models/Usuario');
const { modificarHuesos, obtenerUsuario } = require('./economia');
const { obtenerConfig, eventoActivo } = require('./evento');
const { conBloqueo } = require('../utils/locks');
const { base, COLORES, formatoNum } = require('../utils/embeds');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { protegerMensajeCripta, desprotegerMensajeCripta } = require('./canalCripta');
const { logRuletaGrupal } = require('./logger');
const config = require('../data/config');

const estadosRuleta = new Map(); // canalId -> { fase, finVisible, cooldownHasta, mensajeId, frameIdx, ultimaEdicion }
let _tickerId = null;

const FRAMES_ANIMACION = [
    '🎡 ⟪ 🎃 ➔ 👻 ➔ 💀 ➔ 🦴 ➔ 🕷️ ⟫',
    '🎡 ⟪ 🕷️ ➔ 🎃 ➔ 👻 ➔ 💀 ➔ 🦴 ⟫',
    '🎡 ⟪ 🦴 ➔ 🕷️ ➔ 🎃 ➔ 👻 ➔ 💀 ⟫',
    '🎡 ⟪ 💀 ➔ 🦴 ➔ 🕷️ ➔ 🎃 ➔ 👻 ⟫',
    '🎡 ⟪ 👻 ➔ 💀 ➔ 🦴 ➔ 🕷️ ➔ 🎃 ⟫',
];

function barraProgreso(restantes, total = 60) {
    const progreso = Math.max(0, Math.min(1, restantes / total));
    const llenos = Math.round(progreso * 10);
    const vacios = 10 - llenos;
    return '`[' + '█'.repeat(llenos) + '░'.repeat(vacios) + ']`';
}

function consultarCooldownRuleta(canalId) {
    const ahora = Date.now();
    const estadoCanal = estadosRuleta.get(canalId);
    if (!estadoCanal) return { bloqueado: false };

    // Si estaba mostrando resultado pero ya pasó el tiempo visible
    if (estadoCanal.fase === 'mostrando_resultado') {
        if (ahora >= (estadoCanal.finVisible || 0)) {
            estadoCanal.fase = 'cooldown';
        } else {
            const restanteMs = Math.max(0, (estadoCanal.finVisible || ahora) - ahora);
            return { bloqueado: true, motivo: 'mostrando_resultado', restanteMs };
        }
    }

    // Si está en cooldown
    if (estadoCanal.fase === 'cooldown') {
        if (ahora >= (estadoCanal.cooldownHasta || 0)) {
            estadosRuleta.delete(canalId);
            return { bloqueado: false };
        }
        const restanteMs = estadoCanal.cooldownHasta - ahora;
        return { bloqueado: true, motivo: 'en_cooldown', restanteMs };
    }

    // Si en memoria figuraba activa, verificar si ya expiró el tiempo de giro
    if (estadoCanal.fase === 'inscripcion' || estadoCanal.fase === 'girando') {
        if (estadoCanal.finGiro && ahora >= estadoCanal.finGiro) {
            estadosRuleta.delete(canalId);
            return { bloqueado: false };
        }
        return { bloqueado: true, motivo: 'ya_activa' };
    }

    return { bloqueado: false };
}

// ── Botones de Estado ──
function filaBotonUnirse(rondaId, precio = 50, deshabilitado = false) {
    const btn = new ButtonBuilder()
        .setCustomId(`ruleta_grupal:unirse:publico:${rondaId}`)
        .setLabel(`🎟️ Unirme (${formatoNum(precio)} 🦴)`)
        .setStyle(ButtonStyle.Success)
        .setDisabled(deshabilitado);
    return new ActionRowBuilder().addComponents(btn);
}

function filaBotonCerrado() {
    const btn = new ButtonBuilder()
        .setCustomId('ruleta_grupal:cerrada:publico:noop')
        .setLabel('🛑 Inscripciones Cerradas • Ruleta Girando')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);
    return new ActionRowBuilder().addComponents(btn);
}

// ── Embed Fase 1: Inscripciones Abiertas (1 minuto) ──
function embedRondaInscripcion(ronda, segundosRestantes, frameIdx = 0) {
    const frame = FRAMES_ANIMACION[frameIdx % FRAMES_ANIMACION.length];
    const totalSegs = 60;
    const barra = barraProgreso(segundosRestantes, totalSegs);
    const unixCierre = Math.floor(ronda.expiraInscripcion.getTime() / 1000);
    const precio = ronda.precioEntrada || 50;
    const corte = Math.round(ronda.pozo * 0.05);
    const premioEstimado = Math.max(0, ronda.pozo - corte);

    let desc = `### ${frame} 🎟️ ¡FASE 1: INSCRIPCIONES ABIERTAS!\n` +
        `> *¡Tienes exactamente 1 minuto para participar! Presiona el botón verde de abajo para comprar tu ticket. Al terminar el tiempo, se cerrarán las entradas y nadie más podrá entrar.*\n\n` +
        `💰 **Pozo Acumulado:** **${formatoNum(ronda.pozo)}** 🦴 *(Neto ganador: ~**${formatoNum(premioEstimado)}** 🦴)*\n` +
        `🎟️ **Precio Fijo por Ticket:** **${formatoNum(precio)}** 🦴 *(1 entrada por cazador)*\n` +
        `⏳ **Cierre de Inscripciones:** <t:${unixCierre}:R> • \`${segundosRestantes}s\` ${barra}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👥 **Cazadores en la Ronda (${ronda.participantes.length}):**\n`;

    if (ronda.participantes.length === 0) {
        desc += '_Aún nadie ha comprado su ticket... ¡Sé el primero con el botón de abajo!_\n';
    } else {
        const prob = ((1 / ronda.participantes.length) * 100).toFixed(1);
        ronda.participantes.forEach((p, i) => {
            desc += `${i + 1}. <@${p.userId}> — **${formatoNum(p.monto)}** 🦴 (${prob}% chance)\n`;
        });
    }

    desc += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ *Al cerrarse las inscripciones, la ruleta girará durante 1 minuto para decidir la suerte del ganador.*\n`;

    return base('🎡 Ruleta Grupal • Fase de Inscripción', desc, COLORES.naranja);
}

// ── Embed Fase 2: Girando y Decidiendo Ganador (1 minuto) ──
function embedRondaGirando(ronda, segundosRestantes, frameIdx = 0) {
    const frame = FRAMES_ANIMACION[frameIdx % FRAMES_ANIMACION.length];
    const totalSegs = 60;
    const barra = barraProgreso(segundosRestantes, totalSegs);
    const unixCierre = Math.floor(ronda.expiraGiro.getTime() / 1000);
    const precio = ronda.precioEntrada || 50;
    const corte = Math.round(ronda.pozo * 0.05);
    const premioEstimado = Math.max(0, ronda.pozo - corte);

    let desc = `### ${frame} 🌪️ ¡FASE 2: LA RULETA ESTÁ GIRANDO!\n` +
        `> *¡Las inscripciones han cerrado definitivamente! Nadie más puede entrar.*\n` +
        `> *La rueda de ultratumba está girando para decidir al único ganador entre los ${ronda.participantes.length} cazadores.*\n\n` +
        `💰 **Pozo Final Acumulado:** **${formatoNum(ronda.pozo)}** 🦴 *(Premio ganador: **+${formatoNum(premioEstimado)}** 🦴)*\n` +
        `🎟️ **Precio por Ticket:** **${formatoNum(precio)}** 🦴\n` +
        `⏳ **Decidiendo Ganador en:** <t:${unixCierre}:R> • \`${segundosRestantes}s\` ${barra}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👥 **Cazadores Participantes (${ronda.participantes.length}):**\n`;

    const prob = ((1 / Math.max(1, ronda.participantes.length)) * 100).toFixed(1);
    ronda.participantes.forEach((p, i) => {
        desc += `${i + 1}. <@${p.userId}> — **${formatoNum(p.monto)}** 🦴 (${prob}% chance)\n`;
    });

    desc += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🔮 *¡La ruleta anunciará al ganador en este mensaje al terminar la cuenta regresiva!*\n`;

    return base('🎡 Ruleta Grupal • ¡Decidiendo Ganador!', desc, COLORES.morado);
}

// ── Iniciar Ronda Grupal ──
async function iniciarRondaGrupal(canal, guildId, usuarioIniciador, precioEntrada = 50) {
    const confEvento = await obtenerConfig(guildId);
    if (!eventoActivo(confEvento)) return { ok: false, motivo: 'evento_cerrado' };

    const ahora = Date.now();
    const cd = consultarCooldownRuleta(canal.id);
    if (cd.bloqueado) {
        return { ok: false, motivo: cd.motivo, restanteMs: cd.restanteMs };
    }

    const existente = await RondaGrupal.findOne({ canalId: canal.id, estado: 'activa' });
    if (existente) {
        const expGiro = existente.expiraGiro || existente.expiraEn || new Date(0);
        if (ahora >= expGiro.getTime()) {
            // La ronda anterior ya cumplió todo su tiempo, resolverla de inmediato
            await resolverRondaGrupal(existente._id, canal);
            estadosRuleta.delete(canal.id);
        } else {
            return { ok: false, motivo: 'ya_activa' };
        }
    }

    // Cobrar el ticket al creador
    const deducido = await modificarHuesos(
        usuarioIniciador.id,
        guildId,
        -precioEntrada,
        'apuesta',
        `Entrada de Ruleta Grupal (creador)`
    );
    if (!deducido) {
        return { ok: false, motivo: 'saldo_insuficiente' };
    }

    // Tiempos exactos: 60s inscripción + 60s giro
    const expiraInscripcion = new Date(ahora + 60 * 1000);
    const expiraGiro = new Date(ahora + 120 * 1000);

    const ronda = await RondaGrupal.create({
        guildId,
        canalId: canal.id,
        pozo: precioEntrada,
        precioEntrada,
        creadorId: usuarioIniciador.id,
        participantes: [
            {
                userId: usuarioIniciador.id,
                monto: precioEntrada,
                haSubido: false,
                fecha: new Date(),
            },
        ],
        fase: 'inscripcion',
        expiraInscripcion,
        expiraGiro,
        expiraEn: expiraGiro,
        estado: 'activa',
    });

    const embed = embedRondaInscripcion(ronda, 60, 0);
    const msg = await canal.send({
        embeds: [embed],
        components: [filaBotonUnirse(ronda._id.toString(), precioEntrada)],
    });

    ronda.mensajeId = msg.id;
    await ronda.save();

    protegerMensajeCripta(msg.id);

    estadosRuleta.set(canal.id, {
        fase: 'inscripcion',
        mensajeId: msg.id,
        frameIdx: 0,
        rondaId: ronda._id.toString(),
        finInscripcion: expiraInscripcion.getTime(),
        finGiro: expiraGiro.getTime(),
    });

    return { ok: true, ronda };
}

// ── Unirse con Precio Fijo (1 clic, solo durante Fase 1) ──
async function unirseRondaGrupal(rondaId, userId, guildId, canal = null) {
    const bloqueo = await conBloqueo(`${guildId}:${userId}`, async () => {
        const ronda = await RondaGrupal.findOne({ _id: rondaId, estado: 'activa' });
        if (!ronda) return { ok: false, motivo: 'ronda_inactiva' };

        const ahora = Date.now();

        // 🛡️ REGLA ESTRICTA: No se puede entrar si ya terminó el minuto de inscripción
        if (ronda.fase !== 'inscripcion' || ahora >= ronda.expiraInscripcion.getTime()) {
            return { ok: false, motivo: 'inscripciones_cerradas' };
        }

        const precio = ronda.precioEntrada || 50;

        // 1 ticket por persona para igualdad total
        const yaParticipa = ronda.participantes.some((p) => p.userId === userId);
        if (yaParticipa) {
            return { ok: false, motivo: 'ya_participa', precio };
        }

        const usuario = await obtenerUsuario(userId, guildId);
        if (usuario.huesos < precio) {
            return { ok: false, motivo: 'saldo_insuficiente', precio, saldo: usuario.huesos };
        }

        const deducido = await modificarHuesos(userId, guildId, -precio, 'apuesta', 'Ticket Ruleta Grupal');
        if (!deducido) return { ok: false, motivo: 'saldo_insuficiente' };

        const actualizada = await RondaGrupal.findOneAndUpdate(
            {
                _id: rondaId,
                estado: 'activa',
                fase: 'inscripcion',
                'participantes.userId': { $ne: userId },
            },
            {
                $inc: { pozo: precio },
                $push: { participantes: { userId, monto: precio, fecha: new Date() } },
            },
            { new: true }
        );

        if (!actualizada) {
            await modificarHuesos(userId, guildId, precio, 'reembolso', 'Reembolso por cierre o duplicado');
            return { ok: false, motivo: 'inscripciones_cerradas', precio };
        }

        // Actualización inmediata del pozo en el mensaje público
        if (canal && actualizada.mensajeId) {
            const msg = await canal.messages.fetch(actualizada.mensajeId).catch(() => null);
            if (msg) {
                const est = estadosRuleta.get(canal.id);
                const frameIdx = est?.frameIdx || 0;
                const restantes = Math.max(0, Math.ceil((actualizada.expiraInscripcion.getTime() - Date.now()) / 1000));
                await msg.edit({
                    embeds: [embedRondaInscripcion(actualizada, restantes, frameIdx)],
                    components: [filaBotonUnirse(actualizada._id.toString(), precio)],
                }).catch(() => null);
            }
        }

        return {
            ok: true,
            precio,
            nuevoSaldo: deducido.huesos,
            nuevoPozo: actualizada.pozo,
            totalParticipantes: actualizada.participantes.length,
        };
    });

    if (bloqueo.ocupado) return { ok: false, motivo: 'ocupado' };
    return bloqueo.resultado;
}

// ── Transición: Cerrar Inscripciones e Iniciar Fase 2 de Giro ──
async function cerrarInscripcionesEIniciarGiro(ronda, canal) {
    // Si menos de 2 participantes -> Cancelar y reembolsar
    if (ronda.participantes.length < (config.APUESTAS?.RULETA_GRUPAL?.MINIMO_JUGADORES || 2)) {
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
        ronda.fase = 'cancelada';
        await ronda.save();

        const cancelEmbed = base(
            '🎡 Ruleta Grupal — Cancelada',
            'No se unieron suficientes cazadores para girar la ruleta (mínimo 2 participantes).\n' +
            'Todos los huesos apostados han sido reembolsados íntegramente.\n\n' +
            '⏱️ _Este mensaje permanecerá visible 1 minuto antes de cerrarse._',
            COLORES.negro
        );

        if (canal && ronda.mensajeId) {
            const msg = await canal.messages.fetch(ronda.mensajeId).catch(() => null);
            if (msg) {
                await msg.edit({ embeds: [cancelEmbed], components: [filaBotonCerrado()] }).catch(() => null);
            }
        }

        const ahora = Date.now();
        estadosRuleta.set(ronda.canalId, {
            fase: 'mostrando_resultado',
            finVisible: ahora + 60000,
            cooldownHasta: ahora + 120000,
            mensajeId: ronda.mensajeId,
        });

        setTimeout(async () => {
            try {
                if (canal && ronda.mensajeId) {
                    const msg = await canal.messages.fetch(ronda.mensajeId).catch(() => null);
                    if (msg) {
                        desprotegerMensajeCripta(msg.id);
                        await msg.delete().catch(() => null);
                    }
                }
            } catch {}
            const est = estadosRuleta.get(ronda.canalId);
            if (est) est.fase = 'cooldown';
        }, 60000);

        return;
    }

    // Transición a Fase de Giro
    ronda.fase = 'girando';
    await ronda.save();

    const est = estadosRuleta.get(ronda.canalId);
    if (est) est.fase = 'girando';

    if (canal && ronda.mensajeId) {
        const msg = await canal.messages.fetch(ronda.mensajeId).catch(() => null);
        if (msg) {
            const restantes = Math.max(0, Math.ceil((ronda.expiraGiro.getTime() - Date.now()) / 1000));
            await msg.edit({
                embeds: [embedRondaGirando(ronda, restantes, 0)],
                components: [filaBotonCerrado()],
            }).catch(() => null);
        }
    }
}

// ── Resolución Final (Fase 3: Ganador) ──
async function resolverRondaGrupal(rondaId, canal) {
    const ronda = await RondaGrupal.findOneAndUpdate(
        { _id: rondaId, estado: 'activa' },
        { estado: 'finalizada', fase: 'finalizada' },
        { new: true }
    );
    if (!ronda) return;

    const mensaje = canal && ronda.mensajeId
        ? await canal.messages.fetch(ronda.mensajeId).catch(() => null)
        : null;

    const ahora = Date.now();

    // Elegir ganador con 1/N de probabilidad equitativa
    const indiceGanador = Math.floor(Math.random() * ronda.participantes.length);
    const ganador = ronda.participantes[indiceGanador];
    const totalPozo = ronda.pozo;

    const corteCasa = Math.round(totalPozo * (config.APUESTAS?.RULETA_GRUPAL?.CORTE_CASA || 0.05));
    const premio = totalPozo - corteCasa;

    await modificarHuesos(ganador.userId, ronda.guildId, premio, 'apuesta', 'Premio Ruleta Grupal');
    ronda.ganadorId = ganador.userId;
    ronda.premioEntregado = premio;
    await ronda.save();

    // Estadísticas
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

    const probGanador = ((1 / ronda.participantes.length) * 100).toFixed(1);
    const winEmbed = base(
        '🎉 ¡Tenemos un Ganador en la Ruleta Grupal!',
        `¡La ruleta se detuvo y favoreció a <@${ganador.userId}>!\n\n` +
        `🏆 **Ganador:** <@${ganador.userId}> (${probGanador}% de probabilidad)\n` +
        `💰 **Premio entregado (+95%):** **+${formatoNum(premio)}** huesos 🦴\n` +
        `🎟️ **Pozo Total (${ronda.participantes.length} participantes):** ${formatoNum(totalPozo)} huesos\n` +
        `🏛️ _Comisión de la Cripta (5%): ${formatoNum(corteCasa)} huesos_\n\n` +
        `Gracias a todos los valientes que colocaron su ticket.\n\n` +
        `⏱️ _Este resultado permanecerá visible durante 1 minuto antes de cerrarse._`,
        COLORES.verde
    );

    if (mensaje) {
        const btnFinal = new ButtonBuilder()
            .setCustomId('ruleta:fin:noop')
            .setLabel(`🏆 Ganador: @${ganador.userId.slice(-4)}`)
            .setStyle(ButtonStyle.Success)
            .setDisabled(true);
        await mensaje.edit({ embeds: [winEmbed], components: [new ActionRowBuilder().addComponents(btnFinal)] }).catch(() => null);
    }

    await logRuletaGrupal(ronda.guildId, ganador.userId, totalPozo, premio, ronda.participantes.length, probGanador).catch(() => {});

    estadosRuleta.set(ronda.canalId, {
        fase: 'mostrando_resultado',
        finVisible: ahora + 60000,
        cooldownHasta: ahora + 120000,
        mensajeId: ronda.mensajeId,
    });

    setTimeout(async () => {
        try {
            if (canal && ronda.mensajeId) {
                const msg = await canal.messages.fetch(ronda.mensajeId).catch(() => null);
                if (msg) {
                    desprotegerMensajeCripta(msg.id);
                    await msg.delete().catch(() => null);
                }
            }
        } catch {}
        const est = estadosRuleta.get(ronda.canalId);
        if (est) est.fase = 'cooldown';
    }, 60000);
}

// ── MOTOR CENTRAL: Ticker de Seguridad Indestructible cada 3 segundos ──
// Gestiona el paso automático de Fase 1 (Inscripción) -> Fase 2 (Giro) -> Fase 3 (Resultado)
// sin depender de variables en memoria que puedan morir al reiniciar.
async function tickServicioRuletas(client) {
    if (!client) return;

    try {
        const rondasActivas = await RondaGrupal.find({ estado: 'activa' });
        const ahora = Date.now();

        for (const ronda of rondasActivas) {
            const canal = client.channels.cache.get(ronda.canalId) ||
                await client.channels.fetch(ronda.canalId).catch(() => null);

            if (!canal || !ronda.mensajeId) continue;

            const msg = await canal.messages.fetch(ronda.mensajeId).catch(() => null);
            if (!msg) continue;

            let est = estadosRuleta.get(ronda.canalId);
            if (!est) {
                est = { fase: ronda.fase, frameIdx: 0, mensajeId: ronda.mensajeId };
                estadosRuleta.set(ronda.canalId, est);
            }

            est.frameIdx = (est.frameIdx + 1) % FRAMES_ANIMACION.length;

            const expInsc = ronda.expiraInscripcion || ronda.expiraEn || new Date(0);
            const expGiro = ronda.expiraGiro || new Date(expInsc.getTime() + 60000);
            const faseActual = ronda.fase || (ahora >= expInsc.getTime() ? 'girando' : 'inscripcion');

            // ── FASE 1: INSCRIPCIÓN (1 minuto) ──
            if (faseActual === 'inscripcion') {
                const restantes = Math.ceil((expInsc.getTime() - ahora) / 1000);

                if (restantes > 0) {
                    await msg.edit({
                        embeds: [embedRondaInscripcion(ronda, restantes, est.frameIdx)],
                        components: [filaBotonUnirse(ronda._id.toString(), ronda.precioEntrada || 50)],
                    }).catch(() => null);
                } else {
                    // ¡Se acabó el minuto de inscripción! Pasar a Fase 2 (Giro)
                    await cerrarInscripcionesEIniciarGiro(ronda, canal);
                }
            }
            // ── FASE 2: GIRANDO (1 minuto) ──
            else if (faseActual === 'girando') {
                const restantesGiro = Math.ceil((expGiro.getTime() - ahora) / 1000);

                if (restantesGiro > 0) {
                    await msg.edit({
                        embeds: [embedRondaGirando(ronda, restantesGiro, est.frameIdx)],
                        components: [filaBotonCerrado()],
                    }).catch(() => null);
                } else {
                    // ¡Se acabó el minuto de giro! Anunciar ganador
                    await resolverRondaGrupal(ronda._id, canal);
                }
            } else {
                // Si la ronda ya no está en fase activa, resolverla o finalizarla
                await resolverRondaGrupal(ronda._id, canal);
            }
        }
    } catch (err) {
        console.error('Error en tickServicioRuletas:', err?.message || err);
    }
}

function iniciarServicioRuletaGrupal(client) {
    if (_tickerId) clearInterval(_tickerId);
    _tickerId = setInterval(() => tickServicioRuletas(client), 3500);
    console.log('🎡 Servicio continuo de Ruleta Grupal en Dos Fases iniciado.');
}

async function recuperarRondasPendientes(client) {
    iniciarServicioRuletaGrupal(client);
    await tickServicioRuletas(client);
}

module.exports = {
    iniciarRondaGrupal,
    unirseRondaGrupal,
    resolverRondaGrupal,
    consultarCooldownRuleta,
    iniciarServicioRuletaGrupal,
    recuperarRondasPendientes,
    reembolsarRondasPendientes: recuperarRondasPendientes,
};

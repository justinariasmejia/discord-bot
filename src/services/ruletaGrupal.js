// src/services/ruletaGrupal.js
// Gestión de la Ruleta Grupal pública en canales de texto.
// - Precio de entrada fijo por ticket (definido al crear la ronda).
// - Animación giratoria visual con frames dinámicos.
// - Cuenta regresiva en tiempo real con marcas de tiempo nativas de Discord (<t:unix:R>).
// - Actualización inmediata del pozo y participantes ante cada ingreso.
// - 1 minuto de participación, 1 minuto de visualización del ganador y cooldown.
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

const rondasEnMemoria = new Map(); // canalId -> intervalId
const estadosRuleta = new Map();   // canalId -> { fase, finVisible, cooldownHasta, mensajeId, frameIdx }

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

    if (estadoCanal.fase === 'activa') {
        return { bloqueado: true, motivo: 'ya_activa' };
    }
    if (estadoCanal.fase === 'mostrando_resultado') {
        const restanteMs = Math.max(0, (estadoCanal.finVisible || ahora) - ahora);
        return { bloqueado: true, motivo: 'mostrando_resultado', restanteMs };
    }
    if (estadoCanal.fase === 'cooldown' && estadoCanal.cooldownHasta && ahora < estadoCanal.cooldownHasta) {
        const restanteMs = estadoCanal.cooldownHasta - ahora;
        return { bloqueado: true, motivo: 'en_cooldown', restanteMs };
    }
    return { bloqueado: false };
}

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

function filaBotonUnirse(rondaId, precio = 50, deshabilitado = false) {
    const btn = new ButtonBuilder()
        .setCustomId(`ruleta_grupal:unirse:publico:${rondaId}`)
        .setLabel(`🎟️ Unirme (${formatoNum(precio)} 🦴)`)
        .setStyle(ButtonStyle.Success)
        .setDisabled(deshabilitado);
    return new ActionRowBuilder().addComponents(btn);
}

function embedRondaActiva(ronda, segundosRestantes, frameIdx = 0) {
    const frame = FRAMES_ANIMACION[frameIdx % FRAMES_ANIMACION.length];
    const totalSegs = config.APUESTAS?.RULETA_GRUPAL?.DURACION_SEGUNDOS || 60;
    const barra = barraProgreso(segundosRestantes, totalSegs);
    const unixCierre = Math.floor(ronda.expiraEn.getTime() / 1000);
    const precio = ronda.precioEntrada || 50;
    const corte = Math.round(ronda.pozo * 0.05);
    const premioEstimado = Math.max(0, ronda.pozo - corte);

    let desc = `### ${frame} ⚡ ¡EN VIVO!\n` +
        `> *¡Ruleta Comunitaria Activa! Compra tu ticket de precio fijo con el botón de abajo. Todos los participantes tienen exactamente la misma probabilidad de llevarse el pozo entero.*\n\n` +
        `💰 **Pozo Acumulado:** **${formatoNum(ronda.pozo)}** 🦴 *(Premio neto estimado: ~**${formatoNum(premioEstimado)}** 🦴)*\n` +
        `🎟️ **Precio Fijo por Ticket:** **${formatoNum(precio)}** 🦴 *(1 entrada por cazador)*\n` +
        `⏳ **Cierre:** <t:${unixCierre}:R> • \`${segundosRestantes}s\` ${barra}\n\n` +
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
        `💡 *Al llegar a 0s, la ruleta se detendrá y anunciará al ganador aquí mismo durante 1 minuto.*\n`;

    return base('🎡 Ruleta Grupal de Halloween • En Vivo', desc, COLORES.naranja);
}

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
        return { ok: false, motivo: 'ya_activa' };
    }

    // Cobrar el ticket al creador para que sea el primer participante automático
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

    const duracionSegundos = config.APUESTAS?.RULETA_GRUPAL?.DURACION_SEGUNDOS || 60;
    const expiraEn = new Date(ahora + duracionSegundos * 1000);

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
        expiraEn,
        estado: 'activa',
    });

    const embed = embedRondaActiva(ronda, duracionSegundos, 0);
    const msg = await canal.send({
        embeds: [embed],
        components: [filaBotonUnirse(ronda._id.toString(), precioEntrada)],
    });

    ronda.mensajeId = msg.id;
    await ronda.save();

    // 🛡️ Proteger el mensaje en memoria de canalCripta
    protegerMensajeCripta(msg.id);

    estadosRuleta.set(canal.id, {
        fase: 'activa',
        mensajeId: msg.id,
        finActiva: ahora + duracionSegundos * 1000,
        frameIdx: 0,
    });

    // Loop de animación y cuenta regresiva en vivo cada 4 segundos
    let restantes = duracionSegundos;
    let frameIdx = 0;
    const intervalId = setInterval(async () => {
        restantes = Math.max(0, Math.ceil((ronda.expiraEn.getTime() - Date.now()) / 1000));
        frameIdx = (frameIdx + 1) % FRAMES_ANIMACION.length;

        const est = estadosRuleta.get(canal.id);
        if (est) est.frameIdx = frameIdx;

        if (restantes > 0) {
            const rActual = await RondaGrupal.findById(ronda._id);
            if (rActual && rActual.estado === 'activa') {
                await msg.edit({
                    embeds: [embedRondaActiva(rActual, restantes, frameIdx)],
                    components: [filaBotonUnirse(ronda._id.toString(), precioEntrada)],
                }).catch(() => null);
            }
        } else {
            clearInterval(intervalId);
            rondasEnMemoria.delete(canal.id);
            await resolverRondaGrupal(ronda._id, canal);
        }
    }, 4000);

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
    const duracionVisible = (config.APUESTAS?.RULETA_GRUPAL?.DURACION_RESULTADO_SEGUNDOS || 60) * 1000;
    const cooldownMs = (config.APUESTAS?.RULETA_GRUPAL?.COOLDOWN_SEGUNDOS || 60) * 1000;
    const ahora = Date.now();

    // ── Si menos de 2 participantes -> Cancelar y reembolsar ──
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
        await ronda.save();

        const cancelEmbed = base(
            '🎡 Ruleta Grupal — Cancelada',
            'No se unieron suficientes cazadores para girar la ruleta (mínimo 2 participantes).\n' +
            'Todos los huesos apostados han sido reembolsados íntegramente.\n\n' +
            '⏱️ _Este mensaje permanecerá visible 1 minuto antes de cerrarse._',
            COLORES.negro
        );

        if (mensaje) {
            await mensaje.edit({ embeds: [cancelEmbed], components: [filaBotonUnirse(rondaId, ronda.precioEntrada, true)] }).catch(() => null);
        }

        estadosRuleta.set(canal.id, {
            fase: 'mostrando_resultado',
            finVisible: ahora + duracionVisible,
            cooldownHasta: ahora + duracionVisible + cooldownMs,
            mensajeId: mensaje?.id,
        });

        setTimeout(async () => {
            try {
                if (mensaje) {
                    desprotegerMensajeCripta(mensaje.id);
                    await mensaje.delete().catch(() => null);
                }
            } catch {}
            const est = estadosRuleta.get(canal.id);
            if (est) est.fase = 'cooldown';
        }, duracionVisible);

        return;
    }

    // ── Elegir ganador (todos con igual probabilidad 1/N al ser precio fijo) ──
    const indiceGanador = Math.floor(Math.random() * ronda.participantes.length);
    const ganador = ronda.participantes[indiceGanador];
    const totalPozo = ronda.pozo;

    const corteCasa = Math.round(totalPozo * (config.APUESTAS?.RULETA_GRUPAL?.CORTE_CASA || 0.05));
    const premio = totalPozo - corteCasa;

    await modificarHuesos(ganador.userId, ronda.guildId, premio, 'apuesta', 'Premio Ruleta Grupal');
    ronda.ganadorId = ganador.userId;
    ronda.premioEntregado = premio;
    await ronda.save();

    // Actualizar estadísticas de jugadores
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
        `¡La ruleta se detuvo y la fortuna favoreció a <@${ganador.userId}>!\n\n` +
        `🏆 **Ganador:** <@${ganador.userId}> (${probGanador}% de probabilidad)\n` +
        `💰 **Premio entregado (+95%):** **+${formatoNum(premio)}** huesos 🦴\n` +
        `🎟️ **Pozo Total (${ronda.participantes.length} participantes):** ${formatoNum(totalPozo)} huesos\n` +
        `🏛️ _Comisión de la Cripta (5%): ${formatoNum(corteCasa)} huesos_\n\n` +
        `Gracias a todos los valientes que apostaron sus almas y huesos.\n\n` +
        `⏱️ _Este resultado permanecerá visible durante 1 minuto antes de cerrarse._`,
        COLORES.verde
    );

    if (mensaje) {
        await mensaje.edit({ embeds: [winEmbed], components: [filaBotonUnirse(rondaId, ronda.precioEntrada, true)] }).catch(() => null);
    }

    // Registrar en logs públicos
    await logRuletaGrupal(ronda.guildId, ganador.userId, totalPozo, premio, ronda.participantes.length, probGanador).catch(() => {});

    estadosRuleta.set(canal.id, {
        fase: 'mostrando_resultado',
        finVisible: ahora + duracionVisible,
        cooldownHasta: ahora + duracionVisible + cooldownMs,
        mensajeId: mensaje?.id,
    });

    setTimeout(async () => {
        try {
            if (mensaje) {
                desprotegerMensajeCripta(mensaje.id);
                await mensaje.delete().catch(() => null);
            }
        } catch {}
        const est = estadosRuleta.get(canal.id);
        if (est) est.fase = 'cooldown';
    }, duracionVisible);
}

// ── Unirse con Precio Fijo (1 solo clic, actualización inmediata del pozo) ──
async function unirseRondaGrupal(rondaId, userId, guildId, canal = null) {
    const bloqueo = await conBloqueo(`${guildId}:${userId}`, async () => {
        const ronda = await RondaGrupal.findOne({ _id: rondaId, estado: 'activa' });
        if (!ronda) return { ok: false, motivo: 'ronda_inactiva' };

        const precio = ronda.precioEntrada || 50;

        // Verificar si ya está participando (1 entrada por persona para igualdad)
        const yaParticipa = ronda.participantes.some((p) => p.userId === userId);
        if (yaParticipa) {
            return { ok: false, motivo: 'ya_participa', precio };
        }

        const usuario = await obtenerUsuario(userId, guildId);
        if (usuario.huesos < precio) {
            return { ok: false, motivo: 'saldo_insuficiente', precio, saldo: usuario.huesos };
        }

        // Deducción atómica
        const deducido = await modificarHuesos(userId, guildId, -precio, 'apuesta', 'Ticket Ruleta Grupal');
        if (!deducido) return { ok: false, motivo: 'saldo_insuficiente' };

        // Registro atómico evitando duplicados
        const actualizada = await RondaGrupal.findOneAndUpdate(
            {
                _id: rondaId,
                estado: 'activa',
                'participantes.userId': { $ne: userId },
            },
            {
                $inc: { pozo: precio },
                $push: { participantes: { userId, monto: precio, fecha: new Date() } },
            },
            { new: true }
        );

        if (!actualizada) {
            // Reembolsar si hubo condición de carrera
            await modificarHuesos(userId, guildId, precio, 'reembolso', 'Reembolso por registro concurrente');
            return { ok: false, motivo: 'ya_participa', precio };
        }

        // 🚀 ACTUALIZACIÓN INMEDIATA DEL MENSAJE PÚBLICO (Cero delay para ver el pozo subir)
        if (canal && actualizada.mensajeId) {
            const msg = await canal.messages.fetch(actualizada.mensajeId).catch(() => null);
            if (msg) {
                const est = estadosRuleta.get(canal.id);
                const frameIdx = est?.frameIdx || 0;
                const restantes = Math.max(0, Math.ceil((actualizada.expiraEn.getTime() - Date.now()) / 1000));
                await msg.edit({
                    embeds: [embedRondaActiva(actualizada, restantes, frameIdx)],
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

module.exports = {
    iniciarRondaGrupal,
    unirseRondaGrupal,
    reembolsarRondasPendientes,
    resolverRondaGrupal,
    consultarCooldownRuleta,
};

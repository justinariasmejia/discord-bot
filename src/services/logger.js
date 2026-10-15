// src/services/logger.js
// Sistema de auditoría dual y registro persistente:
// 1. Logs Públicos: Transparencia total en vivo que justifica de dónde gana y gasta huesos cada usuario.
// 2. Logs de Administradores: Auditoría detallada de staff, seguridad, mantenimiento, sanciones y balance.
// 3. Logs Privados y Persistentes: Registro en Base de Datos (ApuestaLog, DuelLog) y canales dedicados para apuestas y duelos.

const { EmbedBuilder } = require('discord.js');
const ConfigEvento = require('../models/ConfigEvento');
const Usuario = require('../models/Usuario');
const DuelLog = require('../models/DuelLog');
const ApuestaLog = require('../models/ApuestaLog');
const { formatoNum } = require('../utils/embeds');
const { EMOJIS } = require('../utils/emojis');

const COLORES_LOG = {
    ganancia: 0x2e7d32,    // Verde esmeralda
    perdida: 0xb00020,     // Rojo carmesí
    apuesta: 0xff7518,     // Naranja de Halloween
    duelo: 0xef6c00,       // Naranja intenso
    admin: 0x1565c0,       // Azul
    evento: 0x6a0dad,      // Morado oscuro
    sorteo: 0xffd700,      // Dorado
    sistema: 0x37474f,     // Gris pizarra
    sancion: 0xd32f2f,     // Rojo alerta
};

let _client = null;
function setLogClient(client) {
    _client = client;
}

// ── Enviar a Canal Público (Transparencia de la Comunidad) ──
async function enviarLogPublico(guildId, { tipo, titulo, descripcion, userId, campos, thumbnail }) {
    if (!_client) return;
    try {
        const config = await ConfigEvento.findOne({ guildId }).lean();
        const canalId = config?.canalLogsPublicosId || config?.canalLogsId;
        if (!canalId) return;

        const canal = _client.channels.cache.get(canalId) || await _client.channels.fetch(canalId).catch(() => null);
        if (!canal || !canal.isTextBased()) return;

        const color = COLORES_LOG[tipo] || COLORES_LOG.sistema;
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(titulo)
            .setDescription(descripcion)
            .setTimestamp()
            .setFooter({ text: '📜 Registro Público • La Cripta de los Huesos' });

        if (userId) {
            const user = _client.users.cache.get(userId) || await _client.users.fetch(userId).catch(() => null);
            if (user) embed.setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ dynamic: true }) });
        }

        if (campos && campos.length > 0) embed.addFields(campos);
        if (thumbnail) embed.setThumbnail(thumbnail);

        await canal.send({ embeds: [embed] }).catch(() => null);
    } catch {}
}

// ── Enviar a Canal de Administradores (Seguridad y Moderación) ──
async function enviarLogAdmin(guildId, { titulo, descripcion, adminId, campos, color = COLORES_LOG.admin }) {
    if (!_client) return;
    try {
        const config = await ConfigEvento.findOne({ guildId }).lean();
        const canalId = config?.canalLogsId || config?.canalLogsPublicosId;
        if (!canalId) return;

        const canal = _client.channels.cache.get(canalId) || await _client.channels.fetch(canalId).catch(() => null);
        if (!canal || !canal.isTextBased()) return;

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`🛡️ ${titulo}`)
            .setDescription(descripcion)
            .setTimestamp()
            .setFooter({ text: '🔒 Auditoría Administrativa • Personal Autorizado' });

        if (adminId) {
            const admin = _client.users.cache.get(adminId) || await _client.users.fetch(adminId).catch(() => null);
            if (admin) embed.setAuthor({ name: `Admin: ${admin.tag}`, iconURL: admin.displayAvatarURL({ dynamic: true }) });
        }

        if (campos && campos.length > 0) embed.addFields(campos);

        await canal.send({ embeds: [embed] }).catch(() => null);
    } catch {}
}

// ── Enviar a Canal Dedicado (Logs Privados Específicos) ──
async function enviarLogCanalDedicado(guildId, canalIdKey, embed) {
    if (!_client) return;
    try {
        const config = await ConfigEvento.findOne({ guildId }).lean();
        const canalId = config?.[canalIdKey];
        if (!canalId) return;

        const canal = _client.channels.cache.get(canalId) || await _client.channels.fetch(canalId).catch(() => null);
        if (!canal || !canal.isTextBased()) return;

        await canal.send({ embeds: [embed] }).catch(() => null);
    } catch {}
}

// ── Persistencia de Logs Privados en Base de Datos y Canales Dedicados ──

async function guardarLogDueloDB({ guildId, retadorId, rivalId, ganadorId, perdedorId, monto, premio, detalle }) {
    try {
        const doc = await DuelLog.create({
            guildId,
            retadorId,
            rivalId,
            ganadorId,
            perdedorId,
            monto,
            premio,
            detalle: detalle || `Ganador: ${ganadorId} vs ${perdedorId}`,
        });

        // Si se configuró un canal dedicado para logs de duelos, enviarlo
        const embedDedicado = new EmbedBuilder()
            .setColor(COLORES_LOG.duelo)
            .setTitle('⚔️ Registro Privado • Duelo PvP Finalizado')
            .setDescription(
                `**Retador:** <@${retadorId}>\n` +
                `**Rival:** <@${rivalId}>\n` +
                `**Ganador:** <@${ganadorId}>\n` +
                `**Perdedor:** <@${perdedorId}>\n` +
                `**Monto individual:** ${formatoNum(monto)} 🦴 (Pozo total: ${formatoNum(monto * 2)} 🦴)\n` +
                `**Premio entregado:** +${formatoNum(premio)} 🦴`
            )
            .addFields([
                { name: '📝 Detalle', value: detalle || 'Duelo completado normalmente', inline: false }
            ])
            .setTimestamp()
            .setFooter({ text: `ID Registro: ${doc._id} • Auditoría Privada` });

        await enviarLogCanalDedicado(guildId, 'canalLogsDuelosId', embedDedicado);
        return doc;
    } catch (e) {
        console.error('Error guardando log de duelo en BD:', e);
    }
}

async function guardarLogApuestaDB({ guildId, userId, juego, monto, gano, premio, detalle, saldoFinal }) {
    try {
        const doc = await ApuestaLog.create({
            guildId,
            userId,
            juego,
            monto,
            gano,
            premio: premio || 0,
            detalle: detalle || (gano ? `Ganó +${premio} en ${juego}` : `Perdió -${monto} en ${juego}`),
        });

        // Si se configuró un canal dedicado para logs de apuestas, enviarlo
        const embedDedicado = new EmbedBuilder()
            .setColor(gano ? COLORES_LOG.ganancia : COLORES_LOG.perdida)
            .setTitle(`🎲 Registro Privado • Apuesta (${juego})`)
            .setDescription(
                `**Cazador:** <@${userId}>\n` +
                `**Juego:** ${juego}\n` +
                `**Monto apostado:** ${formatoNum(monto)} 🦴\n` +
                `**Resultado:** ${gano ? `🎉 Victoria (+${formatoNum(premio)} 🦴)` : `💀 Derrota (-${formatoNum(monto)} 🦴)}`}` +
                (saldoFinal !== undefined ? `\n**Saldo restante:** ${formatoNum(saldoFinal)} 🦴` : '')
            )
            .addFields([
                { name: '📝 Detalle', value: detalle || 'Tirada registrada', inline: false }
            ])
            .setTimestamp()
            .setFooter({ text: `ID Registro: ${doc._id} • Auditoría Privada` });

        await enviarLogCanalDedicado(guildId, 'canalLogsApuestasId', embedDedicado);
        return doc;
    } catch (e) {
        console.error('Error guardando log de apuesta en BD:', e);
    }
}

// ── Funciones de Consulta y Filtrado para Administradores ──

/**
 * Obtener logs de apuestas filtrados por servidor, usuario o juego.
 * @param {string} guildId
 * @param {object} [filtro]
 * @param {string} [filtro.userId]
 * @param {string} [filtro.juego]
 * @param {number} [filtro.limite]
 * @returns {Promise<Array>} Lista de documentos ApuestaLog
 */
async function obtenerLogsApuesta(guildId, { userId, juego, limite = 15 } = {}) {
    const query = { guildId };
    if (userId) query.userId = userId;
    if (juego) query.juego = juego;
    return ApuestaLog.find(query).sort({ createdAt: -1 }).limit(Math.min(limite, 50)).lean();
}

/**
 * Obtener logs de duelos filtrados por servidor o usuario.
 * @param {string} guildId
 * @param {object} [filtro]
 * @param {string} [filtro.userId]
 * @param {number} [filtro.limite]
 * @returns {Promise<Array>} Lista de documentos DuelLog
 */
async function obtenerLogsDuelo(guildId, { userId, limite = 15 } = {}) {
    const query = { guildId };
    if (userId) {
        query.$or = [
            { retadorId: userId },
            { rivalId: userId },
            { ganadorId: userId },
            { perdedorId: userId },
        ];
    }
    return DuelLog.find(query).sort({ createdAt: -1 }).limit(Math.min(limite, 50)).lean();
}

/**
 * Obtener usuarios con sanciones activas (silencio o bloqueo).
 * @param {string} guildId
 * @returns {Promise<Array>}
 */
async function obtenerSancionesActivas(guildId) {
    const { obtenerSancionesActivas: getSanciones } = require('./sanciones');
    return getSanciones(guildId);
}

/**
 * Levantar sanción de un usuario.
 * @param {string} userId
 * @param {string} guildId
 * @param {string} [adminId]
 * @returns {Promise<{ ok: boolean, motivo?: string }>}
 */
async function levantarSancion(userId, guildId, adminId = null) {
    const { levantarSancion: levantar } = require('./sanciones');
    return levantar(userId, guildId, adminId);
}

// ── 1. LOG PÚBLICO: CACERÍA DE HUESOS ──
async function logCaza(guildId, userId, resultado) {
    if (!resultado.ok && resultado.motivo === 'cooldown') return;
    const esPremio = (resultado.premio || 0) > 0;
    const campos = [
        { name: '📦 Hallazgo', value: resultado.titulo || 'Exploración', inline: true },
        { name: esPremio ? '💰 Ganancia' : '💸 Saldo', value: esPremio ? `+${formatoNum(resultado.premio)} 🦴` : '0 🦴', inline: true },
    ];
    if (resultado.usuario) {
        campos.push({ name: '🦴 Saldo Actual', value: `${formatoNum(resultado.usuario.huesos)} 🦴`, inline: true });
    }

    await enviarLogPublico(guildId, {
        tipo: esPremio ? 'ganancia' : 'perdida',
        titulo: `${EMOJIS.calaveraCeja || '🏹'} Cacería en la Cripta`,
        descripcion: `<@${userId}> exploró las sombras del cementerio y ${esPremio ? `obtuvo botín.` : `no encontró nada nuevo.`}`,
        userId,
        campos,
    });
}

// ── 2. LOG PÚBLICO: RECOMPENSA DIARIA ──
async function logDiario(guildId, userId, resultado) {
    if (!resultado.ok) return;
    const campos = [
        { name: '🎁 Ofrenda Diaria', value: `+${formatoNum(resultado.premio)} 🦴`, inline: true },
        { name: '🔥 Racha', value: `${resultado.racha} día(s)`, inline: true },
        { name: '🦴 Saldo Actual', value: `${formatoNum(resultado.usuario?.huesos || 0)} 🦴`, inline: true },
    ];

    await enviarLogPublico(guildId, {
        tipo: 'ganancia',
        titulo: `${EMOJIS.kittyHalloween || '🎁'} Bendición Diaria Reclamada`,
        descripcion: `<@${userId}> recolectó su tributo diario de ultratumba.`,
        userId,
        campos,
    });
}

// Cooldown en memoria de logs públicos para evitar saturación de canales por spam de tragamonedas
const cooldownsLogsApuestas = new Map(); // userId -> timestamp

// ── 3. LOG PÚBLICO & PRIVADO: APUESTAS (Cara o Cruz, Tragamonedas, Dados, Ruleta) ──
async function logApuesta(guildId, userId, resultado) {
    if (!resultado.ok) return;
    const gano = resultado.gana;
    const nombreJuego = resultado.juego === 'cara_cruz'
        ? '🪙 Cara o Cruz'
        : (resultado.juego === 'tragamonedas'
            ? '🎰 Tragamonedas'
            : (resultado.juego === 'dados' ? '🎲 Dados Malditos' : (resultado.juego === 'ruleta' ? '🎡 Ruleta Calabaza' : resultado.juego)));

    // 1. Guardar SIEMPRE en base de datos y enviar al canal privado de apuestas si existe
    guardarLogApuestaDB({
        guildId,
        userId,
        juego: resultado.juego || 'apuesta',
        monto: resultado.monto,
        gano,
        premio: resultado.premio || 0,
        detalle: resultado.detalle || `${nombreJuego}: ${gano ? `Ganó +${formatoNum(resultado.premio)}` : `Perdió -${formatoNum(resultado.monto)}`}`,
        saldoFinal: resultado.saldoFinal,
    }).catch(() => null);

    // 2. Filtro inteligente de spam para el canal PÚBLICO de la comunidad:
    // • Las victorias siempre se publican (para celebrar botes y premios).
    // • Las pérdidas pequeñas (< 50 huesos) en minijuegos rápidos no se envían al canal público para no saturarlo.
    if (!gano && resultado.monto < 50) {
        return;
    }

    // Throttle público: Máximo 1 log de apuesta perdida por usuario cada 15 segundos en el canal público
    const ahora = Date.now();
    const ultimoLog = cooldownsLogsApuestas.get(userId) || 0;
    if (ahora - ultimoLog < 15000 && !gano) {
        return;
    }
    cooldownsLogsApuestas.set(userId, ahora);

    const campos = [
        { name: '🎲 Juego', value: nombreJuego, inline: true },
        { name: '💰 Monto Apostado', value: `${formatoNum(resultado.monto)} 🦴`, inline: true },
        { name: gano ? '🎉 Ganancia' : '🩸 Pérdida', value: gano ? `+${formatoNum(resultado.premio)} 🦴` : `-${formatoNum(resultado.monto)} 🦴`, inline: true },
    ];

    if (resultado.saldoFinal !== undefined) {
        campos.push({ name: '🦴 Saldo Restante', value: `${formatoNum(resultado.saldoFinal)} 🦴`, inline: true });
    }

    if (resultado.juego === 'cara_cruz') {
        campos.push({ name: '🎯 Predicción / Cayó', value: `${(resultado.eleccion || '').toUpperCase()} ➡️ **${(resultado.resultado || resultado.resultadoLado || '').toUpperCase()}**`, inline: true });
    }

    await enviarLogPublico(guildId, {
        tipo: gano ? 'ganancia' : 'perdida',
        titulo: gano ? `🎰 ¡Apuesta Ganada! (${nombreJuego})` : `💀 Apuesta Perdida (${nombreJuego})`,
        descripcion: `<@${userId}> ${gano ? 'acertó su apuesta y multiplicó sus huesos' : 'perdió sus huesos ante las ánimas'}.`,
        userId,
        campos,
    });
}

// ── 3.1. LOG PÚBLICO: RULETA GRUPAL COMUNITARIA ──
async function logRuletaGrupal(guildId, ganadorId, totalPozo, premio, numParticipantes, probGanador) {
    const campos = [
        { name: '🏆 Ganador', value: `<@${ganadorId}>`, inline: true },
        { name: '💰 Pozo Total', value: `${formatoNum(totalPozo)} 🦴`, inline: true },
        { name: '🎁 Premio Neto (+95%)', value: `+${formatoNum(premio)} 🦴`, inline: true },
        { name: '👥 Jugadores', value: `${numParticipantes} cazadores`, inline: true },
        { name: '🎲 Probabilidad', value: `${probGanador}%`, inline: true },
    ];

    await enviarLogPublico(guildId, {
        tipo: 'ganancia',
        titulo: '🎡 Victoria en Ruleta Grupal',
        descripcion: `¡<@${ganadorId}> triunfó en la Ruleta Grupal de la Cripta y se llevó el pozo acumulado!`,
        userId: ganadorId,
        campos,
    });
}

// ── 4. LOG PÚBLICO & PRIVADO: DUELOS PVP ──
async function logDuelo(guildId, ganadorId, perdedorId, premio, monto = 0, detalle = null) {
    // Si viene monto, respaldar también en BD
    if (monto > 0) {
        guardarLogDueloDB({
            guildId,
            retadorId: perdedorId,
            rivalId: ganadorId,
            ganadorId,
            perdedorId,
            monto,
            premio,
            detalle: detalle || 'Duelo PvP resuelto',
        }).catch(() => null);
    }

    const campos = [
        { name: '🏆 Vencedor', value: `<@${ganadorId}>`, inline: true },
        { name: '💀 Caído', value: `<@${perdedorId}>`, inline: true },
        { name: '💰 Botín Cobrado', value: `+${formatoNum(premio)} 🦴`, inline: true },
    ];

    await enviarLogPublico(guildId, {
        tipo: 'duelo',
        titulo: '⚔️ Duelo PvP Resuelto',
        descripcion: `¡<@${ganadorId}> derrotó a <@${perdedorId}> en un duelo de reflejos y se llevó el pozo!`,
        campos,
    });
}

// ── 5. LOG PÚBLICO: EVENTOS COMUNITARIOS (Fantasma, Trivia, Huesos) ──
async function logEvento(guildId, tipoEvento, descripcion, userId = null, premio = null) {
    const campos = [];
    if (premio) campos.push({ name: '💰 Recompensa', value: `+${formatoNum(premio)} 🦴`, inline: true });

    await enviarLogPublico(guildId, {
        tipo: 'evento',
        titulo: `🎃 Evento Comunitario: ${tipoEvento}`,
        descripcion: userId ? `<@${userId}> participó en el evento: ${descripcion}` : descripcion,
        userId,
        campos,
    });
}

// ── 6. LOG PÚBLICO: SORTEO / DROP ALEATORIO ──
async function logSorteo(guildId, ganadorId, premio, creadorId) {
    const campos = [
        { name: '🎁 Ganador', value: `<@${ganadorId}>`, inline: true },
        { name: '💰 Premio', value: `+${formatoNum(premio)} 🦴`, inline: true },
        { name: '👑 Iniciado por', value: `<@${creadorId}>`, inline: true },
    ];

    await enviarLogPublico(guildId, {
        tipo: 'sorteo',
        titulo: '🎉 Sorteo Relámpago Concluido',
        descripcion: `¡<@${ganadorId}> ha ganado el drop comunitario de huesos!`,
        userId: ganadorId,
        campos,
    });
}

// ── 7. LOG DE AUDITORÍA: ADMINISTRADORES Y SEGURIDAD ──
async function logAdmin(guildId, adminId, accion, descripcion, campos = []) {
    await enviarLogAdmin(guildId, {
        titulo: accion,
        descripcion: `**Acción:** ${accion}\n${descripcion}`,
        adminId,
        campos,
    });
}

module.exports = {
    setLogClient,
    enviarLogPublico,
    enviarLogAdmin,
    enviarLogCanalDedicado,
    logCaza,
    logDiario,
    logApuesta,
    logRuletaGrupal,
    logDuelo,
    logEvento,
    logSorteo,
    logAdmin,
    // Helpers de persistencia en BD y canal privado
    guardarLogDueloDB,
    guardarLogApuestaDB,
    // Consultas y gestión de auditoría/sanciones
    obtenerLogsApuesta,
    obtenerLogsDuelo,
    obtenerSancionesActivas,
    levantarSancion,
};

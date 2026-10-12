// src/services/logger.js
// Sistema de auditoría dual:
// 1. Logs Públicos: Transparencia total en vivo que justifica de dónde gana y gasta huesos cada usuario.
// 2. Logs de Administradores: Auditoría detallada de staff, seguridad, mantenimiento y balance.
const { EmbedBuilder } = require('discord.js');
const ConfigEvento = require('../models/ConfigEvento');
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
            const user = _client.users.cache.get(userId);
            if (user) embed.setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ dynamic: true }) });
        }

        if (campos && campos.length > 0) embed.addFields(campos);
        if (thumbnail) embed.setThumbnail(thumbnail);

        await canal.send({ embeds: [embed] }).catch(() => null);
    } catch {}
}

// ── Enviar a Canal de Administradores (Seguridad y Moderación) ──
async function enviarLogAdmin(guildId, { titulo, descripcion, adminId, campos }) {
    if (!_client) return;
    try {
        const config = await ConfigEvento.findOne({ guildId }).lean();
        const canalId = config?.canalLogsId || config?.canalLogsPublicosId;
        if (!canalId) return;

        const canal = _client.channels.cache.get(canalId) || await _client.channels.fetch(canalId).catch(() => null);
        if (!canal || !canal.isTextBased()) return;

        const embed = new EmbedBuilder()
            .setColor(COLORES_LOG.admin)
            .setTitle(`🛡️ ${titulo}`)
            .setDescription(descripcion)
            .setTimestamp()
            .setFooter({ text: '🔒 Auditoría Administrativa • Personal Autorizado' });

        if (adminId) {
            const admin = _client.users.cache.get(adminId);
            if (admin) embed.setAuthor({ name: `Admin: ${admin.tag}`, iconURL: admin.displayAvatarURL({ dynamic: true }) });
        }

        if (campos && campos.length > 0) embed.addFields(campos);

        await canal.send({ embeds: [embed] }).catch(() => null);
    } catch {}
}

// ── 1. LOG PÚBLICO: CACERÍA DE HUESOS ──
async function logCaza(guildId, userId, resultado) {
    if (!resultado.ok && resultado.motivo === 'cooldown') return; // no spamear cooldowns
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

// Cooldown en memoria de logs para evitar saturación de canales por spam de tragamonedas
const cooldownsLogsApuestas = new Map(); // userId -> timestamp

// ── 3. LOG PÚBLICO: APUESTAS (Cara o Cruz, Tragamonedas, etc.) ──
async function logApuesta(guildId, userId, resultado) {
    if (!resultado.ok) return;
    const gano = resultado.gana;
    const nombreJuego = resultado.juego === 'cara_cruz' ? '🪙 Cara o Cruz' : (resultado.juego === 'tragamonedas' ? '🎰 Tragamonedas' : resultado.juego);

    // 🛡️ Filtro inteligente de spam en logs públicos:
    // • Las victorias SIEMPRE se publican (para celebrar premios y botes).
    // • Las pérdidas de montos pequeños (< 50 huesos) en tragamonedas NO se publican para no saturar el canal de logs.
    // • Solo se publican pérdidas si el monto apostado es relevante (>= 50 huesos).
    if (!gano && resultado.monto < 50) {
        return; // No spamear el canal público con tiradas cotidianas perdidas de 10-25 huesos
    }

    // Throttle: Máximo 1 log de apuesta por usuario cada 15 segundos en el canal público
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
        { name: '🦴 Saldo Restante', value: `${formatoNum(resultado.saldoFinal)} 🦴`, inline: true },
    ];

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

// ── 4. LOG PÚBLICO: DUELOS PVP ──
async function logDuelo(guildId, ganadorId, perdedorId, premio) {
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

// ── 7. LOG DE AUDITORÍA: ADMINISTRADORES ──
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
    logCaza,
    logDiario,
    logApuesta,
    logRuletaGrupal,
    logDuelo,
    logEvento,
    logSorteo,
    logAdmin,
};

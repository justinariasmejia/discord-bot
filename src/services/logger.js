// src/services/logger.js
// Sistema de logs en vivo: envía embeds detallados al canal de logs configurado.
const { EmbedBuilder } = require('discord.js');
const ConfigEvento = require('../models/ConfigEvento');

const COLORES_LOG = {
    ganancia: 0x43a047,    // verde
    perdida: 0xe53935,     // rojo
    apuesta: 0xffa726,     // naranja
    robo: 0x7b1fa2,        // morado
    admin: 0x1565c0,       // azul
    evento: 0x00897b,      // teal
    duelo: 0xef6c00,       // naranja oscuro
    tienda: 0x8e24aa,      // púrpura
    sistema: 0x546e7a,     // gris
};

const ICONOS = {
    cazar: '🏹',
    diario: '🎁',
    apuesta_ganada: '🎰✅',
    apuesta_perdida: '🎰❌',
    robo_exitoso: '🕵️✅',
    robo_fallido: '🕵️❌',
    robo_inmune: '🧿🛡️',
    duelo_ganado: '⚔️✅',
    duelo_perdido: '⚔️❌',
    compra: '🛒',
    uso_item: '🧪',
    limosna: '🤲',
    admin_dar: '🦴➕',
    admin_quitar: '🦴➖',
    admin_config: '⚙️',
    evento_fantasma: '👻',
    evento_trivia: '🎃',
    evento_cofre: '🗝️',
    evento_eclipse: '🌕',
    maldicion: '👻💀',
    bienvenida: '🆕',
    multa_robo: '🚨',
    compensacion_robo: '💰',
};

let _client = null;
function setLogClient(client) { _client = client; }

async function enviarLog(guildId, { tipo, titulo, descripcion, userId, campos, thumbnail }) {
    if (!_client) return;
    try {
        const config = await ConfigEvento.findOne({ guildId }).lean();
        if (!config || !config.canalLogsId) return;

        const canal = _client.channels.cache.get(config.canalLogsId)
            || await _client.channels.fetch(config.canalLogsId).catch(() => null);
        if (!canal || !canal.isTextBased()) return;

        const color = COLORES_LOG[tipo] || COLORES_LOG.sistema;
        const icono = ICONOS[tipo] || '📋';

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`${icono} ${titulo}`)
            .setDescription(descripcion)
            .setTimestamp()
            .setFooter({ text: '📋 Log del Sistema • La Cripta de los Huesos' });

        if (userId) {
            embed.setAuthor({ name: `Usuario: ${userId}` });
        }

        if (campos && campos.length > 0) {
            embed.addFields(campos);
        }

        if (thumbnail) {
            embed.setThumbnail(thumbnail);
        }

        await canal.send({ embeds: [embed] }).catch(() => null);
    } catch (err) {
        // Silenciar errores de logs para no afectar el flujo principal
    }
}

// ── Funciones de log especializadas ──
async function logCaza(guildId, userId, resultado) {
    const campos = [];
    if (resultado.premio) campos.push({ name: '💰 Ganancia', value: `+${resultado.premio} 🦴`, inline: true });
    if (resultado.perdida) campos.push({ name: '💸 Pérdida', value: `-${resultado.perdida} 🦴`, inline: true });
    if (resultado.usuario) campos.push({ name: '🦴 Saldo', value: `${resultado.usuario.huesos} 🦴`, inline: true });
    campos.push({ name: '📦 Resultado', value: resultado.tipo || 'Desconocido', inline: true });

    await enviarLog(guildId, {
        tipo: resultado.premio > 0 ? 'ganancia' : (resultado.perdida > 0 ? 'perdida' : 'sistema'),
        titulo: `Cacería — ${resultado.titulo || 'Exploración'}`,
        descripcion: `<@${userId}> exploró el cementerio.`,
        userId,
        campos,
    });
}

async function logApuesta(guildId, userId, resultado) {
    const esGanancia = resultado.gana;
    const campos = [
        { name: '🎲 Juego', value: resultado.juego || 'Desconocido', inline: true },
        { name: '💰 Monto', value: `${resultado.monto} 🦴`, inline: true },
    ];
    if (esGanancia) {
        campos.push({ name: '🏆 Premio', value: `+${resultado.premio} 🦴`, inline: true });
    }
    campos.push({ name: '🦴 Saldo', value: `${resultado.saldoFinal} 🦴`, inline: true });

    await enviarLog(guildId, {
        tipo: 'apuesta',
        titulo: esGanancia ? 'Apuesta GANADA' : 'Apuesta PERDIDA',
        descripcion: `<@${userId}> ${esGanancia ? 'ganó' : 'perdió'} en **${resultado.juego}**.`,
        userId,
        campos,
    });
}

async function logRobo(guildId, ladronId, victimaId, resultado) {
    const campos = [];
    if (resultado.exito) {
        campos.push({ name: '💰 Robado', value: `${resultado.monto} 🦴`, inline: true });
    } else if (resultado.multa) {
        campos.push({ name: '🚨 Multa', value: `${resultado.multa} 🦴`, inline: true });
    }
    campos.push({ name: '🎯 Víctima', value: `<@${victimaId}>`, inline: true });

    await enviarLog(guildId, {
        tipo: 'robo',
        titulo: resultado.exito ? 'Robo Exitoso' : 'Robo Fallido',
        descripcion: resultado.exito
            ? `<@${ladronId}> robó exitosamente a <@${victimaId}>.`
            : `<@${ladronId}> fue atrapado intentando robar a <@${victimaId}>.`,
        userId: ladronId,
        campos,
    });
}

async function logDuelo(guildId, ganadorId, perdedorId, premio) {
    await enviarLog(guildId, {
        tipo: 'duelo',
        titulo: 'Duelo Concluido',
        descripcion: `<@${ganadorId}> venció a <@${perdedorId}> en duelo.`,
        campos: [
            { name: '🏆 Ganador', value: `<@${ganadorId}>`, inline: true },
            { name: '💀 Perdedor', value: `<@${perdedorId}>`, inline: true },
            { name: '💰 Premio', value: `${premio} 🦴`, inline: true },
        ],
    });
}

async function logCompra(guildId, userId, itemNombre, precio, saldo) {
    await enviarLog(guildId, {
        tipo: 'tienda',
        titulo: 'Compra en el Bazar',
        descripcion: `<@${userId}> compró **${itemNombre}**.`,
        userId,
        campos: [
            { name: '🏷️ Precio', value: `${precio} 🦴`, inline: true },
            { name: '🦴 Saldo', value: `${saldo} 🦴`, inline: true },
        ],
    });
}

async function logAdmin(guildId, adminId, accion, descripcion, campos) {
    await enviarLog(guildId, {
        tipo: 'admin',
        titulo: `Admin: ${accion}`,
        descripcion: `<@${adminId}> ejecutó: **${accion}**\n${descripcion}`,
        userId: adminId,
        campos,
    });
}

async function logEvento(guildId, tipoEvento, descripcion) {
    await enviarLog(guildId, {
        tipo: 'evento',
        titulo: `Evento: ${tipoEvento}`,
        descripcion,
    });
}

module.exports = {
    setLogClient,
    enviarLog,
    logCaza,
    logApuesta,
    logRobo,
    logDuelo,
    logCompra,
    logAdmin,
    logEvento,
};

// src/services/canalCripta.js
// Centro de mando interactivo fijo de "La Cripta de los Huesos"
// - Mensaje maestro permanente con Ranking en vivo arriba y botones interactivos abajo.
// - Actualización en tiempo real ante cualquier cambio en el podio.
// - Limpieza automática del canal para mantenerlo siempre impecable.
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
} = require('discord.js');
const ConfigEvento = require('../models/ConfigEvento');
const Usuario = require('../models/Usuario');
const { basePremium, COLORES, formatoNum, tiempoRelativo, BARRA_PROGRESO } = require('../utils/embeds');
const { EMOJIS } = require('../utils/emojis');
const { obtenerConfig, eventoActivo, multiplicadorActual } = require('./evento');

const MEDALLAS = [EMOJIS.corona || '🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const canalesCriptaCache = new Map(); // guildId -> { canalId, mensajeId }
const debouncesActualizacion = new Map(); // guildId -> timeout

let _client = null;

function setClientCripta(client) {
    _client = client;
}

// ── Constructor del Panel Maestro con Ranking en Vivo ──
async function construirPanelCripta(guildId) {
    const config = await obtenerConfig(guildId);
    const activo = eventoActivo(config);
    const multiplicador = multiplicadorActual(config);

    const topUsuarios = await Usuario.find({ guildId })
        .sort({ huesos: -1, updatedAt: 1 })
        .limit(10)
        .lean();

    const totalCazadores = await Usuario.countDocuments({ guildId });
    const maxHuesos = topUsuarios.length > 0 ? topUsuarios[0].huesos : 1;

    let desc = '> *Bienvenido a la Cripta. Reúne huesos cazando, en duelos, apostando y chateando para conquistar el podio.*\n\n';

    desc += '### 🏆 Tabla de Clasificación en Vivo (Top 10)\n';
    desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    if (topUsuarios.length === 0) {
        desc += '*Las tumbas permanecen intactas... Sé el primer cazador en reclamar el podio.*\n';
    } else {
        topUsuarios.forEach((u, i) => {
            const medalla = MEDALLAS[i] || `#${i + 1}`;
            const racha = u.rachaDiaria > 0 ? ` • 🔥 \`${u.rachaDiaria}d\`` : '';
            desc += `${medalla} <@${u.userId}> — **${formatoNum(u.huesos)}** 🦴${racha}\n`;
        });
    }
    desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    // Estado del Evento
    desc += '### ⚙️ Información de Temporada\n';
    if (activo) {
        desc += `🟢 **Estado:** Temporada Activa\n`;
        desc += `⏳ **Cierre:** ${tiempoRelativo(config.fechaCierre.getTime())}\n`;
        if (multiplicador > 1) {
            desc += `⚡ **Bonus Activo:** ¡Ganancias multiplicadas **x${multiplicador}**!\n`;
        }
    } else {
        desc += '🔴 **La Cripta ha cerrado sus puertas por esta temporada.**\n';
    }
    desc += `👥 **Total de cazadores:** \`${formatoNum(totalCazadores)}\`\n\n`;
    desc += '👇 *Interactúa con los botones de abajo para jugar, cazar huesos o ver tu perfil sin escribir comandos:*';

    const embed = basePremium(`${EMOJIS.calabaza || '🎃'} La Cripta de los Huesos • Centro de Mando`, desc, COLORES.naranja);
    embed.setFooter({ text: '⚡ Ranking en tiempo real • 🎃 La Cripta de los Huesos' });

    // Fila 1: Acciones Principales
    const fila1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('cripta:hub_cazar:todos')
            .setLabel('Cazar')
            .setEmoji('🏹')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!activo),
        new ButtonBuilder()
            .setCustomId('cripta:hub_diario:todos')
            .setLabel('Reclamar Diario')
            .setEmoji('🎁')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!activo),
        new ButtonBuilder()
            .setCustomId('cripta:hub_apostar:todos')
            .setLabel('Apostar')
            .setEmoji('🎰')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!activo),
        new ButtonBuilder()
            .setCustomId('cripta:hub_duelo:todos')
            .setLabel('Duelo PvP')
            .setEmoji('⚔️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!activo)
    );

    // Fila 2: Perfil y Utilidades
    const fila2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('cripta:hub_perfil:todos')
            .setLabel('Mi Perfil / Huesos')
            .setEmoji('👤')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('cripta:hub_ayuda:todos')
            .setLabel('¿Cómo Jugar?')
            .setEmoji('❓')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('cripta:hub_notis:todos')
            .setLabel('Alertas de Eventos')
            .setEmoji('🔔')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [fila1, fila2] };
}

// ── Cargar Canales Configurados al Iniciar ──
async function cargarCanalesCripta(client) {
    _client = client;
    try {
        const configs = await ConfigEvento.find({ canalCriptaId: { $ne: null } });
        for (const c of configs) {
            canalesCriptaCache.set(c.guildId, {
                canalId: c.canalCriptaId,
                mensajeId: c.mensajeCriptaId,
            });
            actualizarPanelCripta(client, c.guildId).catch(() => {});
        }
        console.log(`🏰 Canales dedicados de La Cripta cargados: ${canalesCriptaCache.size}`);
    } catch (e) {
        console.error('Error cargando canales de La Cripta:', e?.message || e);
    }
}

function esCanalCriptaDedicado(guildId, canalId) {
    const config = canalesCriptaCache.get(guildId);
    return Boolean(config && config.canalId === canalId);
}

// ── Configurar o Cambiar el Canal Fijo de La Cripta ──
async function configurarCanalCripta(guildId, canalId, client) {
    _client = client;
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return null;
    const canal = guild.channels.cache.get(canalId) || await guild.channels.fetch(canalId).catch(() => null);
    if (!canal) return null;

    const payload = await construirPanelCripta(guildId);
    const mensajeMaestro = await canal.send(payload);

    await ConfigEvento.findOneAndUpdate(
        { guildId },
        { $set: { canalCriptaId: canalId, mensajeCriptaId: mensajeMaestro.id } },
        { upsert: true, new: true }
    );

    canalesCriptaCache.set(guildId, {
        canalId,
        mensajeId: mensajeMaestro.id,
    });

    return mensajeMaestro;
}

// ── Actualizar Panel Maestro y Limpiar Mensajes Residuales ──
async function actualizarPanelCripta(client, guildId) {
    const cl = client || _client;
    if (!cl) return;

    let config = canalesCriptaCache.get(guildId);
    if (!config || !config.canalId) {
        const dbConf = await ConfigEvento.findOne({ guildId, canalCriptaId: { $ne: null } });
        if (dbConf) {
            config = { canalId: dbConf.canalCriptaId, mensajeId: dbConf.mensajeCriptaId };
            canalesCriptaCache.set(guildId, config);
        }
    }
    if (!config || !config.canalId) return;

    try {
        const guild = cl.guilds.cache.get(guildId) || await cl.guilds.fetch(guildId).catch(() => null);
        if (!guild) return;
        const canal = guild.channels.cache.get(config.canalId) || await guild.channels.fetch(config.canalId).catch(() => null);
        if (!canal) return;

        const payload = await construirPanelCripta(guildId);

        // 1. Limpieza de mensajes de texto en el canal para mantenerlo impecable
        try {
            const recientes = await canal.messages.fetch({ limit: 15 }).catch(() => null);
            if (recientes) {
                const sobrantes = recientes.filter(m => m.id !== config.mensajeId);
                if (sobrantes.size > 0) {
                    await canal.bulkDelete(sobrantes).catch(() => {});
                }
            }
        } catch {}

        // 2. Editar el mensaje maestro existente o crear uno nuevo
        if (config.mensajeId) {
            const mensaje = await canal.messages.fetch(config.mensajeId).catch(() => null);
            if (mensaje) {
                return await mensaje.edit(payload).catch(() => {});
            }
        }

        const nuevo = await canal.send(payload).catch(() => null);
        if (nuevo) {
            config.mensajeId = nuevo.id;
            await ConfigEvento.findOneAndUpdate({ guildId }, { $set: { mensajeCriptaId: nuevo.id } });
        }
    } catch (e) {
        console.error('Error actualizando panel maestro de La Cripta:', e?.message || e);
    }
}

// ── Solicitar Actualización Debounceada en Tiempo Real ──
function solicitarActualizacionCripta(guildId) {
    if (debouncesActualizacion.has(guildId)) {
        clearTimeout(debouncesActualizacion.get(guildId));
    }

    const t = setTimeout(() => {
        debouncesActualizacion.delete(guildId);
        actualizarPanelCripta(_client, guildId).catch(() => {});
    }, 800);

    debouncesActualizacion.set(guildId, t);
}

// Actualización en segundo plano cada 30s para garantizar constante sincronización en vivo
setInterval(() => {
    if (!_client) return;
    for (const guildId of canalesCriptaCache.keys()) {
        actualizarPanelCripta(_client, guildId).catch(() => {});
    }
}, 30000);

module.exports = {
    setClientCripta,
    construirPanelCripta,
    cargarCanalesCripta,
    esCanalCriptaDedicado,
    configurarCanalCripta,
    actualizarPanelCripta,
    solicitarActualizacionCripta,
};

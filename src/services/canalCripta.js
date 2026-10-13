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
const mensajesProtegidosCripta = new Set(); // mensajeId -> booleano para nunca borrarlos en bulkDelete

function protegerMensajeCripta(mensajeId) {
    if (mensajeId) mensajesProtegidosCripta.add(mensajeId);
}

function desprotegerMensajeCripta(mensajeId) {
    if (mensajeId) mensajesProtegidosCripta.delete(mensajeId);
}

let _client = null;

function setClientCripta(client) {
    _client = client;
}

// ── Constructor del Panel Maestro con Ranking en Vivo ──
async function construirPanelCripta(guildId) {
    const config = await obtenerConfig(guildId);
    const activo = eventoActivo(config);
    const multiplicador = multiplicadorActual(config);

    let topUsuarios = [];
    if (config.modoTest) {
        // En modo mantenimiento, el ranking muestra EXCLUSIVAMENTE a los Testers y Administradores autorizados
        const idsTesters = new Set();
        if (config.testersIds && Array.isArray(config.testersIds)) {
            config.testersIds.forEach((id) => idsTesters.add(id));
        }
        if (config.usuariosAdminIds && Array.isArray(config.usuariosAdminIds)) {
            config.usuariosAdminIds.forEach((id) => idsTesters.add(id));
        }
        const { SUPER_ADMINS } = require('./evento');
        SUPER_ADMINS.forEach((id) => idsTesters.add(id));

        try {
            const guild = _client?.guilds?.cache?.get(guildId);
            if (guild) {
                if (config.rolTesterId) {
                    const rol = guild.roles.cache.get(config.rolTesterId);
                    if (rol) rol.members.forEach((m) => idsTesters.add(m.id));
                }
                if (config.rolesAdminIds && Array.isArray(config.rolesAdminIds)) {
                    config.rolesAdminIds.forEach((rId) => {
                        const rol = guild.roles.cache.get(rId);
                        if (rol) rol.members.forEach((m) => idsTesters.add(m.id));
                    });
                }
            }
        } catch {}

        if (idsTesters.size > 0) {
            topUsuarios = await Usuario.find({ guildId, userId: { $in: Array.from(idsTesters) } })
                .sort({ huesos: -1, updatedAt: 1 })
                .limit(10)
                .lean();
        }
    } else {
        topUsuarios = await Usuario.find({ guildId })
            .sort({ huesos: -1, updatedAt: 1 })
            .limit(10)
            .lean();
    }

    const totalCazadores = await Usuario.countDocuments({ guildId });
    const maxHuesos = topUsuarios.length > 0 ? topUsuarios[0].huesos : 1;

    let desc = '> *Bienvenido a la Cripta. Reúne huesos cazando, en duelos, apostando y chateando para conquistar el podio.*\n\n';

    if (config.modoTest) {
        desc += '### 🛠️ Tabla de Clasificación (Top 10) • EN MANTENIMIENTO\n';
        desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        desc += '⚙️ *La Cripta se encuentra en pausa técnica por mantenimiento.*\n';
        desc += '🧪 **Ranking de Pruebas (Testers y Moderación):**\n\n';

        if (topUsuarios.length === 0) {
            desc += '> ⚠️ *No hay ningún tester participando en este momento...*\n';
            desc += '> _El ranking de pruebas se mostrará cuando un tester interactúe en el cementerio._\n';
        } else {
            topUsuarios.forEach((u, i) => {
                const medalla = MEDALLAS[i] || `#${i + 1}`;
                const racha = u.rachaDiaria > 0 ? ` • 🔥 \`${u.rachaDiaria}d\`` : '';
                desc += `${medalla} 🧪 <@${u.userId}> — **${formatoNum(u.huesos)}** 🦴${racha}\n`;
            });
        }
        desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    } else {
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
    }

    // Estado del Evento
    desc += '### ⚙️ Información de Temporada\n';
    if (!activo) {
        desc += '🔴 **La Cripta ha cerrado sus puertas por esta temporada.**\n';
    } else if (config.modoTest) {
        desc += '🛠️ **Estado:** En Mantenimiento (Modo Pruebas)\n';
        desc += '⏳ *Fase de pruebas técnicas. Al reanudar el evento, todos continuarán con sus huesos oficiales.* 🦴\n';
    } else {
        desc += `🟢 **Estado:** Evento Activo\n`;
        desc += `⏳ **Cierre:** ${tiempoRelativo(config.fechaCierre.getTime())}\n`;
        if (multiplicador > 1) {
            desc += `⚡ **Bonus Activo:** ¡Ganancias multiplicadas **x${multiplicador}**!\n`;
        }
    }
    desc += `👥 **Total de cazadores:** \`${formatoNum(totalCazadores)}\`\n\n`;
    desc += '👇 *Interactúa con los botones de abajo para jugar, cazar huesos o ver tu perfil sin escribir comandos:*';

    const embed = basePremium(`${EMOJIS.calabaza || '🎃'} La Cripta de los Huesos • Centro de Mando`, desc, COLORES.naranja);
    embed.setFooter({ text: '⚡ Ranking en tiempo real • 🎃 La Cripta de los Huesos' });

    // En mantenimiento, los botones permanecen habilitados para que los testers y administradores
    // puedan probar las funciones (los usuarios normales reciben un aviso efímero al interactuar)
    const interactuable = activo;

    // Fila 1: Acciones Principales
    const fila1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('cripta:hub_cazar:todos')
            .setLabel('Cazar')
            .setEmoji('🏹')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!interactuable),
        new ButtonBuilder()
            .setCustomId('cripta:hub_diario:todos')
            .setLabel('Reclamar Diario')
            .setEmoji('🎁')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!interactuable),
        new ButtonBuilder()
            .setCustomId('cripta:hub_apostar:todos')
            .setLabel('Apostar')
            .setEmoji('🎰')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!interactuable),
        new ButtonBuilder()
            .setCustomId('cripta:hub_duelo:todos')
            .setLabel('Duelo PvP')
            .setEmoji('⚔️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!interactuable)
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

    // Proteger canal para que nadie de @everyone pueda escribir ni reaccionar
    await protegerCanalSoloLectura(canal, client);

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

        await protegerCanalSoloLectura(canal, cl);
        const payload = await construirPanelCripta(guildId);

        // 1. Limpieza de mensajes de texto en el canal para mantenerlo impecable
        try {
            const recientes = await canal.messages.fetch({ limit: 25 }).catch(() => null);
            if (recientes) {
                const RondaGrupal = require('../models/RondaGrupal');
                const rondasVivas = await RondaGrupal.find({
                    canalId: canal.id,
                    estado: 'activa',
                }).select('mensajeId').lean().catch(() => []);
                const idsRondasDb = new Set(rondasVivas.map(r => r.mensajeId).filter(Boolean));

                const sobrantes = recientes.filter(m => {
                    if (m.id === config.mensajeId) return false;
                    if (mensajesProtegidosCripta.has(m.id)) return false;
                    if (idsRondasDb.has(m.id)) return false;
                    return true;
                });
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

// ── Solicitar Actualización en Tiempo Real con Throttle Inteligente ──
// Protege contra inanición (starvation) por spam de chat y evita exceder los Rate Limits de Discord.
const estadosActualizacion = new Map(); // guildId -> { timer, ultimaActualizacion, pendiente }
const INTERVALO_MINIMO_ACTUALIZACION_MS = 3500; // Máximo 1 actualización cada 3.5 segundos

function solicitarActualizacionCripta(guildId) {
    const ahora = Date.now();
    let estado = estadosActualizacion.get(guildId);
    if (!estado) {
        estado = { timer: null, ultimaActualizacion: 0, pendiente: false };
        estadosActualizacion.set(guildId, estado);
    }

    const tiempoDesdeUltima = ahora - estado.ultimaActualizacion;

    // Si ya pasó el intervalo mínimo y no hay timer en espera, actualizar de inmediato
    if (tiempoDesdeUltima >= INTERVALO_MINIMO_ACTUALIZACION_MS && !estado.timer) {
        estado.ultimaActualizacion = ahora;
        estado.pendiente = false;
        actualizarPanelCripta(_client, guildId).catch(() => {});
        return;
    }

    // Si está dentro de la ventana de enfriamiento, marcar pendiente y esperar el tiempo restante
    estado.pendiente = true;
    if (!estado.timer) {
        const espera = Math.max(800, INTERVALO_MINIMO_ACTUALIZACION_MS - tiempoDesdeUltima);
        estado.timer = setTimeout(() => {
            estado.timer = null;
            estado.ultimaActualizacion = Date.now();
            if (estado.pendiente) {
                estado.pendiente = false;
                actualizarPanelCripta(_client, guildId).catch(() => {});
            }
        }, espera);
    }
}

// Actualización en segundo plano cada 30s para garantizar constante sincronización en vivo
setInterval(() => {
    if (!_client) return;
    for (const guildId of canalesCriptaCache.keys()) {
        actualizarPanelCripta(_client, guildId).catch(() => {});
    }
}, 30000);


/**
 * Modifica los permissionOverwrites del canal para que @everyone no pueda enviar mensajes ni reaccionar.
 */
async function protegerCanalSoloLectura(canal, client) {
    if (!canal || !canal.guild || !canal.permissionOverwrites) return;
    try {
        const guild = canal.guild;
        const everyone = guild.roles.everyone;
        const cl = client || _client;
        const botId = cl?.user?.id;
        const botMember = guild.members.me || (botId ? await guild.members.fetch(botId).catch(() => null) : null);

        // 1. Denegar permisos de envío de mensajes y reacciones a @everyone
        await canal.permissionOverwrites.edit(everyone, {
            [PermissionFlagsBits.SendMessages]: false,
            [PermissionFlagsBits.SendMessagesInThreads]: false,
            [PermissionFlagsBits.CreatePublicThreads]: false,
            [PermissionFlagsBits.CreatePrivateThreads]: false,
            [PermissionFlagsBits.AddReactions]: false,
        }).catch((err) => {
            console.warn(`⚠️ No se pudo denegar SendMessages a @everyone en #${canal.name}:`, err?.message);
        });

        // 2. Conceder permisos explícitos al bot para enviar mensajes, enlaces y adjuntos
        if (botMember) {
            await canal.permissionOverwrites.edit(botMember, {
                [PermissionFlagsBits.ViewChannel]: true,
                [PermissionFlagsBits.SendMessages]: true,
                [PermissionFlagsBits.EmbedLinks]: true,
                [PermissionFlagsBits.AttachFiles]: true,
                [PermissionFlagsBits.ReadMessageHistory]: true,
            }).catch((err) => {
                console.warn(`⚠️ No se pudo asignar permisos al bot en #${canal.name}:`, err?.message);
            });
        }
    } catch (err) {
        console.error(`⚠️ Error al proteger canal solo lectura #${canal?.name || 'desconocido'}:`, err?.message || err);
    }
}

/**
 * Recorre todas las configuraciones y asegura la protección de solo lectura en los canales fijos del servidor.
 */
async function sincronizarPermisosCanalesFijos(client) {
    const cl = client || _client;
    if (!cl) return;
    try {
        const configs = await ConfigEvento.find({});
        for (const conf of configs) {
            const guild = cl.guilds.cache.get(conf.guildId) || await cl.guilds.fetch(conf.guildId).catch(() => null);
            if (!guild) continue;

            const canalesFijos = [
                conf.canalCriptaId,
                conf.canalLogsPublicosId,
                conf.canalLogsId,
                conf.canalCumpleanosId,
                conf.canalAdminPanelId,
            ].filter(Boolean);

            for (const canalId of canalesFijos) {
                const canal = guild.channels.cache.get(canalId) || await guild.channels.fetch(canalId).catch(() => null);
                if (canal && canal.isTextBased()) {
                    await protegerCanalSoloLectura(canal, cl);
                }
            }
        }
    } catch (err) {
        console.error('⚠️ Error al sincronizar permisos de canales fijos:', err?.message || err);
    }
}

module.exports = {
    setClientCripta,
    construirPanelCripta,
    cargarCanalesCripta,
    esCanalCriptaDedicado,
    configurarCanalCripta,
    actualizarPanelCripta,
    solicitarActualizacionCripta,
    protegerCanalSoloLectura,
    sincronizarPermisosCanalesFijos,
    protegerMensajeCripta,
    desprotegerMensajeCripta,
};

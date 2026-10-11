// src/services/cumpleanos.js
// Sistema dinámico de cumpleaños con panel permanente de los 10 más cercanos,
// auto-actualización en tiempo real y felicitaciones automáticas diarias.
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const Cumpleanos = require('../models/Cumpleanos');
const ConfigEvento = require('../models/ConfigEvento');
const { basePremium, COLORES } = require('../utils/embeds');

const MESES_NOMBRES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const MEDALLAS = ['👑', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

const canalesCumpleanosCache = new Map(); // guildId -> { canalId, mensajeId }
let _client = null;

function setClientCumpleanos(client) {
    _client = client;
}

/**
 * Calcula con precisión los días que faltan para el próximo cumpleaños
 */
function calcularProximidad(dia, mes) {
    const ahora = new Date();
    const hoyInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    
    let proxFecha = new Date(ahora.getFullYear(), mes - 1, dia);
    // Si la fecha en este año ya pasó (antes de hoyInicio), el próximo cumpleaños es el año que viene
    if (proxFecha < hoyInicio) {
        proxFecha = new Date(ahora.getFullYear() + 1, mes - 1, dia);
    }

    const diffMs = proxFecha.getTime() - hoyInicio.getTime();
    const diasFaltantes = Math.round(diffMs / (1000 * 60 * 60 * 24));

    return {
        diasFaltantes,
        proxFecha,
        esHoy: diasFaltantes === 0,
        esManana: diasFaltantes === 1,
    };
}

/**
 * Obtiene los 10 cumpleaños más cercanos del servidor ordenados por proximidad
 */
async function obtenerProximosCumpleanos(guildId, limite = 10) {
    const docs = await Cumpleanos.find({ guildId }).select('userId dia mes anio').lean();
    if (!docs || docs.length === 0) return [];

    const conProximidad = docs.map((doc) => {
        const prox = calcularProximidad(doc.dia, doc.mes);
        return {
            ...doc,
            diasFaltantes: prox.diasFaltantes,
            proxFecha: prox.proxFecha,
            esHoy: prox.esHoy,
            esManana: prox.esManana,
        };
    });

    // Ordenar de menor a mayor días faltantes
    conProximidad.sort((a, b) => {
        if (a.diasFaltantes !== b.diasFaltantes) {
            return a.diasFaltantes - b.diasFaltantes;
        }
        return (a.dia - b.dia);
    });

    return conProximidad.slice(0, limite);
}

/**
 * Registra o actualiza el cumpleaños de un usuario
 */
async function registrarCumpleanos(guildId, userId, dia, mes, anio = null) {
    if (dia < 1 || dia > 31) throw new Error('El día debe estar entre 1 y 31.');
    if (mes < 1 || mes > 12) throw new Error('El mes debe estar entre 1 y 12.');

    const maxDias = new Date(anio || 2024, mes, 0).getDate();
    if (dia > maxDias) {
        throw new Error(`El mes de ${MESES_NOMBRES[mes - 1]} solo tiene ${maxDias} días.`);
    }

    const registro = await Cumpleanos.findOneAndUpdate(
        { guildId, userId },
        {
            $set: {
                dia,
                mes,
                anio: anio || null,
            },
        },
        { upsert: true, new: true }
    );

    return registro;
}

/**
 * Elimina el cumpleaños de un usuario
 */
async function borrarCumpleanos(guildId, userId) {
    return await Cumpleanos.findOneAndDelete({ guildId, userId });
}

/**
 * Construye el payload del mensaje permanente de los 10 cumpleaños más cercanos
 */
async function construirPanelCumpleanos(guildId) {
    const proximos = await obtenerProximosCumpleanos(guildId, 10);
    const totalRegistrados = await Cumpleanos.countDocuments({ guildId });

    let desc = '> *¡Celebremos juntos! Este panel muestra en vivo los 10 cumpleaños más cercanos en el servidor. Guarda tu fecha para que la comunidad pueda celebrarte en tu día especial.*\n\n';

    desc += '### 🎈 Próximos Cumpleaños (Top 10 más Cercanos)\n';
    desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    if (proximos.length === 0) {
        desc += '*Aún no hay cumpleaños registrados en el servidor.*\n*¡Sé el primero en guardar tu fecha con el botón de abajo!*\n';
    } else {
        proximos.forEach((c, i) => {
            const medalla = MEDALLAS[i] || `#${i + 1}`;
            const nombreMes = MESES_NOMBRES[c.mes - 1];
            let estado = '';

            if (c.esHoy) {
                estado = ' 🎉 **¡ES HOY!** 🎂';
            } else if (c.esManana) {
                estado = ' ⏰ *(¡Mañana!)*';
            } else {
                estado = ` *(en ${c.diasFaltantes} días)*`;
            }

            const edadStr = c.anio ? ` • 🎂 \`${new Date().getFullYear() - c.anio} años\`` : '';
            desc += `${medalla} <@${c.userId}> — **${c.dia} de ${nombreMes}**${edadStr}${estado}\n`;
        });
    }

    desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    desc += `👥 **Total de cumpleaños registrados:** \`${totalRegistrados}\`\n\n`;
    desc += '👇 *Toca los botones interactivos de abajo para guardar tu fecha o administrar tu perfil:*';

    const embed = basePremium(
        '🎂 Calendario de Cumpleaños • Próximas Celebraciones',
        desc,
        '#9b59b6' // Tono púrpura festivo elegante
    );
    embed.setFooter({ text: '🎈 Sincronización en tiempo real • Sistema de Cumpleaños' });

    // Fila de Botones Interactivos
    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('cumple:modal_abrir:todos')
            .setLabel('Registrar mi Cumpleaños')
            .setEmoji('🎂')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('cumple:borrar:todos')
            .setLabel('Borrar mi Fecha')
            .setEmoji('🗑️')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('cumple:hub_notis:todos')
            .setLabel('Alertas de Cumpleaños')
            .setEmoji('🔔')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [fila] };
}

/**
 * Configura el canal permanente de cumpleaños y envía el mensaje maestro
 */
async function configurarCanalCumpleanos(guildId, canalId, client) {
    _client = client;
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return null;
    const canal = guild.channels.cache.get(canalId) || await guild.channels.fetch(canalId).catch(() => null);
    if (!canal) return null;

    const payload = await construirPanelCumpleanos(guildId);
    const mensajeMaestro = await canal.send(payload);

    await ConfigEvento.findOneAndUpdate(
        { guildId },
        { $set: { canalCumpleanosId: canalId, mensajeCumpleanosId: mensajeMaestro.id } },
        { upsert: true, new: true }
    );

    canalesCumpleanosCache.set(guildId, {
        canalId,
        mensajeId: mensajeMaestro.id,
    });

    return mensajeMaestro;
}

/**
 * Actualiza en vivo el panel de los 10 cumpleaños más cercanos
 */
async function actualizarPanelCumpleanos(client, guildId) {
    const cl = client || _client;
    if (!cl) return;

    let config = canalesCumpleanosCache.get(guildId);
    if (!config || !config.canalId) {
        const dbConf = await ConfigEvento.findOne({ guildId, canalCumpleanosId: { $ne: null } });
        if (dbConf) {
            config = { canalId: dbConf.canalCumpleanosId, mensajeId: dbConf.mensajeCumpleanosId };
            canalesCumpleanosCache.set(guildId, config);
        }
    }
    if (!config || !config.canalId) return;

    try {
        const guild = cl.guilds.cache.get(guildId) || await cl.guilds.fetch(guildId).catch(() => null);
        if (!guild) return;
        const canal = guild.channels.cache.get(config.canalId) || await guild.channels.fetch(config.canalId).catch(() => null);
        if (!canal) return;

        const payload = await construirPanelCumpleanos(guildId);

        // Limpiar mensajes sueltos para mantener el canal impecable
        try {
            const recientes = await canal.messages.fetch({ limit: 15 }).catch(() => null);
            if (recientes) {
                const sobrantes = recientes.filter(m => m.id !== config.mensajeId);
                if (sobrantes.size > 0) {
                    await canal.bulkDelete(sobrantes).catch(() => {});
                }
            }
        } catch {}

        if (config.mensajeId) {
            const mensaje = await canal.messages.fetch(config.mensajeId).catch(() => null);
            if (mensaje) {
                return await mensaje.edit(payload).catch(() => {});
            }
        }

        const nuevo = await canal.send(payload).catch(() => null);
        if (nuevo) {
            config.mensajeId = nuevo.id;
            await ConfigEvento.findOneAndUpdate({ guildId }, { $set: { mensajeCumpleanosId: nuevo.id } });
        }
    } catch (e) {
        console.error('Error actualizando panel de cumpleaños:', e?.message || e);
    }
}

/**
 * Carga los canales configurados al encender el bot
 */
async function cargarCanalesCumpleanos(client) {
    _client = client;
    try {
        const configs = await ConfigEvento.find({ canalCumpleanosId: { $ne: null } });
        for (const c of configs) {
            canalesCumpleanosCache.set(c.guildId, {
                canalId: c.canalCumpleanosId,
                mensajeId: c.mensajeCumpleanosId,
            });
            actualizarPanelCumpleanos(client, c.guildId).catch(() => {});
        }
        console.log(`🎂 Canales dedicados de Cumpleaños cargados: ${canalesCumpleanosCache.size}`);
    } catch (e) {
        console.error('Error cargando canales de cumpleaños:', e?.message || e);
    }
}

/**
 * Chequea automáticamente a diario si hay cumpleañeros hoy, asigna el rol y envía felicitaciones
 */
async function chequearCumpleanosDiarios(client) {
    const cl = client || _client;
    if (!cl) return;

    const ahora = new Date();
    const diaActual = ahora.getDate();
    const mesActual = ahora.getMonth() + 1;
    const anioActual = ahora.getFullYear();

    try {
        const configs = await ConfigEvento.find({ canalCumpleanosId: { $ne: null } });

        for (const conf of configs) {
            const guild = cl.guilds.cache.get(conf.guildId) || await cl.guilds.fetch(conf.guildId).catch(() => null);
            if (!guild) continue;

            // Obtener o crear rol de cumpleañero
            let rolCumple = null;
            if (conf.rolCumpleanosId) {
                rolCumple = guild.roles.cache.get(conf.rolCumpleanosId) || await guild.roles.fetch(conf.rolCumpleanosId).catch(() => null);
            }
            if (!rolCumple) {
                rolCumple = guild.roles.cache.find(r => r.name.toLowerCase().includes('cumpleañer')) || null;
            }
            if (!rolCumple) {
                rolCumple = await guild.roles.create({
                    name: '🎂 Cumpleañero/a',
                    color: '#f39c12',
                    mentionable: true,
                    reason: 'Rol automático para quien cumple años hoy',
                }).catch(() => null);
                if (rolCumple) {
                    conf.rolCumpleanosId = rolCumple.id;
                    await conf.save();
                }
            }

            // Buscar todos los cumpleañeros de hoy en esta guild
            const cumpleanerosHoy = await Cumpleanos.find({
                guildId: conf.guildId,
                dia: diaActual,
                mes: mesActual,
            });

            const idsCumpleanerosHoy = new Set(cumpleanerosHoy.map(c => c.userId));

            // Quitar el rol a quienes NO cumplan años hoy pero aún lo tengan
            if (rolCumple) {
                for (const member of rolCumple.members.values()) {
                    if (!idsCumpleanerosHoy.has(member.id)) {
                        await member.roles.remove(rolCumple.id).catch(() => null);
                    }
                }
            }

            // Felicitar a los que cumplen años hoy y aún no han sido felicitados este año
            for (const c of cumpleanerosHoy) {
                if (c.ultimoFestejadoAnio !== anioActual) {
                    const member = guild.members.cache.get(c.userId) || await guild.members.fetch(c.userId).catch(() => null);
                    
                    if (rolCumple && member) {
                        await member.roles.add(rolCumple.id).catch(() => null);
                    }

                    // Enviar anuncio festivo al canal de cumpleaños
                    const canal = guild.channels.cache.get(conf.canalCumpleanosId) || await guild.channels.fetch(conf.canalCumpleanosId).catch(() => null);
                    if (canal && canal.isTextBased()) {
                        const embedFestejo = basePremium(
                            '🎉 ¡HOY ES UN DÍA ESPECIAL! ¡FELIZ CUMPLEAÑOS! 🎂',
                            `¡Toda la comunidad se reúne para celebrar a lo grande!\n\n` +
                            `🥳 **¡Feliz Cumpleaños <@${c.userId}>!** 🎈🎁\n\n` +
                            `Te deseamos un día lleno de momentos inolvidables, felicidad, éxito y mucha alegría. ¡Que todos tus deseos se cumplan hoy y siempre! ❤️🥂`,
                            '#f1c40f'
                        );

                        const avisoRol = conf.rolNotificacionesCumpleId ? `🔔 <@&${conf.rolNotificacionesCumpleId}> ` : '';
                        await canal.send({
                            content: `${avisoRol}🎊 ¡Atención a todos! ¡Hoy es el cumpleaños de <@${c.userId}>! 🎂🎈`,
                            embeds: [embedFestejo],
                            allowedMentions: { parse: ['roles', 'users'] },
                        }).catch(() => null);
                    }

                    c.ultimoFestejadoAnio = anioActual;
                    await c.save();
                }
            }

            // Actualizar el panel para que muestre la insignia ¡ES HOY!
            await actualizarPanelCumpleanos(cl, conf.guildId);
        }
    } catch (e) {
        console.error('Error en chequeo diario de cumpleaños:', e?.message || e);
    }
}

/**
 * Inicia el servicio en segundo plano de felicitación automática
 */
function iniciarServicioCumpleanos(client) {
    _client = client;
    // Chequeo inicial
    chequearCumpleanosDiarios(client).catch(() => null);

    // Revisión periódica cada 30 minutos
    setInterval(() => {
        chequearCumpleanosDiarios(client).catch(() => null);
    }, 30 * 60 * 1000);
}

// Actualización automática en segundo plano cada 60s para mantener el panel siempre al día
setInterval(() => {
    if (!_client) return;
    for (const guildId of canalesCumpleanosCache.keys()) {
        actualizarPanelCumpleanos(_client, guildId).catch(() => {});
    }
}, 60000);

module.exports = {
    MESES_NOMBRES,
    setClientCumpleanos,
    calcularProximidad,
    obtenerProximosCumpleanos,
    registrarCumpleanos,
    borrarCumpleanos,
    construirPanelCumpleanos,
    configurarCanalCumpleanos,
    actualizarPanelCumpleanos,
    cargarCanalesCumpleanos,
    chequearCumpleanosDiarios,
    iniciarServicioCumpleanos,
};

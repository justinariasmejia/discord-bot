// src/services/eventos-aleatorios.js
// Orquestador de eventos aleatorios de aparición espontánea en el canal de eventos.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const EventoAleatorio = require('../models/EventoAleatorio');
const ConfigEvento = require('../models/ConfigEvento');
const Usuario = require('../models/Usuario');
const { PREGUNTAS_TRIVIA } = require('../data/trivia');
const { ITEMS } = require('../data/items');
const { modificarHuesos, obtenerUsuario } = require('./economia');
const { obtenerConfig, eventoActivo, obtenerCanalApariciones } = require('./evento');
const { base, COLORES, formatoNum, tiempoRelativo } = require('../utils/embeds');

/**
 * Elimina un mensaje de forma robusta probando el objeto mensaje y canal.messages
 */
async function eliminarMensajeSeguro(canal, mensajeId, mensajeObj = null) {
    try {
        if (mensajeObj && mensajeObj.delete) {
            const ok = await mensajeObj.delete().then(() => true).catch(() => false);
            if (ok) return true;
        }
        if (canal && mensajeId) {
            const ok2 = await canal.messages.delete(mensajeId).then(() => true).catch(() => false);
            if (ok2) return true;
            const m = await canal.messages.fetch(mensajeId).catch(() => null);
            if (m) return await m.delete().then(() => true).catch(() => false);
        }
    } catch {
        return false;
    }
    return false;
}

/**
 * Escanea el canal de eventos y elimina mensajes expirados residuales para evitar spam.
 */
async function limpiarMensajesExpiradosCanal(client, guildId) {
    try {
        const config = await obtenerConfig(guildId);
        const canalId = obtenerCanalApariciones(config);
        if (!canalId) return;

        const canal = client.channels.cache.get(canalId) || (await client.channels.fetch(canalId).catch(() => null));
        if (!canal || !canal.isTextBased()) return;

        const mensajes = await canal.messages.fetch({ limit: 40 }).catch(() => null);
        if (!mensajes) return;

        for (const msg of mensajes.values()) {
            if (msg.author.id !== client.user.id) continue;
            const titulo = msg.embeds?.[0]?.title || '';
            const desc = msg.embeds?.[0]?.description || '';
            if (
                titulo.includes('Tiempo Agotado') ||
                titulo.includes('desvanecido') ||
                titulo.includes('RESUELTA CON ÉXITO') ||
                titulo.includes('CAPTURADO') ||
                desc.includes('Nadie respondió correctamente') ||
                desc.includes('se desvaneció') ||
                desc.includes('sepultados por la niebla')
            ) {
                await msg.delete().catch(() => null);
            }
        }
    } catch (err) {
        console.error('⚠️ Error limpiando mensajes expirados del canal:', err?.message || err);
    }
}

// ── 1. FANTASMA FUGAZ ──
async function aparecerFantasma(guildId, client, esForzado = false) {
    const config = await obtenerConfig(guildId);
    const canalId = obtenerCanalApariciones(config);
    if (!eventoActivo(config) || (!esForzado && config.modoTest) || !canalId) return null;

    const canal = client.channels.cache.get(canalId) ||
        (await client.channels.fetch(canalId).catch(() => null));
    if (!canal || !canal.isTextBased()) return null;

    const premio = Math.floor(Math.random() * 101) + 50; // 50 a 150 huesos
    const expiraEn = new Date(Date.now() + 60 * 1000); // 60 segundos

    const embed = base(
        '👻 ¡UN FANTASMA FUGAZ HA APARECIDO!',
        'Un espectro luminiscente sobrevuela el cementerio dejando un rastro de huesos fosforescentes.\n\n' +
        `💰 Recompensa: **+${formatoNum(premio)}** huesos 🦴\n` +
        `⏱️ Desaparecerá ${tiempoRelativo(expiraEn.getTime())}. ¡El primero en capturarlo se queda con el botín!`,
        COLORES.morado
    );

    const docEvento = await EventoAleatorio.create({
        guildId,
        canalId: canal.id,
        mensajeId: 'pendiente',
        tipo: 'fantasma',
        datos: { premio },
        expiraEn,
    });

    const boton = new ButtonBuilder()
        .setCustomId(`evento:fantasma:todos:${docEvento._id}`)
        .setLabel('¡Capturar Fantasma!')
        .setEmoji('👻')
        .setStyle(ButtonStyle.Success);

    const fila = new ActionRowBuilder().addComponents(boton);
    const avisoNoti = config.rolNotificacionesEventoId ? `🔔 <@&${config.rolNotificacionesEventoId}> ¡Un fantasma ha aparecido en el cementerio!` : undefined;
    const mensaje = await canal.send({
        content: avisoNoti,
        embeds: [embed],
        components: [fila],
        allowedMentions: { parse: ['roles'] },
    }).catch(() => null);
    if (!mensaje) return null;

    docEvento.mensajeId = mensaje.id;
    await docEvento.save();

    // Temporizador de expiración visual si nadie lo reclama
    setTimeout(async () => {
        const ev = await EventoAleatorio.findById(docEvento._id);
        if (ev && !ev.reclamado) {
            ev.reclamado = true;
            await ev.save();
            const embedExpirado = base(
                '💨 El Fantasma se ha desvanecido',
                'Nadie fue lo suficientemente rápido y el espectro se perdió entre las sombras de la noche.\n\n_Este mensaje desaparecerá en breve._',
                COLORES.negro
            );
            await mensaje.edit({ embeds: [embedExpirado], components: [] }).catch(() => null);
            setTimeout(async () => {
                await eliminarMensajeSeguro(canal, mensaje.id, mensaje);
            }, 8000);
        }
    }, 60 * 1000);

    return docEvento;
}

// ── 2. TRIVIA DEL TERROR ──
async function lanzarTrivia(guildId, client, esForzado = false) {
    const config = await obtenerConfig(guildId);
    const canalId = obtenerCanalApariciones(config);
    if (!eventoActivo(config) || (!esForzado && config.modoTest) || !canalId) return null;

    const canal = client.channels.cache.get(canalId) ||
        (await client.channels.fetch(canalId).catch(() => null));
    if (!canal || !canal.isTextBased()) return null;

    const triviaItem = PREGUNTAS_TRIVIA[Math.floor(Math.random() * PREGUNTAS_TRIVIA.length)];
    const premio = Math.floor(Math.random() * 76) + 175; // 175 a 250 huesos
    const expiraEn = new Date(Date.now() + 90 * 1000); // 90 segundos

    const letras = ['A', 'B', 'C', 'D'];
    let desc = `📜 **${triviaItem.pregunta}**\n\n`;
    triviaItem.opciones.forEach((opc, idx) => {
        desc += `**[${letras[idx]}]** ${opc}\n`;
    });
    desc += `\n💰 Recompensa al primer acierto: **+${premio}** huesos 🦴\n` +
        `⏱️ Tiempo límite: ${tiempoRelativo(expiraEn.getTime())}`;

    const embed = base('🎃 TRIVIA DEL TERROR', desc, COLORES.naranja);

    const docEvento = await EventoAleatorio.create({
        guildId,
        canalId: canal.id,
        mensajeId: 'pendiente',
        tipo: 'trivia',
        datos: {
            preguntaId: triviaItem.id,
            correcta: triviaItem.correcta,
            explicacion: triviaItem.explicacion,
            premio,
        },
        expiraEn,
    });

    const botones = triviaItem.opciones.map((opc, idx) =>
        new ButtonBuilder()
            .setCustomId(`evento:trivia:todos:${docEvento._id}:${idx}`)
            .setLabel(letras[idx])
            .setStyle(ButtonStyle.Primary)
    );

    const fila = new ActionRowBuilder().addComponents(botones);
    const avisoNoti = config.rolNotificacionesEventoId ? `🔔 <@&${config.rolNotificacionesEventoId}> ¡Nueva Trivia del Terror disponible! Botín: **+${premio}** huesos 🦴.` : undefined;
    const mensaje = await canal.send({
        content: avisoNoti,
        embeds: [embed],
        components: [fila],
        allowedMentions: { parse: ['roles'] },
    }).catch(() => null);
    if (!mensaje) return null;

    docEvento.mensajeId = mensaje.id;
    await docEvento.save();

    setTimeout(async () => {
        const ev = await EventoAleatorio.findById(docEvento._id);
        if (ev && !ev.reclamado) {
            ev.reclamado = true;
            await ev.save();
            const embedExpirado = base(
                '⏳ Tiempo Agotado en la Trivia',
                `Nadie respondió correctamente a tiempo.\n\n` +
                `✅ **Respuesta correcta:** [${letras[triviaItem.correcta]}] ${triviaItem.opciones[triviaItem.correcta]}\n` +
                `📖 _${triviaItem.explicacion}_\n\n` +
                `_Este mensaje desaparecerá en breve._`,
                COLORES.negro
            );
            await mensaje.edit({ embeds: [embedExpirado], components: [] }).catch(() => null);
            setTimeout(async () => {
                await eliminarMensajeSeguro(canal, mensaje.id, mensaje);
            }, 8000);
        }
    }, 90 * 1000);

    return docEvento;
}

// ── 3. APARICIÓN DE HUESOS (Antiguo Cofre Libre) ──
async function aparecerHuesos(guildId, client, esForzado = false) {
    const config = await obtenerConfig(guildId);
    const canalId = obtenerCanalApariciones(config);
    if (!eventoActivo(config) || (!esForzado && config.modoTest) || !canalId) return null;

    const canal = client.channels.cache.get(canalId) ||
        (await client.channels.fetch(canalId).catch(() => null));
    if (!canal || !canal.isTextBased()) return null;

    const premioHuesos = Math.floor(Math.random() * 201) + 150; // 150 a 350 huesos
    const expiraEn = new Date(Date.now() + 90 * 1000); // 90 segundos

    const embed = base(
        '🎃 ¡UN MONTÓN DE HUESOS HA APARECIDO!',
        'La niebla se arremolina y revela una pila de huesos antiguos y relucientes sobre las lápidas.\n\n' +
        `💰 Botín a recolectar: **+${formatoNum(premioHuesos)}** huesos 🦴\n` +
        `⏱️ Se desvanecerá ${tiempoRelativo(expiraEn.getTime())}. ¡El primero en recogerlos se queda con todo!`,
        COLORES.naranja
    );

    const docEvento = await EventoAleatorio.create({
        guildId,
        canalId: canal.id,
        mensajeId: 'pendiente',
        tipo: 'huesos',
        datos: { premioHuesos },
        expiraEn,
    });

    const boton = new ButtonBuilder()
        .setCustomId(`evento:huesos:todos:${docEvento._id}`)
        .setLabel('¡Recoger Huesos!')
        .setEmoji('🦴')
        .setStyle(ButtonStyle.Success);

    const fila = new ActionRowBuilder().addComponents(boton);
    const avisoNoti = config.rolNotificacionesEventoId ? `🔔 <@&${config.rolNotificacionesEventoId}> ¡Un botín de huesos ha aparecido!` : undefined;
    const mensaje = await canal.send({
        content: avisoNoti,
        embeds: [embed],
        components: [fila],
        allowedMentions: { parse: ['roles'] },
    }).catch(() => null);
    if (!mensaje) return null;

    docEvento.mensajeId = mensaje.id;
    await docEvento.save();

    setTimeout(async () => {
        const ev = await EventoAleatorio.findById(docEvento._id);
        if (ev && !ev.reclamado) {
            ev.reclamado = true;
            await ev.save();
            const embedExpirado = base(
                '🥀 Los Huesos se han desvanecido',
                'Nadie fue lo suficientemente rápido y los huesos fueron sepultados por la niebla nocturna.\n\n_Este mensaje desaparecerá en breve._',
                COLORES.negro
            );
            await mensaje.edit({ embeds: [embedExpirado], components: [] }).catch(() => null);
            setTimeout(async () => {
                await eliminarMensajeSeguro(canal, mensaje.id, mensaje);
            }, 8000);
        }
    }, 90 * 1000);

    return docEvento;
}

// ── 4. ACTIVAR MULTIPLICADOR GLOBAL (ECLIPSE) ──
async function activarMultiplicadorGlobal(guildId, client, minutos = 30, factor = 2) {
    const config = await obtenerConfig(guildId);
    if (!eventoActivo(config)) return { ok: false, motivo: 'evento_cerrado' };

    const expira = new Date(Date.now() + minutos * 60 * 1000);
    config.multiplicador = factor;
    config.multiplicadorExpira = expira;
    await config.save();

    const canalId = obtenerCanalApariciones(config);
    if (canalId) {
        const canal = client.channels.cache.get(canalId) ||
            (await client.channels.fetch(canalId).catch(() => null));
        if (canal && canal.isTextBased()) {
            const embed = base(
                '🌕 ¡ECLIPSE ESPECTRAL — NOCHE DE BRUJAS!',
                `Una luna carmesí se alza sobre el cielo de la Cripta.\n\n` +
                `✨ **¡Todas las recompensas de cacería y diarios se multiplican por x${factor}!**\n` +
                `⏳ El eclipse durará **${minutos} minutos** (finaliza ${tiempoRelativo(expira.getTime())}).`,
                COLORES.rojo
            );
            const avisoNoti = config.rolNotificacionesEventoId ? `🔔 <@&${config.rolNotificacionesEventoId}> ¡Ha comenzado un Eclipse Espectral!` : undefined;
            canal.send({
                content: avisoNoti,
                embeds: [embed],
                allowedMentions: { parse: ['roles'] },
            }).catch(() => null);
        }
    }

    return { ok: true, factor, expira };
}

// ── 5. APARICIÓN DE OOGIE BOOGIE (El Estafador de la Cripta) ──
async function aparecerOogieBoogie(guildId, client, esForzado = false) {
    const configGlobal = require('../data/config');
    const oogieCfg = configGlobal.OOGIE_BOOGIE;
    if (!oogieCfg?.HABILITADO) return null;

    const confEvento = await obtenerConfig(guildId);
    const canalId = obtenerCanalApariciones(confEvento);
    if (!eventoActivo(confEvento) || (!esForzado && confEvento.modoTest) || !canalId) return null;

    const canal = client.channels.cache.get(canalId) ||
        (await client.channels.fetch(canalId).catch(() => null));
    if (!canal || !canal.isTextBased()) return null;

    // Buscar a los cazadores más ricos del servidor
    const topCandidatos = await Usuario.find({ guildId, huesos: { $gt: 20 } })
        .sort({ huesos: -1 })
        .limit(oogieCfg.TOP_CANDIDATOS || 10)
        .lean();

    if (!topCandidatos || topCandidatos.length === 0) return null;

    const totalHuesosTop = topCandidatos.reduce((sum, u) => sum + u.huesos, 0);
    if (totalHuesosTop <= 0) return null;

    // Selección ponderada por riqueza (mientras más huesos, mayor probabilidad matemática)
    const numVictimas = Math.min(oogieCfg.MAX_VICTIMAS || 2, topCandidatos.length);
    const victimasSeleccionadas = [];
    const pool = [...topCandidatos];

    for (let i = 0; i < numVictimas && pool.length > 0; i++) {
        const pesoTotalActual = pool.reduce((s, u) => s + u.huesos, 0);
        let rand = Math.random() * pesoTotalActual;
        let elegidoIndex = 0;

        for (let j = 0; j < pool.length; j++) {
            rand -= pool[j].huesos;
            if (rand <= 0) {
                elegidoIndex = j;
                break;
            }
        }

        const elegido = pool.splice(elegidoIndex, 1)[0];
        const apuesta = Math.max(10, Math.floor(elegido.huesos * (oogieCfg.PORCENTAJE_APUESTA || 0.18)));
        victimasSeleccionadas.push({
            userId: elegido.userId,
            huesos: elegido.huesos,
            apuesta,
            estado: 'pendiente', // 'pendiente', 'aceptado', 'huido', 'ignorado'
            resultado: null,
        });
    }

    if (victimasSeleccionadas.length === 0) return null;

    const expiraEn = new Date(Date.now() + (oogieCfg.TIEMPO_RESPUESTA_MS || 90000));
    const porcentajePct = Math.round((oogieCfg.PORCENTAJE_APUESTA || 0.18) * 100);

    let desc = 'El siniestro saco de arpillera repleto de bichos emerge de las sombras con sus dados trucados.\n' +
        'Sus ojos incandescentes miran con desprecio a las mayores fortunas del cementerio:\n\n' +
        '🎯 **Víctimas señaladas por el Rey del Miedo:**\n';

    for (const v of victimasSeleccionadas) {
        desc += `• <@${v.userId}> (**${formatoNum(v.huesos)}** 🦴) — 🎲 Apuesta forzada (${porcentajePct}%): **${formatoNum(v.apuesta)}** huesos\n`;
    }

    desc += '\n*"¡¡Jujajuajuajua!! ¿Creían que podían acaparar todos los huesos de MI cementerio sin pagarle tributo al Rey de Halloween? ' +
        '¡O juegan a mis dados... o mis bichos devorarán sus riquezas!"*\n\n' +
        `⏱️ **Tienen ${Math.round((oogieCfg.TIEMPO_RESPUESTA_MS || 90000) / 1000)} segundos** para responder.\n` +
        `⚠️ **Huir** cuesta 8% de tu fortuna + 30m de silencio. **Ignorarlo** cuesta 12% + 45m de silencio.`;

    const embed = base(
        '🎲 ¡OOGIE BOOGIE HA SALIDO DE LAS SOMBRAS!',
        desc,
        COLORES.rojo
    );

    if (oogieCfg.GIF_APARICION_URL) {
        embed.setImage(oogieCfg.GIF_APARICION_URL);
    }

    const docEvento = await EventoAleatorio.create({
        guildId,
        canalId: canal.id,
        mensajeId: 'pendiente',
        tipo: 'oogie_boogie',
        datos: {
            victimas: victimasSeleccionadas,
            respondidos: 0,
            totalVictimas: victimasSeleccionadas.length,
        },
        expiraEn,
    });

    const btnAceptar = new ButtonBuilder()
        .setCustomId(`evento:oogie:todos:${docEvento._id}:aceptar`)
        .setLabel('Aceptar el Desafío 🎲')
        .setStyle(ButtonStyle.Danger);

    const btnHuir = new ButtonBuilder()
        .setCustomId(`evento:oogie:todos:${docEvento._id}:huir`)
        .setLabel('Huir Cobardemente 🏃')
        .setStyle(ButtonStyle.Secondary);

    const fila = new ActionRowBuilder().addComponents(btnAceptar, btnHuir);

    const menciones = victimasSeleccionadas.map(v => `<@${v.userId}>`).join(' ');
    const avisoNoti = `🎲 **¡ATENCIÓN!** ${menciones} ¡Oogie Boogie los ha desafiado en el cementerio!`;

    const mensaje = await canal.send({
        content: avisoNoti,
        embeds: [embed],
        components: [fila],
    }).catch(() => null);

    if (!mensaje) return null;

    docEvento.mensajeId = mensaje.id;
    await docEvento.save();

    // Timer para castigar a quienes ignoraron a Oogie Boogie
    setTimeout(async () => {
        try {
            const ev = await EventoAleatorio.findById(docEvento._id);
            if (!ev || ev.reclamado) return;

            let huboIgnorados = false;
            const ignoradosList = [];

            for (const v of ev.datos.victimas) {
                if (v.estado === 'pendiente') {
                    v.estado = 'ignorado';
                    huboIgnorados = true;

                    // Penalización por ignorar: 12% de todo su patrimonio actual
                    const uActual = await Usuario.findOne({ userId: v.userId, guildId });
                    if (uActual && uActual.huesos > 0) {
                        const penalizacion = Math.max(10, Math.floor(uActual.huesos * (oogieCfg.PENALIZACION_IGNORAR_PCT || 0.12)));
                        await modificarHuesos(v.userId, guildId, -penalizacion, 'oogie_ignorado', 'Penalización por ignorar a Oogie Boogie');

                        const silencioHasta = new Date(Date.now() + (oogieCfg.SILENCIO_IGNORAR_MS || 45 * 60 * 1000));
                        uActual.silencioApuestasHasta = silencioHasta;
                        await uActual.save();

                        ignoradosList.push({ userId: v.userId, penalizacion });
                    }
                }
            }

            ev.reclamado = true;
            ev.markModified('datos');
            await ev.save();

            const { solicitarActualizacionCripta } = require('./canalCripta');
            solicitarActualizacionCripta(guildId);

            if (huboIgnorados) {
                let textoIgnorados = 'El tiempo expiró y los siguientes cazadores no se atrevieron a responder:\n\n';
                for (const ig of ignoradosList) {
                    textoIgnorados += `• <@${ig.userId}> perdió **-${formatoNum(ig.penalizacion)}** huesos y quedó silenciado de apuestas y duelos por 45 minutos.\n`;
                }
                textoIgnorados += '\n*"¡¡Jajaja!! ¡Nadie ignora a Oogie Boogie sin pagar el tributo!"*\n\n_Este mensaje desaparecerá en breve._';

                const embedExpirado = base(
                    '⏳ Tiempo Agotado — La Ira de Oogie Boogie',
                    textoIgnorados,
                    COLORES.negro
                );

                await mensaje.edit({ embeds: [embedExpirado], components: [] }).catch(() => null);
            } else {
                await mensaje.edit({ components: [] }).catch(() => null);
            }

            setTimeout(async () => {
                await eliminarMensajeSeguro(canal, mensaje.id, mensaje);
            }, 15000);
        } catch (err) {
            console.error('⚠️ Error al resolver timeout de Oogie Boogie:', err);
        }
    }, oogieCfg.TIEMPO_RESPUESTA_MS || 90000);

    return docEvento;
}

// ── 6. DISPARADOR MANUAL / FORZADO (Admin) ──
async function forzarEvento(guildId, client, tipoEvento) {
    if (tipoEvento === 'fantasma') return aparecerFantasma(guildId, client, true);
    if (tipoEvento === 'trivia') return lanzarTrivia(guildId, client, true);
    if (tipoEvento === 'cofre' || tipoEvento === 'huesos') return aparecerHuesos(guildId, client, true);
    if (tipoEvento === 'eclipse_2x') return activarMultiplicadorGlobal(guildId, client, 30, 2);
    if (tipoEvento === 'oogie' || tipoEvento === 'oogie_boogie') return aparecerOogieBoogie(guildId, client, true);
    return null;
}

// ── 7. SERVICIO EN SEGUNDO PLANO (Scheduler) ──
const cooldownOogiePorGuild = new Map(); // guildId -> timestamp última aparición de Oogie

function iniciarServicioEventosAleatorios(client) {
    const INTERVALO_MS = 10 * 60 * 1000;

    setInterval(async () => {
        try {
            for (const guild of client.guilds.cache.values()) {
                const config = await ConfigEvento.findOne({ guildId: guild.id });
                if (!config || !eventoActivo(config) || config.modoTest) continue;
                const canalId = obtenerCanalApariciones(config);
                if (!canalId) continue;

                const oogieCfg = require('../data/config').OOGIE_BOOGIE;
                const ultimoOogie = cooldownOogiePorGuild.get(guild.id) || 0;
                const ahora = Date.now();
                const cdOogieMs = oogieCfg?.COOLDOWN_GLOBAL_MS || 45 * 60 * 1000;

                // Evaluar aparición de Oogie Boogie si está en cooldown apto y supera la probabilidad del 15%
                if (oogieCfg?.HABILITADO && ahora - ultimoOogie >= cdOogieMs && Math.random() < (oogieCfg.PROBABILIDAD_CICLO || 0.15)) {
                    cooldownOogiePorGuild.set(guild.id, ahora);
                    await forzarEvento(guild.id, client, 'oogie_boogie');
                    continue;
                }

                // 85% de probabilidad de que ocurra un evento regular en este ciclo
                if (Math.random() < 0.85) {
                    const tipos = ['trivia', 'trivia', 'fantasma', 'huesos'];
                    const elegido = tipos[Math.floor(Math.random() * tipos.length)];
                    await forzarEvento(guild.id, client, elegido);
                }
            }
        } catch (err) {
            console.error('⚠️ Error en ciclo de eventos aleatorios:', err);
        }
    }, INTERVALO_MS);

    console.log('🎃 Servicio de Eventos Aleatorios iniciado (intervalo: 10m, Oogie Boogie habilitado).');
}

module.exports = {
    aparecerFantasma,
    lanzarTrivia,
    aparecerHuesos,
    aparecerCofre: aparecerHuesos,
    aparecerOogieBoogie,
    activarMultiplicadorGlobal,
    forzarEvento,
    iniciarServicioEventosAleatorios,
    limpiarMensajesExpiradosCanal,
    eliminarMensajeSeguro,
};

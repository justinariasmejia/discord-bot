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
async function aparecerFantasma(guildId, client) {
    const config = await obtenerConfig(guildId);
    const canalId = obtenerCanalApariciones(config);
    if (!eventoActivo(config) || config.modoTest || !canalId) return null;

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
async function lanzarTrivia(guildId, client) {
    const config = await obtenerConfig(guildId);
    const canalId = obtenerCanalApariciones(config);
    if (!eventoActivo(config) || config.modoTest || !canalId) return null;

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
async function aparecerHuesos(guildId, client) {
    const config = await obtenerConfig(guildId);
    const canalId = obtenerCanalApariciones(config);
    if (!eventoActivo(config) || config.modoTest || !canalId) return null;

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

// ── 5. DISPARADOR MANUAL / FORZADO (Admin) ──
async function forzarEvento(guildId, client, tipoEvento) {
    if (tipoEvento === 'fantasma') return aparecerFantasma(guildId, client);
    if (tipoEvento === 'trivia') return lanzarTrivia(guildId, client);
    if (tipoEvento === 'cofre' || tipoEvento === 'huesos') return aparecerHuesos(guildId, client);
    if (tipoEvento === 'eclipse_2x') return activarMultiplicadorGlobal(guildId, client, 30, 2);
    return null;
}

// ── 6. SERVICIO EN SEGUNDO PLANO (Scheduler) ──
function iniciarServicioEventosAleatorios(client) {
    // Revisa cada 10 minutos para mantener el servidor dinámico y con trivias frecuentes
    const INTERVALO_MS = 10 * 60 * 1000;

    setInterval(async () => {
        try {
            for (const guild of client.guilds.cache.values()) {
                const config = await ConfigEvento.findOne({ guildId: guild.id });
                // En mantenimiento/modoTest no se lanzan eventos aleatorios automáticos
                if (!config || !eventoActivo(config) || config.modoTest) continue;
                const canalId = obtenerCanalApariciones(config);
                if (!canalId) continue;

                // 85% de probabilidad de que ocurra un evento en este ciclo
                if (Math.random() < 0.85) {
                    // 50% de probabilidad para Trivia del Terror para máxima participación
                    const tipos = ['trivia', 'trivia', 'fantasma', 'huesos'];
                    const elegido = tipos[Math.floor(Math.random() * tipos.length)];
                    await forzarEvento(guild.id, client, elegido);
                }
            }
        } catch (err) {
            console.error('⚠️ Error en ciclo de eventos aleatorios:', err);
        }
    }, INTERVALO_MS);

    console.log('🎃 Servicio de Eventos Aleatorios iniciado (intervalo: 10m, trivias priorizadas).');
}

module.exports = {
    aparecerFantasma,
    lanzarTrivia,
    aparecerHuesos,
    aparecerCofre: aparecerHuesos,
    activarMultiplicadorGlobal,
    forzarEvento,
    iniciarServicioEventosAleatorios,
    limpiarMensajesExpiradosCanal,
    eliminarMensajeSeguro,
};

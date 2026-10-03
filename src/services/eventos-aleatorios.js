// src/services/eventos-aleatorios.js
// Orquestador de eventos aleatorios de aparición espontánea en el canal de eventos.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const EventoAleatorio = require('../models/EventoAleatorio');
const ConfigEvento = require('../models/ConfigEvento');
const Usuario = require('../models/Usuario');
const { PREGUNTAS_TRIVIA } = require('../data/trivia');
const { ITEMS } = require('../data/items');
const { modificarHuesos, obtenerUsuario } = require('./economia');
const { obtenerConfig, eventoActivo } = require('./evento');
const { base, COLORES, formatoNum, tiempoRelativo } = require('../utils/embeds');

// ── 1. FANTASMA FUGAZ ──
async function aparecerFantasma(guildId, client) {
    const config = await obtenerConfig(guildId);
    if (!eventoActivo(config) || !config.canalEventosId) return null;

    const canal = client.channels.cache.get(config.canalEventosId) ||
        (await client.channels.fetch(config.canalEventosId).catch(() => null));
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
    const mensaje = await canal.send({ embeds: [embed], components: [fila] }).catch(() => null);
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
                'Nadie fue lo suficientemente rápido y el espectro se perdió entre las sombras de la noche.',
                COLORES.negro
            );
            mensaje.edit({ embeds: [embedExpirado], components: [] }).catch(() => null);
        }
    }, 60 * 1000);

    return docEvento;
}

// ── 2. TRIVIA DEL TERROR ──
async function lanzarTrivia(guildId, client) {
    const config = await obtenerConfig(guildId);
    if (!eventoActivo(config) || !config.canalEventosId) return null;

    const canal = client.channels.cache.get(config.canalEventosId) ||
        (await client.channels.fetch(config.canalEventosId).catch(() => null));
    if (!canal || !canal.isTextBased()) return null;

    const triviaItem = PREGUNTAS_TRIVIA[Math.floor(Math.random() * PREGUNTAS_TRIVIA.length)];
    const premio = 100;
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
    const mensaje = await canal.send({ embeds: [embed], components: [fila] }).catch(() => null);
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
                `📖 _${triviaItem.explicacion}_`,
                COLORES.negro
            );
            mensaje.edit({ embeds: [embedExpirado], components: [] }).catch(() => null);
        }
    }, 90 * 1000);

    return docEvento;
}

// ── 3. COFRE MALDITO ──
async function aparecerCofre(guildId, client) {
    const config = await obtenerConfig(guildId);
    if (!eventoActivo(config) || !config.canalEventosId) return null;

    const canal = client.channels.cache.get(config.canalEventosId) ||
        (await client.channels.fetch(config.canalEventosId).catch(() => null));
    if (!canal || !canal.isTextBased()) return null;

    const premioHuesos = Math.floor(Math.random() * 501) + 300; // 300 a 800 huesos
    const expiraEn = new Date(Date.now() + 120 * 1000); // 2 minutos

    // Ítem sorpresa adicional
    const itemsPosibles = ['pocion_suerte', 'doble_o_nada', 'linterna', 'amuleto'];
    const itemExtraId = itemsPosibles[Math.floor(Math.random() * itemsPosibles.length)];
    const itemExtra = ITEMS[itemExtraId];

    const embed = base(
        '🗝️ ¡UN COFRE MALDITO HA SURGIDO DE LA TIERRA!',
        'Las raíces secas se abren revelando un arcón de roble negro sellado con cadenas espectrales.\n\n' +
        '⚠️ **Requisito:** Debes portar una **Llave del Cofre** 🗝️ en tu inventario para forzar la cerradura.\n\n' +
        `💰 Contenido estimado: **+${formatoNum(premioHuesos)}** huesos 🦴 y un artefacto místico.\n` +
        `⏱️ El cofre se desmoronará ${tiempoRelativo(expiraEn.getTime())}.`,
        COLORES.morado
    );

    const docEvento = await EventoAleatorio.create({
        guildId,
        canalId: canal.id,
        mensajeId: 'pendiente',
        tipo: 'cofre',
        datos: { premioHuesos, itemExtraId },
        expiraEn,
    });

    const boton = new ButtonBuilder()
        .setCustomId(`evento:cofre:todos:${docEvento._id}`)
        .setLabel('Usar Llave y Abrir Cofre')
        .setEmoji('🗝️')
        .setStyle(ButtonStyle.Success);

    const fila = new ActionRowBuilder().addComponents(boton);
    const mensaje = await canal.send({ embeds: [embed], components: [fila] }).catch(() => null);
    if (!mensaje) return null;

    docEvento.mensajeId = mensaje.id;
    await docEvento.save();

    setTimeout(async () => {
        const ev = await EventoAleatorio.findById(docEvento._id);
        if (ev && !ev.reclamado) {
            ev.reclamado = true;
            await ev.save();
            const embedExpirado = base(
                '🥀 El Cofre se ha hundido',
                'Ningún cazador con la llave adecuada se presentó y el arcón fue tragado por la tierra profanada.',
                COLORES.negro
            );
            mensaje.edit({ embeds: [embedExpirado], components: [] }).catch(() => null);
        }
    }, 120 * 1000);

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

    if (config.canalEventosId) {
        const canal = client.channels.cache.get(config.canalEventosId) ||
            (await client.channels.fetch(config.canalEventosId).catch(() => null));
        if (canal && canal.isTextBased()) {
            const embed = base(
                '🌕 ¡ECLIPSE ESPECTRAL — NOCHE DE BRUJAS!',
                `Una luna carmesí se alza sobre el cielo de la Cripta.\n\n` +
                `✨ **¡Todas las recompensas de cacería y diarios se multiplican por x${factor}!**\n` +
                `⏳ El eclipse durará **${minutos} minutos** (finaliza ${tiempoRelativo(expira.getTime())}).`,
                COLORES.rojo
            );
            canal.send({ embeds: [embed] }).catch(() => null);
        }
    }

    return { ok: true, factor, expira };
}

// ── 5. DISPARADOR MANUAL / FORZADO (Admin) ──
async function forzarEvento(guildId, client, tipoEvento) {
    if (tipoEvento === 'fantasma') return aparecerFantasma(guildId, client);
    if (tipoEvento === 'trivia') return lanzarTrivia(guildId, client);
    if (tipoEvento === 'cofre') return aparecerCofre(guildId, client);
    if (tipoEvento === 'eclipse_2x') return activarMultiplicadorGlobal(guildId, client, 30, 2);
    return null;
}

// ── 6. SERVICIO EN SEGUNDO PLANO (Scheduler) ──
function iniciarServicioEventosAleatorios(client) {
    // Revisa cada 25 minutos si lanza un evento espontáneo en los servidores
    const INTERVALO_MS = 25 * 60 * 1000;

    setInterval(async () => {
        try {
            for (const guild of client.guilds.cache.values()) {
                const config = await ConfigEvento.findOne({ guildId: guild.id });
                if (!config || !eventoActivo(config) || !config.canalEventosId) continue;

                // 60% de probabilidad de que ocurra un evento en este ciclo
                if (Math.random() < 0.60) {
                    const tipos = ['fantasma', 'trivia', 'cofre'];
                    const elegido = tipos[Math.floor(Math.random() * tipos.length)];
                    await forzarEvento(guild.id, client, elegido);
                }
            }
        } catch (err) {
            console.error('⚠️ Error en ciclo de eventos aleatorios:', err);
        }
    }, INTERVALO_MS);

    console.log('🎃 Servicio de Eventos Aleatorios iniciado (intervalo: 25m).');
}

module.exports = {
    aparecerFantasma,
    lanzarTrivia,
    aparecerCofre,
    activarMultiplicadorGlobal,
    forzarEvento,
    iniciarServicioEventosAleatorios,
};

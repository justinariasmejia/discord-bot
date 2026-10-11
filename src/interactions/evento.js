// src/interactions/evento.js
// Manejador central de interacciones de botones de eventos comunitarios aleatorios.
// Formato customId: evento:<accion>:todos:<eventoId>:<extra>
const { MessageFlags } = require('discord.js');
const EventoAleatorio = require('../models/EventoAleatorio');
const Usuario = require('../models/Usuario');
const { modificarHuesos, obtenerUsuario } = require('../services/economia');
const { basePremium, COLORES, formatoNum } = require('../utils/embeds');
const { logEvento } = require('../services/logger');
const { solicitarActualizacionCripta } = require('../services/canalCripta');

const TIEMPO_VISIBILIDAD_MENSAJE_MS = 15000; // El mensaje del ganador permanece 15s en el chat antes de borrarse y pasar al log público

/**
 * Elimina de manera garantizada el mensaje del evento tras el retardo de 15 segundos.
 * Prueba múltiples métodos: interaction.deleteReply(), canal.messages.delete() y message.delete().
 */
function programarBorradoEvento(client, canalId, mensajeId, interaction = null) {
    setTimeout(async () => {
        try {
            // Intento 1: A través de la interacción (deleteReply elimina el mensaje original del botón)
            if (interaction && interaction.deleteReply) {
                const ok = await interaction.deleteReply().then(() => true).catch(() => false);
                if (ok) {
                    console.log(`🗑️ Mensaje de evento ${mensajeId} eliminado vía interaction.deleteReply() tras 15s.`);
                    return;
                }
            }

            // Intento 2: A través del canal de Discord por ID de mensaje
            const cl = client || interaction?.client;
            if (cl && canalId && mensajeId) {
                const canal = cl.channels.cache.get(canalId) || await cl.channels.fetch(canalId).catch(() => null);
                if (canal && canal.messages) {
                    const borrado = await canal.messages.delete(mensajeId).then(() => true).catch(async () => {
                        const m = await canal.messages.fetch(mensajeId).catch(() => null);
                        if (m) return await m.delete().then(() => true).catch(() => false);
                        return false;
                    });
                    if (borrado) {
                        console.log(`🗑️ Mensaje de evento ${mensajeId} eliminado vía canal.messages.delete() tras 15s.`);
                        return;
                    }
                }
            }

            // Intento 3: Directamente en interaction.message si aún existe
            if (interaction?.message?.delete) {
                await interaction.message.delete().catch(() => null);
                console.log(`🗑️ Mensaje de evento ${mensajeId} eliminado vía interaction.message.delete() tras 15s.`);
            }
        } catch (err) {
            console.error('⚠️ Error eliminando mensaje de evento tras 15s:', err?.message || err);
        }
    }, TIEMPO_VISIBILIDAD_MENSAJE_MS);
}

async function safeDeferUpdate(interaction) {
    if (!interaction.deferred && !interaction.replied) {
        return interaction.deferUpdate().catch(() => null);
    }
}

async function safeReply(interaction, options) {
    if (interaction.deferred || interaction.replied) {
        return interaction.followUp(options).catch(() => null);
    }
    return interaction.reply(options).catch(() => null);
}

module.exports = {
    prefijo: 'evento',

    async ejecutar(interaction, partes, client) {
        const accion = partes[1];
        const eventoId = partes[3];
        const extra = partes[4];
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const cl = client || interaction.client;

        // Verificación de pausa/mantenimiento
        const { obtenerConfig, eventoActivo } = require('../services/evento');
        const conf = await obtenerConfig(guildId);
        if (!eventoActivo(conf) || conf.modoTest) {
            return safeReply(interaction, {
                content: '🛠️ **Evento en Pausa / Mantenimiento:** La Cripta se encuentra actualmente en pausa técnica. Todos los cazadores tienen **100 huesos** y las actividades comenzarán una vez sea inaugurado oficialmente.',
                flags: MessageFlags.Ephemeral,
            });
        }

        // ── 1. Reclamar Fantasma Fugaz ──
        if (accion === 'fantasma') {
            await safeDeferUpdate(interaction);

            const ev = await EventoAleatorio.findOneAndUpdate(
                {
                    _id: eventoId,
                    reclamado: false,
                    expiraEn: { $gt: new Date() },
                },
                {
                    $set: { reclamado: true, reclamadoPor: userId },
                },
                { new: true }
            );

            if (!ev) {
                return safeReply(interaction, {
                    content: '💨 ¡Demasiado tarde! El fantasma ya fue capturado por otro cazador o se desvaneció.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const premio = ev.datos?.premio || 75;
            await modificarHuesos(userId, guildId, premio, 'evento_fantasma', 'Captura de Fantasma Fugaz');
            const usuario = await obtenerUsuario(userId, guildId);

            // 1. Notificar en logs públicos para registro permanente de transparencia
            logEvento(guildId, '👻 Fantasma Fugaz', `¡Atrapó al fantasma fugaz y reclamó el botín!`, userId, premio).catch(() => null);
            solicitarActualizacionCripta(guildId);

            // 2. Anunciar al ganador en el chat del evento
            const embedGanador = basePremium(
                '👻 ¡FANTASMA CAPTURADO!',
                `🎉 ¡<@${userId}> fue el más veloz de la Cripta y atrapó al espectro fugaz!\n\n` +
                `🦴 **Recompensa obtenida:** **+${formatoNum(premio)}** huesos\n` +
                `💰 **Saldo actual de <@${userId}>:** **${formatoNum(usuario.huesos)}** huesos 🦴\n\n` +
                `⏳ *Este mensaje se limpiará en 15 segundos y quedará registrado en los logs públicos.*`,
                COLORES.verde
            );

            await interaction.editReply({ embeds: [embedGanador], components: [] }).catch(() => null);

            // 3. Dejar el mensaje 15s en el chat y luego borrarlo garantizadamente
            const targetCanalId = ev.canalId || interaction.channelId;
            const targetMsgId = ev.mensajeId || interaction.message?.id;
            programarBorradoEvento(cl, targetCanalId, targetMsgId, interaction);
            return;
        }

        // ── 2. Responder Trivia del Terror (2 intentos por persona) ──
        if (accion === 'trivia') {
            const opcionElegida = parseInt(extra, 10);
            const ev = await EventoAleatorio.findById(eventoId);

            if (!ev || ev.reclamado || ev.expiraEn <= new Date()) {
                return safeReply(interaction, {
                    content: '⏳ Esta pregunta de trivia ya finalizó o fue respondida.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (!ev.datos) ev.datos = {};
            if (!ev.datos.intentos) ev.datos.intentos = {};

            const intentosPrevios = ev.datos.intentos[userId] || 0;

            // Límite de 2 intentos por persona
            if (intentosPrevios >= 2) {
                return safeReply(interaction, {
                    content: '💀 **Intentos agotados:** Ya has utilizado tus **2 intentos** permitidos en esta pregunta. ¡Espera a la siguiente trivia!',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const esCorrecta = opcionElegida === ev.datos.correcta;

            if (!esCorrecta) {
                const nuevosIntentos = intentosPrevios + 1;
                // Actualización atómica en base de datos para prevenir conflictos de concurrencia
                await EventoAleatorio.updateOne(
                    { _id: eventoId },
                    { $set: { [`datos.intentos.${userId}`]: nuevosIntentos } }
                );

                if (nuevosIntentos === 1) {
                    return safeReply(interaction, {
                        content: '❌ **¡Respuesta incorrecta!** Te queda **1 intento más**. ¡Aún estás a tiempo de intentar con otra opción!',
                        flags: MessageFlags.Ephemeral,
                    });
                } else {
                    return safeReply(interaction, {
                        content: '💀 **¡Respuesta incorrecta!** Has fallado tus **2 intentos** en esta pregunta y has quedado descalificado.',
                        flags: MessageFlags.Ephemeral,
                    });
                }
            }

            // Si es correcta, intentar reclamar atómicamente
            await safeDeferUpdate(interaction);

            const actualizado = await EventoAleatorio.findOneAndUpdate(
                {
                    _id: eventoId,
                    reclamado: false,
                    expiraEn: { $gt: new Date() },
                },
                {
                    $set: { reclamado: true, reclamadoPor: userId },
                },
                { new: true }
            );

            if (!actualizado) {
                return safeReply(interaction, {
                    content: '⚡ Otro cazador acertó una fracción de segundo antes que tú.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const premio = ev.datos?.premio || 100;
            await modificarHuesos(userId, guildId, premio, 'evento_trivia', 'Victoria en Trivia del Terror');
            const usuario = await obtenerUsuario(userId, guildId);

            // 1. Notificar en logs públicos para registro permanente
            logEvento(guildId, '🎃 Trivia del Terror', `Respondió correctamente la trivia del terror.`, userId, premio).catch(() => null);
            solicitarActualizacionCripta(guildId);

            // 2. Anunciar al ganador en el chat del evento
            const embedVictoria = basePremium(
                '🏆 ¡TRIVIA RESUELTA CON ÉXITO!',
                `🎉 ¡<@${userId}> fue el más sabio y respondió correctamente primero!\n\n` +
                `📖 **Explicación:** _${ev.datos.explicacion}_\n\n` +
                `🦴 **Recompensa obtenida:** **+${formatoNum(premio)}** huesos\n` +
                `💰 **Saldo actual de <@${userId}>:** **${formatoNum(usuario.huesos)}** huesos 🦴\n\n` +
                `⏳ *Este mensaje se limpiará en 15 segundos y quedará registrado en los logs públicos.*`,
                COLORES.verde
            );

            await interaction.editReply({ embeds: [embedVictoria], components: [] }).catch(() => null);

            // 3. Dejar el mensaje 15s en el chat y luego borrarlo garantizadamente
            const targetCanalId = ev.canalId || interaction.channelId;
            const targetMsgId = ev.mensajeId || interaction.message?.id;
            programarBorradoEvento(cl, targetCanalId, targetMsgId, interaction);
            return;
        }

        // ── 3. Recoger Aparición de Huesos / Cofre Libre ──
        if (accion === 'huesos' || accion === 'cofre') {
            await safeDeferUpdate(interaction);

            const ev = await EventoAleatorio.findOneAndUpdate(
                {
                    _id: eventoId,
                    reclamado: false,
                    expiraEn: { $gt: new Date() },
                },
                {
                    $set: { reclamado: true, reclamadoPor: userId },
                },
                { new: true }
            );

            if (!ev) {
                return safeReply(interaction, {
                    content: '🥀 ¡Demasiado tarde! Los huesos ya fueron recogidos por otro cazador o se desvanecieron.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const premioHuesos = ev.datos?.premioHuesos || ev.datos?.premio || 200;
            await modificarHuesos(userId, guildId, premioHuesos, 'evento_huesos', 'Aparición de Huesos en el Cementerio');
            const usuarioFinal = await obtenerUsuario(userId, guildId);

            // 1. Notificar en logs públicos para registro permanente
            logEvento(guildId, '🦴 Montón de Huesos', `Recogió el montón de huesos del cementerio.`, userId, premioHuesos).catch(() => null);
            solicitarActualizacionCripta(guildId);

            // 2. Anunciar al ganador en el chat del evento
            const embedApertura = basePremium(
                '🦴 ¡HUESOS RECOGIDOS!',
                `🎉 ¡<@${userId}> fue el más veloz en llegar al cementerio y recolectó el botín!\n\n` +
                `✨ **Recompensa obtenida:** **+${formatoNum(premioHuesos)}** huesos 🦴\n` +
                `💰 **Saldo actual de <@${userId}>:** **${formatoNum(usuarioFinal.huesos)}** huesos 🦴\n\n` +
                `⏳ *Este mensaje se limpiará en 15 segundos y quedará registrado en los logs públicos.*`,
                COLORES.verde
            );

            await interaction.editReply({ embeds: [embedApertura], components: [] }).catch(() => null);

            // 3. Dejar el mensaje 15s en el chat y luego borrarlo garantizadamente
            const targetCanalId = ev.canalId || interaction.channelId;
            const targetMsgId = ev.mensajeId || interaction.message?.id;
            programarBorradoEvento(cl, targetCanalId, targetMsgId, interaction);
            return;
        }

        // ── 4. Reclamar Drop Relámpago de Administración ──
        if (accion === 'huesos_drop') {
            await safeDeferUpdate(interaction);
            const premio = parseInt(eventoId, 10) || 250;

            const modificado = await modificarHuesos(userId, guildId, premio, 'drop_admin', 'Drop relámpago de administración');
            logEvento(guildId, '🎁 Drop Relámpago', 'Botín recogido con éxito', userId, premio).catch(() => null);
            solicitarActualizacionCripta(guildId);

            const embedReclamado = basePremium(
                '🎁 ¡BOTÍN DEL DROP RECLAMADO!',
                `🎉 ¡<@${userId}> fue el más rápido de la Cripta y recogió la ofrenda!\n\n` +
                `💰 **Recompensa entregada:** **+${formatoNum(premio)}** huesos 🦴\n` +
                `🦴 **Saldo actual:** **${formatoNum(modificado?.huesos || 0)}** huesos 🦴\n\n` +
                `⏳ *Este mensaje se limpiará en 15 segundos y quedará registrado en los logs públicos.*`,
                COLORES.verde
            );

            await interaction.editReply({ embeds: [embedReclamado], components: [] }).catch(() => null);
            const targetCanalId = interaction.channelId;
            const targetMsgId = interaction.message?.id;
            programarBorradoEvento(cl, targetCanalId, targetMsgId, interaction);
            return;
        }
    },
};

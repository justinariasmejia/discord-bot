// src/interactions/evento.js
// Manejador central de interacciones de botones de eventos comunitarios aleatorios.
// Formato customId:  evento:<accion>:todos:<eventoId>:<extra>
const { MessageFlags } = require('discord.js');
const EventoAleatorio = require('../models/EventoAleatorio');
const Usuario = require('../models/Usuario');
const { modificarHuesos, obtenerUsuario } = require('../services/economia');
const { base, COLORES, formatoNum } = require('../utils/embeds');
const { ITEMS } = require('../data/items');
const { conBloqueo } = require('../utils/locks');

module.exports = {
    prefijo: 'evento',

    async ejecutar(interaction, partes) {
        const accion = partes[1];
        const eventoId = partes[3];
        const extra = partes[4];
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        // ── 1. Reclamar Fantasma Fugaz ──
        if (accion === 'fantasma') {
            await interaction.deferUpdate();

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
                return interaction.followUp({
                    content: '💨 ¡Demasiado tarde! El fantasma ya fue capturado por otro cazador o se desvaneció.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const premio = ev.datos.premio || 75;
            await modificarHuesos(userId, guildId, premio, 'evento_fantasma', 'Captura de Fantasma Fugaz');
            const usuario = await obtenerUsuario(userId, guildId);

            const embedGanador = base(
                '👻 ¡FANTASMA CAPTURADO!',
                `¡<@${userId}> fue el más veloz y atrapó al espectro fugaz!\n\n` +
                `🦴 Recompensa obtenida: **+${formatoNum(premio)}** huesos\n` +
                `💰 Saldo actual de <@${userId}>: **${formatoNum(usuario.huesos)}** huesos.`,
                COLORES.verde
            );

            return interaction.editReply({ embeds: [embedGanador], components: [] });
        }

        // ── 2. Responder Trivia del Terror ──
        if (accion === 'trivia') {
            const opcionElegida = parseInt(extra, 10);
            const ev = await EventoAleatorio.findById(eventoId);

            if (!ev || ev.reclamado || ev.expiraEn <= new Date()) {
                return interaction.reply({
                    content: '⏳ Esta pregunta de trivia ya finalizó o fue respondida.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const esCorrecta = opcionElegida === ev.datos.correcta;

            if (!esCorrecta) {
                return interaction.reply({
                    content: '❌ **¡Respuesta incorrecta!** Un escalofrío recorre tu espina dorsal.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            // Si es correcta, intentar reclamar atómicamente
            await interaction.deferUpdate();

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
                return interaction.followUp({
                    content: '⚡ Otro cazador acertó una fracción de segundo antes que tú.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const premio = ev.datos.premio || 100;
            await modificarHuesos(userId, guildId, premio, 'evento_trivia', 'Victoria en Trivia del Terror');
            const usuario = await obtenerUsuario(userId, guildId);

            const embedVictoria = base(
                '🏆 ¡TRIVIA RESUELTA CON ÉXITO!',
                `¡<@${userId}> fue el primero en responder correctamente!\n\n` +
                `📖 **Explicación:** _${ev.datos.explicacion}_\n\n` +
                `🦴 Recompensa otorgada: **+${formatoNum(premio)}** huesos\n` +
                `💰 Saldo actual de <@${userId}>: **${formatoNum(usuario.huesos)}** huesos.`,
                COLORES.verde
            );

            return interaction.editReply({ embeds: [embedVictoria], components: [] });
        }

        // ── 3. Recoger Aparición de Huesos / Cofre Libre ──
        if (accion === 'huesos' || accion === 'cofre') {
            await interaction.deferUpdate();

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
                return interaction.followUp({
                    content: '🥀 ¡Demasiado tarde! Los huesos ya fueron recogidos por otro cazador o se desvanecieron.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const premioHuesos = ev.datos.premioHuesos || ev.datos.premio || 200;
            await modificarHuesos(userId, guildId, premioHuesos, 'evento_huesos', 'Aparición de Huesos en el Cementerio');
            const usuarioFinal = await obtenerUsuario(userId, guildId);

            const embedApertura = base(
                '🦴 ¡HUESOS RECOGIDOS!',
                `¡<@${userId}> fue el más veloz en llegar al cementerio y recolectó el botín!\n\n` +
                `✨ **Recompensa obtenida:** **+${formatoNum(premioHuesos)}** huesos 🦴\n` +
                `💰 Saldo actual de <@${userId}>: **${formatoNum(usuarioFinal.huesos)}** huesos.`,
                COLORES.verde
            );

            return interaction.editReply({ embeds: [embedApertura], components: [] });
        }
    },
};

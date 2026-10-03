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

        // ── 3. Abrir Cofre Maldito con Llave ──
        if (accion === 'cofre') {
            const ev = await EventoAleatorio.findById(eventoId);
            if (!ev || ev.reclamado || ev.expiraEn <= new Date()) {
                return interaction.reply({
                    content: '🥀 El cofre ya fue abierto por otro cazador o se ha hundido bajo tierra.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            // Verificar si el usuario tiene una llave de cofre en inventario
            const usuario = await obtenerUsuario(userId, guildId);
            const tieneLlave = (usuario.inventario || []).some(
                (inv) => inv.itemId === 'llave_cofre' && inv.cantidad >= 1
            );

            if (!tieneLlave) {
                return interaction.reply({
                    content: '🔒 Las cadenas espectrales están firmemente selladas. Necesitas poseer una **Llave del Cofre** 🗝️ en tu inventario (adquirible en la Tienda) para abrirlo.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            await interaction.deferUpdate();

            // Consumir la llave de forma atómica
            const llaveConsumida = await Usuario.findOneAndUpdate(
                {
                    userId,
                    guildId,
                    inventario: { $elemMatch: { itemId: 'llave_cofre', cantidad: { $gte: 1 } } },
                },
                { $inc: { 'inventario.$.cantidad': -1 } },
                { new: true }
            );

            if (!llaveConsumida) {
                return interaction.followUp({
                    content: '⚠️ No se pudo verificar la llave en tu inventario.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            // Reclamar el cofre
            const cofreReclamado = await EventoAleatorio.findOneAndUpdate(
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

            if (!cofreReclamado) {
                // Reembolsar la llave si alguien más abrió el cofre en el mismo milisegundo
                await Usuario.findOneAndUpdate(
                    { userId, guildId, 'inventario.itemId': 'llave_cofre' },
                    { $inc: { 'inventario.$.cantidad': 1 } }
                );
                return interaction.followUp({
                    content: '💨 Alguien más abrió el cofre un instante antes. Tu llave ha sido devuelta intacta.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const premioHuesos = ev.datos.premioHuesos || 400;
            const itemExtraId = ev.datos.itemExtraId;
            const itemExtra = ITEMS[itemExtraId];

            await modificarHuesos(userId, guildId, premioHuesos, 'evento_cofre', 'Apertura de Cofre Maldito');

            // Añadir el artefacto sorpresa al inventario
            if (itemExtra) {
                const invActualizado = await Usuario.findOneAndUpdate(
                    { userId, guildId, 'inventario.itemId': itemExtraId },
                    { $inc: { 'inventario.$.cantidad': 1 } },
                    { new: true }
                );
                if (!invActualizado) {
                    await Usuario.findOneAndUpdate(
                        { userId, guildId },
                        { $push: { inventario: { itemId: itemExtraId, cantidad: 1 } } }
                    );
                }
            }

            const usuarioFinal = await obtenerUsuario(userId, guildId);

            const embedApertura = base(
                '🗝️ ¡EL COFRE MALDITO HA SIDO FORZADO!',
                `¡<@${userId}> insertó su llave espectral y quebró las cadenas!\n\n` +
                `✨ **Botín Desenterrado:**\n` +
                `• 🦴 **+${formatoNum(premioHuesos)}** huesos\n` +
                (itemExtra ? `• ${itemExtra.emoji} **1x ${itemExtra.nombre}** (añadido a su inventario)\n\n` : '\n') +
                `💰 Saldo actual de <@${userId}>: **${formatoNum(usuarioFinal.huesos)}** huesos.`,
                COLORES.verde
            );

            return interaction.editReply({ embeds: [embedApertura], components: [] });
        }
    },
};

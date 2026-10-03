// src/interactions/duelo.js
// Manejador de botones y modales del sistema de duelos.
const { MessageFlags } = require('discord.js');
const Duelo = require('../models/Duelo');
const {
    crearDuelo,
    filaInvitacionDuelo,
    iniciarMinijuegoDuelo,
    resolverDisparo,
} = require('../services/duelos');
const { modificarHuesos, obtenerUsuario } = require('../services/economia');
const { conBloqueo } = require('../utils/locks');
const { base, COLORES, formatoNum } = require('../utils/embeds');
const config = require('../data/config');

module.exports = {
    prefijo: 'duelo',

    async ejecutar(interaction, partes) {
        const accion = partes[1];
        const duenoId = partes[2];
        const extra = partes[3];

        // ── Creación desde Modal ──
        if (accion === 'modal_crear') {
            const rivalId = extra;
            const montoStr = interaction.fields.getTextInputValue('monto');
            const res = await crearDuelo(interaction.guildId, interaction.channelId, interaction.user.id, rivalId, montoStr);

            if (!res.ok) {
                if (res.motivo === 'monto_invalido') {
                    return interaction.reply({
                        content: `❌ Monto inválido. La apuesta mínima es de **${res.min}** huesos.`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
                if (res.motivo === 'saldo_insuficiente') {
                    return interaction.reply({
                        content: `❌ Saldo insuficiente. Tienes **${formatoNum(res.saldo)}** huesos.`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
                if (res.motivo === 'duelo_en_progreso') {
                    return interaction.reply({
                        content: '❌ Uno de los dos jugadores ya tiene un duelo pendiente o activo.',
                        flags: MessageFlags.Ephemeral,
                    });
                }
                return interaction.reply({
                    content: '❌ No se pudo iniciar el duelo en este momento.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const duelo = res.duelo;
            const embedInvitacion = base(
                '⚔️ ¡DESAFÍO DE DUELO A MUERTE!',
                `¡<@${interaction.user.id}> ha arrojado el guante y reta a <@${rivalId}> a un duelo de honor!\n\n` +
                `🦴 **Apuesta por jugador:** **${formatoNum(duelo.monto)}** huesos\n` +
                `💰 **Pozo total en juego:** **${formatoNum(duelo.monto * 2)}** huesos\n` +
                `⏳ Tienes **60 segundos** para aceptar o declinar el reto.`,
                COLORES.naranja
            );

            const msgPublico = await interaction.channel.send({
                content: `🔔 ¡Atención <@${rivalId}>! Tienes un reto de duelo pendiente.`,
                embeds: [embedInvitacion],
                components: [filaInvitacionDuelo(duelo._id.toString())],
            });

            duelo.mensajeId = msgPublico.id;
            await duelo.save();

            // Temporizador de expiración a los 60s
            setTimeout(async () => {
                const dueloCheck = await Duelo.findOne({ _id: duelo._id, estado: 'pendiente' });
                if (dueloCheck) {
                    dueloCheck.estado = 'expirado';
                    await dueloCheck.save();
                    const embedExpirado = base(
                        '⚔️ Duelo Expirado',
                        `El tiempo de respuesta se agotó. El desafío entre <@${duelo.retadorId}> y <@${duelo.rivalId}> ha quedado en el olvido.`,
                        COLORES.negro
                    );
                    await msgPublico.edit({ embeds: [embedExpirado], components: [filaInvitacionDuelo(duelo._id.toString(), true)] }).catch(() => null);
                }
            }, config.DUELOS.TIMEOUT_ACEPTAR_MS);

            return interaction.reply({
                content: `✅ ¡Desafío enviado a <@${rivalId}>! Que la suerte esté de tu lado.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        // ── Aceptar Duelo ──
        if (accion === 'aceptar') {
            const dueloId = extra;
            const duelo = await Duelo.findOne({ _id: dueloId, estado: 'pendiente' });

            if (!duelo) {
                return interaction.reply({
                    content: '❌ Este duelo ya no está disponible o ya expiró.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (interaction.user.id !== duelo.rivalId) {
                return interaction.reply({
                    content: '🔒 Solo el usuario retado puede aceptar este duelo.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            await interaction.deferUpdate();

            // Bloquear atómicamente a ambos duelistas en orden consistente
            const [u1, u2] = [duelo.retadorId, duelo.rivalId].sort();
            const bloqueoGlobal = await conBloqueo(`${duelo.guildId}:${u1}`, async () => {
                return conBloqueo(`${duelo.guildId}:${u2}`, async () => {
                    const retador = await obtenerUsuario(duelo.retadorId, duelo.guildId);
                    const rival = await obtenerUsuario(duelo.rivalId, duelo.guildId);

                    if (retador.huesos < duelo.monto || rival.huesos < duelo.monto) {
                        duelo.estado = 'cancelado';
                        await duelo.save();
                        return { ok: false, motivo: 'fondos_insuficientes' };
                    }

                    // Deducir de ambos
                    const d1 = await modificarHuesos(duelo.retadorId, duelo.guildId, -duelo.monto, 'duelo', 'Apuesta Duelo');
                    if (!d1) return { ok: false, motivo: 'error_deduccion' };

                    const d2 = await modificarHuesos(duelo.rivalId, duelo.guildId, -duelo.monto, 'duelo', 'Apuesta Duelo');
                    if (!d2) {
                        // Reembolsar al retador si falló el rival
                        await modificarHuesos(duelo.retadorId, duelo.guildId, duelo.monto, 'reembolso', 'Reembolso Duelo');
                        return { ok: false, motivo: 'error_deduccion' };
                    }

                    duelo.estado = 'activo';
                    duelo.fondosBloqueados = true;
                    await duelo.save();

                    return { ok: true };
                });
            });

            const resBloqueo = bloqueoGlobal.resultado?.resultado;
            if (!resBloqueo || !resBloqueo.ok) {
                const msg = await interaction.channel.messages.fetch(duelo.mensajeId).catch(() => null);
                if (msg) {
                    const embedCancel = base(
                        '⚔️ Duelo Cancelado',
                        'Uno de los duelistas ya no cuenta con los huesos suficientes para respaldar la apuesta.',
                        COLORES.rojo
                    );
                    await msg.edit({ embeds: [embedCancel], components: [] });
                }
                return;
            }

            // Iniciar la ronda de reacción
            return iniciarMinijuegoDuelo(dueloId, interaction.channel);
        }

        // ── Rechazar o Cancelar Duelo ──
        if (accion === 'rechazar') {
            const dueloId = extra;
            const duelo = await Duelo.findOne({ _id: dueloId, estado: 'pendiente' });

            if (!duelo) {
                return interaction.reply({
                    content: '❌ Este duelo ya no está disponible.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (interaction.user.id !== duelo.rivalId && interaction.user.id !== duelo.retadorId) {
                return interaction.reply({
                    content: '🔒 No participas en este duelo.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            duelo.estado = 'cancelado';
            await duelo.save();

            const autorCancelacion = interaction.user.id === duelo.retadorId ? 'El retador canceló' : 'El rival declinó';
            const embedCancel = base(
                '🏳️ Duelo Declinado',
                `${autorCancelacion} el desafío de honor. La contienda no tendrá lugar.`,
                COLORES.negro
            );

            await interaction.deferUpdate();
            const msg = await interaction.channel.messages.fetch(duelo.mensajeId).catch(() => null);
            if (msg) {
                await msg.edit({ embeds: [embedCancel], components: [] });
            }
            return;
        }

        // ── Botón Señuelo (Tiro en falso) ──
        if (accion === 'senuelo') {
            const dueloId = extra;
            await interaction.deferUpdate();
            return resolverDisparo(dueloId, interaction.user.id, true, interaction.channel);
        }

        // ── Botón Disparar (Válido) ──
        if (accion === 'disparar') {
            const dueloId = extra;
            await interaction.deferUpdate();
            return resolverDisparo(dueloId, interaction.user.id, false, interaction.channel);
        }
    },
};

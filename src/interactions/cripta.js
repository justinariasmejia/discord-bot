// src/interactions/cripta.js
// Manejador central de las interacciones de botones del panel /cripta.
// Formato customId: cripta:<accion>:<duenoId>:<extra>
const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags,
} = require('discord.js');
const { obtenerUsuario, posicionRanking } = require('../services/economia');
const { reclamarDiario } = require('../services/diario');
const { cazar } = require('../services/cazar');
const { obtenerRanking } = require('../services/ranking');
const { iniciarRondaGrupal } = require('../services/ruletaGrupal');
const { comprarItem } = require('../services/tienda');
const { usarItem } = require('../services/inventario');
const { robar } = require('../services/robar');
const { solicitarLimosna } = require('../services/limosna');
const configBalance = require('../data/config');
const { logCaza, logApuesta, logRobo, logCompra } = require('../services/logger');
const { base, COLORES, formatoNum, tiempoRelativo } = require('../utils/embeds');
const {
    panelMenu,
    panelPerfil,
    panelDiario,
    panelCazarAnimacion,
    panelCazar,
    panelRanking,
    panelMenuApuestas,
    panelTienda,
    panelInventario,
    panelRobarMenu,
    panelLimosna,
    filaVolver,
} = require('../utils/paneles');

module.exports = {
    prefijo: 'cripta',

    async ejecutar(interaction, partes) {
        const accion = partes[1];
        const duenoId = partes[2];
        const extra = partes[3];
        const extra2 = partes[4];

        // ── Menú Principal ──
        if (accion === 'menu') {
            await interaction.deferUpdate();
            const usuario = await obtenerUsuario(duenoId, interaction.guildId);
            return interaction.editReply(panelMenu(duenoId, usuario));
        }

        // ── Cazar (Fase 2) ──
        if (accion === 'cazar') {
            await interaction.deferUpdate();
            const res = await cazar(duenoId, interaction.guildId);

            if (!res.ok) {
                // Registrar en logs
            logCaza(interaction.guildId, duenoId, res).catch(() => null);
            return interaction.editReply(panelCazar(duenoId, res));
            }

            await interaction.editReply(panelCazarAnimacion(1));
            await new Promise((resolve) => setTimeout(resolve, configBalance.CAZAR.DELAY_ANIMACION_MS));

            await interaction.editReply(panelCazarAnimacion(2));
            await new Promise((resolve) => setTimeout(resolve, configBalance.CAZAR.DELAY_ANIMACION_MS));

            return interaction.editReply(panelCazar(duenoId, res));
        }

        // ── Ranking (Fase 2) ──
        if (accion === 'ranking') {
            await interaction.deferUpdate();
            const pagina = extra ? parseInt(extra, 10) : 1;
            const datosRanking = await obtenerRanking(interaction.guildId, duenoId, pagina);
            return interaction.editReply(panelRanking(duenoId, datosRanking));
        }

        // ── Panel de Apuestas (Fase 3) ──
        if (accion === 'apostar') {
            await interaction.deferUpdate();
            const usuario = await obtenerUsuario(duenoId, interaction.guildId);
            return interaction.editReply(panelMenuApuestas(duenoId, usuario));
        }

        // ── Selección de Juego de Apuestas ──
        if (accion === 'sel_juego') {
            const juego = interaction.values[0];

            if (juego === 'ruleta_grupal') {
                await interaction.deferUpdate();
                const res = await iniciarRondaGrupal(interaction.channel, interaction.guildId, interaction.user);
                if (!res.ok) {
                    if (res.motivo === 'ya_activa') {
                        const embedError = base('⏳ Ronda en Curso', 'Ya hay una ruleta grupal activa en este canal.', COLORES.morado);
                        return interaction.editReply({ embeds: [embedError], components: [filaVolver(duenoId)] });
                    }
                    if (res.motivo === 'evento_cerrado') {
                        const embedError = base('🕯️ Evento Cerrado', 'La Cripta ya ha cerrado sus puertas.', COLORES.negro);
                        return interaction.editReply({ embeds: [embedError], components: [filaVolver(duenoId)] });
                    }
                }
                const embedIniciada = base(
                    '👥 ¡Ruleta Grupal Iniciada!',
                    'Se ha iniciado una ronda pública de **30 segundos** en este canal.\n' +
                    'Presiona el botón **Unirme / Apostar** en el mensaje del canal para colocar tus huesos.',
                    COLORES.verde
                );
                return interaction.editReply({ embeds: [embedIniciada], components: [filaVolver(duenoId)] });
            }

            if (juego === 'cara_cruz') {
                const modal = new ModalBuilder()
                    .setCustomId(`apuesta:modal:${duenoId}:cara_cruz`)
                    .setTitle('🪙 Cara o Cruz (x2.0)');

                const inputMonto = new TextInputBuilder()
                    .setCustomId('monto')
                    .setLabel('¿Cuántos huesos apuestas?')
                    .setPlaceholder('Mínimo 10 huesos')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const inputEleccion = new TextInputBuilder()
                    .setCustomId('eleccion')
                    .setLabel('¿Cara o Cruz?')
                    .setPlaceholder('Escribe "cara" o "cruz"')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(inputMonto),
                    new ActionRowBuilder().addComponents(inputEleccion)
                );
                return interaction.showModal(modal);
            }

            if (juego === 'dados') {
                const modal = new ModalBuilder()
                    .setCustomId(`apuesta:modal:${duenoId}:dados`)
                    .setTitle('🎲 Dados Malditos');

                const inputMonto = new TextInputBuilder()
                    .setCustomId('monto')
                    .setLabel('¿Cuántos huesos apuestas?')
                    .setPlaceholder('Mínimo 10 huesos')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const inputTier = new TextInputBuilder()
                    .setCustomId('tier')
                    .setLabel('¿A qué le apuestas?')
                    .setPlaceholder('Escribe "bajo" (2-6), "alto" (8-12) o "exacto:7"')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(inputMonto),
                    new ActionRowBuilder().addComponents(inputTier)
                );
                return interaction.showModal(modal);
            }

            if (juego === 'ruleta') {
                const modal = new ModalBuilder()
                    .setCustomId(`apuesta:modal:${duenoId}:ruleta`)
                    .setTitle('🎡 Ruleta de la Calabaza');

                const inputMonto = new TextInputBuilder()
                    .setCustomId('monto')
                    .setLabel('¿Cuántos huesos apuestas?')
                    .setPlaceholder('Mínimo 10 huesos')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const inputColor = new TextInputBuilder()
                    .setCustomId('color')
                    .setLabel('¿Qué color eliges?')
                    .setPlaceholder('Escribe "rojo", "negro" (x2.0) o "verde" (x14.0)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(inputMonto),
                    new ActionRowBuilder().addComponents(inputColor)
                );
                return interaction.showModal(modal);
            }

            if (juego === 'tragamonedas') {
                const modal = new ModalBuilder()
                    .setCustomId(`apuesta:modal:${duenoId}:tragamonedas`)
                    .setTitle('🎰 Tragamonedas de Halloween');

                const inputMonto = new TextInputBuilder()
                    .setCustomId('monto')
                    .setLabel('¿Cuántos huesos apuestas?')
                    .setPlaceholder('Mínimo 10 huesos')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(inputMonto));
                return interaction.showModal(modal);
            }
        }

        // ── Diario (Fase 1) ──
        if (accion === 'diario') {
            await interaction.deferUpdate();
            const res = await reclamarDiario(duenoId, interaction.guildId);
            return interaction.editReply(panelDiario(duenoId, res));
        }

        // ── Perfil (Fase 1) ──
        if (accion === 'perfil') {
            await interaction.deferUpdate();
            const usuario = await obtenerUsuario(duenoId, interaction.guildId);
            const { posicion, total } = await posicionRanking(interaction.guildId, usuario.huesos);
            return interaction.editReply(
                panelPerfil(duenoId, usuario, interaction.user.username, posicion, total)
            );
        }

        // ── Tienda: Ver Bazar (Fase 4) ──
        if (accion === 'tienda') {
            await interaction.deferUpdate();
            const usuario = await obtenerUsuario(duenoId, interaction.guildId);
            return interaction.editReply(panelTienda(duenoId, usuario, extra || null));
        }

        // ── Tienda: Seleccionar Ítem ──
        if (accion === 'sel_tienda') {
            await interaction.deferUpdate();
            const itemElegido = interaction.values[0];
            const usuario = await obtenerUsuario(duenoId, interaction.guildId);
            return interaction.editReply(panelTienda(duenoId, usuario, itemElegido));
        }

        // ── Tienda: Comprar Ítem (x1, x3, x5) ──
        if (accion === 'comprar') {
            await interaction.deferUpdate();
            const itemId = extra;
            const cantidad = parseInt(extra2, 10) || 1;
            const res = await comprarItem(duenoId, interaction.guildId, itemId, cantidad);

            if (!res.ok) {
                let errorTexto = 'No se pudo realizar la compra.';
                if (res.motivo === 'saldo_insuficiente') errorTexto = `No tienes suficientes huesos. Requieres **${formatoNum(res.costo)}** 🦴 pero tienes **${formatoNum(res.saldo)}** 🦴.`;
                if (res.motivo === 'evento_cerrado') errorTexto = 'La Cripta ya ha cerrado sus puertas.';
                if (res.motivo === 'ocupado') errorTexto = 'Procesando tu solicitud anterior. Intenta de nuevo.';
                const embedError = base('❌ Compra Fallida', errorTexto, COLORES.rojo);
                return interaction.followUp({ embeds: [embedError], flags: MessageFlags.Ephemeral });
            }

            const embedExito = base(
                '🛒 ¡Compra Exitosa!',
                `Has adquirido **${res.cantidad}x ${res.item.emoji} ${res.item.nombre}** por **${formatoNum(res.costoTotal)}** huesos 🦴.\n` +
                `Guardado en tu inventario. Saldo restante: **${formatoNum(res.usuario.huesos)}** 🦴.`,
                COLORES.verde
            );
            await interaction.followUp({ embeds: [embedExito], flags: MessageFlags.Ephemeral });

            // Actualizar vista de tienda con nuevo saldo
            const usuarioActualizado = await obtenerUsuario(duenoId, interaction.guildId);
            return interaction.editReply(panelTienda(duenoId, usuarioActualizado, itemId));
        }

        // ── Inventario: Ver Mochila (Fase 4) ──
        if (accion === 'inventario') {
            await interaction.deferUpdate();
            const usuario = await obtenerUsuario(duenoId, interaction.guildId);
            return interaction.editReply(panelInventario(duenoId, usuario, extra || null));
        }

        // ── Inventario: Seleccionar Ítem para Usar ──
        if (accion === 'sel_usar') {
            await interaction.deferUpdate();
            const itemSeleccionado = interaction.values[0];
            const usuario = await obtenerUsuario(duenoId, interaction.guildId);
            return interaction.editReply(panelInventario(duenoId, usuario, itemSeleccionado));
        }

        // ── Inventario: Consumir / Activar Ítem ──
        if (accion === 'usar') {
            await interaction.deferUpdate();
            const itemId = extra;
            const res = await usarItem(duenoId, interaction.guildId, itemId);

            if (!res.ok) {
                let errorTexto = 'No se pudo activar este objeto.';
                if (res.motivo === 'item_pasivo') errorTexto = res.mensaje;
                if (res.motivo === 'no_posee_item') errorTexto = 'Ya no tienes este objeto en tu inventario.';
                if (res.motivo === 'ocupado') errorTexto = 'Procesando tu solicitud anterior. Intenta de nuevo.';
                const embedError = base('⚠️ No se puede usar', errorTexto, COLORES.morado);
                return interaction.followUp({ embeds: [embedError], flags: MessageFlags.Ephemeral });
            }

            const duracionStr = res.item.duracionMs ? tiempoRelativo(Date.now() + res.item.duracionMs) : `${res.item.usos} uso(s)`;
            const embedExito = base(
                '✨ ¡Encantamiento Activado!',
                `Has utilizado **${res.item.emoji} ${res.item.nombre}**.\n` +
                `📜 _${res.item.descripcion}_\n\n` +
                `⏱️ Duración / Efectividad: **${duracionStr}**`,
                COLORES.verde
            );
            await interaction.followUp({ embeds: [embedExito], flags: MessageFlags.Ephemeral });

            const usuarioActualizado = await obtenerUsuario(duenoId, interaction.guildId);
            return interaction.editReply(panelInventario(duenoId, usuarioActualizado));
        }

        // ── Robar: Menú de Asalto (Fase 4) ──
        if (accion === 'robar_menu') {
            await interaction.deferUpdate();
            const usuario = await obtenerUsuario(duenoId, interaction.guildId);
            return interaction.editReply(panelRobarMenu(duenoId, usuario));
        }

        // ── Robar: Ejecución del Asalto a la Víctima ──
        if (accion === 'sel_robar') {
            await interaction.deferUpdate();
            const victimaId = interaction.values[0];

            if (victimaId === duenoId) {
                const embedError = base('🤦 ¿Robarte a ti mismo?', 'No puedes asaltar tus propios bolsillos.', COLORES.morado);
                return interaction.editReply({ embeds: [embedError], components: [filaVolver(duenoId)] });
            }

            const res = await robar(duenoId, victimaId, interaction.guildId, interaction.client);

            if (!res.ok) {
                let titulo = '❌ Robo no efectuado';
                let desc = 'No pudiste llevar a cabo el robo.';
                let col = COLORES.rojo;

                if (res.motivo === 'cooldown') {
                    titulo = '⏳ Debes ocultarte en las sombras';
                    desc = `La guardia y los cazadores sospechan de ti.\nPodrás volver a robar ${tiempoRelativo(res.proximo)}.`;
                    col = COLORES.morado;
                } else if (res.motivo === 'victima_pobre') {
                    titulo = '🥀 Víctima sin fortuna';
                    desc = `<@${victimaId}> tiene menos de **${res.minimo}** huesos. No vale la pena arriesgarse.`;
                    col = COLORES.morado;
                } else if (res.motivo === 'victima_inmune') {
                    titulo = '🧿 ¡Repelido por un Amuleto!';
                    desc = `<@${victimaId}> portaba un **Amuleto de Protección** sagrado.\n` +
                        `El amuleto emitió un destello celestial que te arrojó contra las tumbas.\n` +
                        (res.multa > 0 ? `🩸 Perdiste **${formatoNum(res.multa)}** huesos por la onda expansiva.` : '');
                    col = COLORES.rojo;
                } else if (res.motivo === 'evento_cerrado') {
                    titulo = '🕯️ La Cripta ha cerrado';
                    desc = 'El evento ha finalizado.';
                    col = COLORES.negro;
                } else if (res.motivo === 'victima_bot') {
                    titulo = '🤖 Objetivo Inválido';
                    desc = 'No puedes robar a un bot. Solo puedes asaltar a otros cazadores humanos.';
                    col = COLORES.morado;
                } else if (res.motivo === 'ocupado') {
                    titulo = '⏳ Un momento';
                    desc = 'Se está procesando otra acción entre estos cazadores.';
                    col = COLORES.morado;
                }

                const embed = base(titulo, desc, col);
                return interaction.editReply({ embeds: [embed], components: [filaVolver(duenoId)] });
            }

            if (res.exito) {
                const embedExito = base(
                    '💰 ¡Golpe Maestro!',
                    `Te deslizaste sin hacer ruido detrás de <@${res.victimaId}> y le despojaste de sus pertenencias.\n\n` +
                    `🦴 Has robado: **+${formatoNum(res.monto)}** huesos\n` +
                    `💰 Tu nuevo saldo: **${formatoNum(res.nuevoSaldo)}** huesos.`,
                    COLORES.verde
                );
                return interaction.editReply({ embeds: [embedExito], components: [filaVolver(duenoId)] });
            } else {
                const embedFallo = base(
                    '🚨 ¡DESCUBIERTO!',
                    `Hiciste crujir una rama al acercarte a <@${res.victimaId}>.\n` +
                    `¡Te atraparon con las manos en la masa y la multitud te obligó a pagar una indemnización!\n\n` +
                    `🩸 Multa pagada a la víctima: **-${formatoNum(res.multa)}** huesos\n` +
                    `💰 Tu nuevo saldo: **${formatoNum(res.nuevoSaldo)}** huesos.`,
                    COLORES.rojo
                );
                return interaction.editReply({ embeds: [embedFallo], components: [filaVolver(duenoId)] });
            }
        }

        // ── Limosna del Fantasma (Fase 4) ──
        if (accion === 'limosna') {
            await interaction.deferUpdate();
            const res = await solicitarLimosna(duenoId, interaction.guildId);
            return interaction.editReply(panelLimosna(duenoId, res));
        }
    },
};

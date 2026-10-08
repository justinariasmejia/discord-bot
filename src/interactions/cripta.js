// src/interactions/cripta.js
// Manejador central de las interacciones de botones del panel /cripta (Simplificado).
// Formato customId: cripta:<accion>:<duenoId>:<extra>
const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');
const { obtenerUsuario } = require('../services/economia');
const { posicionRanking } = require('../services/economia');
const { reclamarDiario } = require('../services/diario');
const { cazar } = require('../services/cazar');
const { obtenerRanking } = require('../services/ranking');
const { iniciarRondaGrupal } = require('../services/ruletaGrupal');
const configBalance = require('../data/config');
const { logCaza } = require('../services/logger');
const { base, COLORES } = require('../utils/embeds');
const {
    panelMenu,
    panelPerfil,
    panelDiario,
    panelCazarAnimacion,
    panelCazar,
    panelRanking,
    panelMenuApuestas,
    panelAyuda,
    filaVolver,
} = require('../utils/paneles');

module.exports = {
    prefijo: 'cripta',

    async ejecutar(interaction, partes) {
        const accion = partes[1];
        const duenoId = partes[2];
        const extra = partes[3];

        // ── 1. Menú Principal ──
        if (accion === 'menu') {
            await interaction.deferUpdate();
            const usuario = await obtenerUsuario(duenoId, interaction.guildId);
            return interaction.editReply(panelMenu(duenoId, usuario));
        }

        // ── 2. Cazar ──
        if (accion === 'cazar') {
            await interaction.deferUpdate();
            const res = await cazar(duenoId, interaction.guildId);

            if (!res.ok) {
                logCaza(interaction.guildId, duenoId, res).catch(() => null);
                return interaction.editReply(panelCazar(duenoId, res));
            }

            await interaction.editReply(panelCazarAnimacion(1));
            await new Promise((resolve) => setTimeout(resolve, configBalance.CAZAR?.DELAY_ANIMACION_MS || 1200));

            await interaction.editReply(panelCazarAnimacion(2));
            await new Promise((resolve) => setTimeout(resolve, configBalance.CAZAR?.DELAY_ANIMACION_MS || 1200));

            return interaction.editReply(panelCazar(duenoId, res));
        }

        // ── 3. Ranking ──
        if (accion === 'ranking') {
            await interaction.deferUpdate();
            const pagina = extra ? parseInt(extra, 10) : 1;
            const datosRanking = await obtenerRanking(interaction.guildId, duenoId, pagina);
            return interaction.editReply(panelRanking(duenoId, datosRanking));
        }

        // ── 4. Panel de Apuestas ──
        if (accion === 'apostar') {
            await interaction.deferUpdate();
            const usuario = await obtenerUsuario(duenoId, interaction.guildId);
            return interaction.editReply(panelMenuApuestas(duenoId, usuario));
        }

        // ── 5. Selección de Juego de Apuestas ──
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
                    'Se ha iniciado una ronda comunitaria de **30 segundos** en este canal.\n' +
                    'Presiona el botón **Unirme / Apostar** en el mensaje público del canal para colocar tus huesos.',
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

        // ── 6. Diario ──
        if (accion === 'diario') {
            await interaction.deferUpdate();
            const res = await reclamarDiario(duenoId, interaction.guildId);
            return interaction.editReply(panelDiario(duenoId, res));
        }

        // ── 7. Perfil ──
        if (accion === 'perfil') {
            await interaction.deferUpdate();
            const usuario = await obtenerUsuario(duenoId, interaction.guildId);
            const { posicion, total } = await posicionRanking(interaction.guildId, usuario.huesos);
            return interaction.editReply(
                panelPerfil(duenoId, usuario, interaction.user.username, posicion, total, interaction.user.displayAvatarURL())
            );
        }

        // ── 8. Guía y Ayuda ──
        if (accion === 'ayuda') {
            await interaction.deferUpdate();
            return interaction.editReply(panelAyuda(duenoId));
        }
    },
};

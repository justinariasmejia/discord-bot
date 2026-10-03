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
const configBalance = require('../data/config');
const { base, COLORES, formatoNum } = require('../utils/embeds');
const {
    panelMenu,
    panelPerfil,
    panelDiario,
    panelCazarAnimacion,
    panelCazar,
    panelRanking,
    panelMenuApuestas,
    panelProximamente,
    filaVolver,
} = require('../utils/paneles');

const PROXIMAMENTE = {
    tienda: { nombre: 'Tienda de Objetos y Hechizos', fase: 4 },
    inventario: { nombre: 'Inventario de Artefactos', fase: 4 },
};

module.exports = {
    prefijo: 'cripta',

    async ejecutar(interaction, partes) {
        const accion = partes[1];
        const duenoId = partes[2];
        const extra = partes[3];

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

        // ── Zonas selladas (Fases futuras) ──
        if (PROXIMAMENTE[accion]) {
            await interaction.deferUpdate();
            const { nombre, fase } = PROXIMAMENTE[accion];
            return interaction.editReply(panelProximamente(duenoId, nombre, fase));
        }
    },
};

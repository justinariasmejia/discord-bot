// src/interactions/cripta.js
// Manejador central de las interacciones de botones del panel /cripta (Simplificado).
// Formato customId: cripta:<accion>:<duenoId>:<extra>
const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    UserSelectMenuBuilder,
    MessageFlags,
} = require('discord.js');
const { obtenerUsuario } = require('../services/economia');
const { posicionRanking } = require('../services/economia');
const { reclamarDiario } = require('../services/diario');
const { cazar } = require('../services/cazar');
const { obtenerRanking } = require('../services/ranking');
const { iniciarRondaGrupal } = require('../services/ruletaGrupal');
const configBalance = require('../data/config');
const { logCaza, logDiario } = require('../services/logger');
const { base, COLORES } = require('../utils/embeds');
const {
    panelMenu,
    panelPerfil,
    panelDiario,
    panelCazarAnimacion,
    panelCazar,
    panelRanking,
    panelMenuApuestas,
    panelConsolaTragamonedas,
    panelConsolaCaraCruz,
    panelAyuda,
    filaVolver,
} = require('../utils/paneles');

module.exports = {
    prefijo: 'cripta',

    async ejecutar(interaction, partes) {
        const accion = partes[1];
        const duenoId = partes[2];
        const extra = partes[3];

        const { obtenerConfig } = require('../services/evento');
        const conf = await obtenerConfig(interaction.guildId);
        if (conf.modoTest) {
            const accionesBloqueadas = ['cazar', 'diario', 'apostar', 'duelo', 'sel_juego', 'sel_juego_btn', 'hub_cazar', 'hub_diario', 'hub_apostar', 'hub_duelo', 'hub_sel_duelo'];
            if (accionesBloqueadas.includes(accion)) {
                return interaction.reply({
                    content: '🛠️ **Evento en Pausa / Mantenimiento:** La Cripta se encuentra temporalmente en pausa técnica. Todos los cazadores tienen **100 huesos** y las actividades se habilitarán en cuanto la administración anuncie el inicio oficial.',
                    flags: MessageFlags.Ephemeral,
                });
            }
        }

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

            logCaza(interaction.guildId, duenoId, res).catch(() => null);
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

        // ── 5. Selección de Juego de Apuestas (Botones y Selects) ──
        if (accion === 'sel_juego_btn' || accion === 'sel_juego') {
            const juego = accion === 'sel_juego_btn' ? extra : interaction.values[0];

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
                await interaction.deferUpdate();
                const usuario = await obtenerUsuario(duenoId, interaction.guildId);
                return interaction.editReply(panelConsolaCaraCruz(duenoId, usuario));
            }

            if (juego === 'tragamonedas') {
                await interaction.deferUpdate();
                const usuario = await obtenerUsuario(duenoId, interaction.guildId);
                return interaction.editReply(panelConsolaTragamonedas(duenoId, usuario));
            }
        }

        // ── 6. Diario ──
        if (accion === 'diario') {
            await interaction.deferUpdate();
            const res = await reclamarDiario(duenoId, interaction.guildId);
            if (res.ok) {
                logDiario(interaction.guildId, duenoId, res).catch(() => null);
            }
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

        // ════════════════════════════════════════════════════════════════════
        // ── 9. ACCIONES DEL PANEL FIJO PERMANENTE (Respuestas efímeras) ──
        // ════════════════════════════════════════════════════════════════════

        // 🏹 Cazar desde el panel maestro
        if (accion === 'hub_cazar') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const userId = interaction.user.id;
            const res = await cazar(userId, interaction.guildId);

            if (!res.ok) {
                logCaza(interaction.guildId, userId, res).catch(() => null);
                return interaction.editReply(panelCazar(userId, res));
            }

            await interaction.editReply(panelCazarAnimacion(1));
            await new Promise((resolve) => setTimeout(resolve, configBalance.CAZAR?.DELAY_ANIMACION_MS || 1000));

            await interaction.editReply(panelCazarAnimacion(2));
            await new Promise((resolve) => setTimeout(resolve, configBalance.CAZAR?.DELAY_ANIMACION_MS || 1000));

            logCaza(interaction.guildId, userId, res).catch(() => null);
            return interaction.editReply(panelCazar(userId, res));
        }

        // 🎁 Reclamar Diario desde el panel maestro
        if (accion === 'hub_diario') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const res = await reclamarDiario(interaction.user.id, interaction.guildId);
            if (res.ok) {
                logDiario(interaction.guildId, interaction.user.id, res).catch(() => null);
            }
            return interaction.editReply(panelDiario(interaction.user.id, res));
        }

        // 🎰 Menú de Apuestas desde el panel maestro
        if (accion === 'hub_apostar') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const usuario = await obtenerUsuario(interaction.user.id, interaction.guildId);
            return interaction.editReply(panelMenuApuestas(interaction.user.id, usuario));
        }

        // ⚔️ Duelo PvP: Instrucción clara de comando directo en el chat sin menú desplegable
        if (accion === 'hub_duelo') {
            const embedDuelo = base(
                '⚔️ Duelos PvP por Huesos',
                'Para retar a cualquier cazador a un duelo a muerte por huesos, escribe directamente en cualquier canal de chat:\n\n' +
                '👉 **`/duelos usuario:@cazador monto:<cantidad>`**\n\n' +
                '• Ambos apostarán la misma cantidad de huesos.\n' +
                '• El desafío y el juego ocurrirán en el canal donde lo escribas.\n' +
                '• ¡El primero en disparar gana todo el pozo y queda registrado en los logs!',
                COLORES.rojo
            );

            return interaction.reply({ embeds: [embedDuelo], flags: MessageFlags.Ephemeral });
        }

        // ⚔️ Duelo PvP: Al seleccionar contrincante se abre el modal de apuesta
        if (accion === 'hub_sel_duelo') {
            const rivalId = interaction.values[0];
            if (rivalId === interaction.user.id) {
                return interaction.reply({
                    content: '💀 No puedes retarte en duelo a ti mismo.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const rivalUser = await interaction.client.users.fetch(rivalId).catch(() => null);
            if (rivalUser?.bot) {
                return interaction.reply({
                    content: '🤖 Los autómatas no tienen alma ni huesos para apostar.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(`duelo:modal_crear:${interaction.user.id}:${rivalId}`)
                .setTitle(`⚔️ Duelo vs ${(rivalUser?.username || 'Rival').slice(0, 20)}`);

            const inputMonto = new TextInputBuilder()
                .setCustomId('monto')
                .setLabel('¿Cuántos huesos apuestas?')
                .setPlaceholder('Mínimo 10 huesos')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(6);

            modal.addComponents(new ActionRowBuilder().addComponents(inputMonto));
            return interaction.showModal(modal);
        }

        // 👤 Perfil del cazador desde el panel maestro
        if (accion === 'hub_perfil') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const usuario = await obtenerUsuario(interaction.user.id, interaction.guildId);
            const { posicion, total } = await posicionRanking(interaction.guildId, usuario.huesos);
            return interaction.editReply(
                panelPerfil(interaction.user.id, usuario, interaction.user.username, posicion, total, interaction.user.displayAvatarURL())
            );
        }

        // ❓ Guía de Juego desde el panel maestro
        if (accion === 'hub_ayuda') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            return interaction.editReply(panelAyuda(interaction.user.id));
        }

        // 🔄 Refrescar manualmente el Ranking en vivo
        if (accion === 'hub_refresh') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const { actualizarPanelCripta } = require('../services/canalCripta');
            await actualizarPanelCripta(interaction.client, interaction.guildId);
            return interaction.editReply({
                content: '🔄 ¡Tabla de clasificación en vivo actualizada con éxito!',
            });
        }

        // 🔔 Alternar Rol de Alertas de Eventos de Halloween
        if (accion === 'hub_notis') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const ConfigEvento = require('../models/ConfigEvento');
            let config = await ConfigEvento.findOne({ guildId: interaction.guildId });
            if (!config) {
                config = await ConfigEvento.create({
                    guildId: interaction.guildId,
                    fechaCierre: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                });
            }

            const guild = interaction.guild;
            let rol = null;

            if (config.rolNotificacionesEventoId) {
                rol = guild.roles.cache.get(config.rolNotificacionesEventoId) ||
                    await guild.roles.fetch(config.rolNotificacionesEventoId).catch(() => null);
            }

            if (!rol) {
                rol = guild.roles.cache.find(r => r.name.toLowerCase().includes('alertas de halloween')) || null;
            }

            if (!rol) {
                try {
                    rol = await guild.roles.create({
                        name: '🎃 Alertas de Halloween',
                        color: '#ff7700',
                        mentionable: true,
                        reason: 'Rol de avisos para eventos y trivias de Halloween',
                    });
                } catch (err) {
                    return interaction.editReply({
                        content: '⚠️ No pude crear el rol de alertas automáticamente. Asegúrate de que el bot tenga el permiso **Gestionar Roles**.',
                    });
                }
            }

            if (config.rolNotificacionesEventoId !== rol.id) {
                config.rolNotificacionesEventoId = rol.id;
                await config.save();
            }

            const tieneRol = interaction.member.roles.cache.has(rol.id);

            try {
                if (tieneRol) {
                    await interaction.member.roles.remove(rol.id);
                    return interaction.editReply({
                        content: `🔕 **Alertas Desactivadas**\nSe ha removido tu rol <@&${rol.id}>. Ya no recibirás menciones cuando aparezcan trivias o eventos en el servidor.`,
                    });
                } else {
                    await interaction.member.roles.add(rol.id);
                    return interaction.editReply({
                        content: `🔔 **¡Alertas Activadas con Éxito!**\nSe te ha otorgado el rol <@&${rol.id}>. Recibirás una mención automática cada vez que aparezca un fantasma, trivia o evento especial.`,
                    });
                }
            } catch (errPerm) {
                return interaction.editReply({
                    content: `⚠️ No se pudo modificar el rol: asegúrate de que el rol del bot esté **por encima** del rol <@&${rol.id}> en la lista de roles del servidor.`,
                });
            }
        }
    },
};

// src/interactions/admin.js
// Manejador central de interacciones del panel de administración interactivo y permanente.
const {
    MessageFlags,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const ConfigEvento = require('../models/ConfigEvento');
const Usuario = require('../models/Usuario');
const Transaccion = require('../models/Transaccion');
const { modificarHuesos, obtenerUsuario } = require('../services/economia');
const { forzarEvento } = require('../services/eventos-aleatorios');
const { base, basePremium, COLORES, formatoNum } = require('../utils/embeds');
const { logAdmin, logSorteo } = require('../services/logger');
const { crearBackup } = require('../services/backup');
const { esAdminAsync, esSuperAdmin } = require('../services/evento');
const {
    construirPanelAdmin,
    configurarCanalAdminPanel,
    actualizarPanelAdminPermanente,
    solicitarActualizacionAdminPanel,
} = require('../services/panelAdmin');
const {
    configurarCanalCripta,
    actualizarPanelCripta,
    solicitarActualizacionCripta,
} = require('../services/canalCripta');
const { configurarCanalMusica } = require('../services/canalMusica');

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
    prefijo: 'admin',

    async ejecutar(interaction, partes, client) {
        const accion = partes[1];
        const extra = partes[3];
        const guildId = interaction.guildId;

        // Comprobación de seguridad: Administradores de Discord, dueño o roles/usuarios autorizados
        const autorizado = await esAdminAsync(interaction.member, guildId);
        if (!autorizado) {
            return safeReply(interaction, {
                content: '🔒 No tienes permisos de administración ni un rol autorizado para interactuar con este panel.',
                flags: MessageFlags.Ephemeral,
            });
        }

        // ── 1. Respaldo Manual desde Botón ──
        if (accion === 'panel_backup') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            try {
                const res = await crearBackup(guildId, 'manual_admin');
                await logAdmin(guildId, interaction.user.id, 'Backup Manual DB', `Archivo: \`${res.nombreArchivo}\` (${res.tamanoKb} KB, ${res.totalUsuarios} cazadores)`);
                solicitarActualizacionAdminPanel(guildId);

                const embed = basePremium(
                    '💾 Respaldo de Base de Datos Generado',
                    `Se ha generado un archivo de respaldo íntegro de la base de datos.\n\n` +
                    `• **Archivo:** \`${res.nombreArchivo}\`\n` +
                    `• **Cazadores respaldados:** \`${res.totalUsuarios}\`\n` +
                    `• **Transacciones:** \`${res.totalTransacciones}\`\n` +
                    `• **Tamaño:** \`${res.tamanoKb} KB\`\n` +
                    `• **Fecha:** <t:${Math.floor(res.fecha.getTime() / 1000)}:F>`,
                    COLORES.verde
                );
                return interaction.editReply({ embeds: [embed] });
            } catch (err) {
                return interaction.editReply({ content: `❌ Error al crear respaldo: ${err.message}` });
            }
        }

        // ── 2. Resetear Evento: Confirmación de Seguridad ──
        if (accion === 'panel_reset') {
            const fila = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('admin:confirmar_reset_evento:admin')
                    .setLabel('⚠️ SÍ, RESETEAR TEMPORADA')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('admin:cancelar_reset_evento:admin')
                    .setLabel('Cancelar')
                    .setStyle(ButtonStyle.Secondary)
            );

            const embedAlerta = basePremium(
                '⚠️ ¿RESETEAR LA TEMPORADA DE LA CRIPTA?',
                '**¡ADVERTENCIA DE SEGURIDAD!**\n\n' +
                'Esta acción llevará a cabo las siguientes operaciones:\n' +
                '• 💾 Se creará un **respaldo automático completo** de seguridad antes del reinicio.\n' +
                '• 🦴 Todos los cazadores volverán al saldo inicial de **100 huesos**.\n' +
                '• 📊 Se restablecerán rachas diarias, cacerías, inventarios y estadísticas de duelos.\n' +
                '• 📜 Se eliminará el historial de transacciones antiguas.\n' +
                '• 🏆 La tabla de clasificación en vivo se reiniciará.\n\n' +
                '¿Deseas proceder con el reseteo?',
                COLORES.rojo
            );

            return interaction.reply({
                embeds: [embedAlerta],
                components: [fila],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (accion === 'cancelar_reset_evento') {
            return interaction.update({
                content: '✅ Operación cancelada. El evento y la economía continúan sin cambios.',
                embeds: [],
                components: [],
            });
        }

        if (accion === 'confirmar_reset_evento') {
            await interaction.deferUpdate();
            // 1. Respaldo de seguridad previo
            const resBackup = await crearBackup(guildId, 'pre_reset_temporada');

            // 2. Reseteo de usuarios
            const totalCazadores = await Usuario.countDocuments({ guildId });
            await Usuario.updateMany(
                { guildId },
                {
                    $set: {
                        huesos: 100,
                        rachaDiaria: 0,
                        ultimoDiario: null,
                        ultimaCaza: null,
                        caceriasExitosas: 0,
                        caceriasTotales: 0,
                        duelosGanados: 0,
                        duelosPerdidos: 0,
                        inventario: [],
                    },
                }
            );

            // 3. Limpiar transacciones
            await Transaccion.deleteMany({ guildId });

            // 4. Actualizar paneles en vivo
            actualizarPanelCripta(client, guildId);
            actualizarPanelAdminPermanente(client, guildId);

            await logAdmin(guildId, interaction.user.id, 'Reseteo Total de Evento', `Temporada reiniciada para ${totalCazadores} cazadores. Respaldo previo: \`${resBackup.nombreArchivo}\`.`);

            const embedExito = basePremium(
                '🔄 TEMPORADA REINICIADA CON ÉXITO',
                `Se ha reiniciado el evento para **${totalCazadores}** cazadores.\n\n` +
                `• Todos los saldos han sido fijados a **100 huesos** 🦴.\n` +
                `• El ranking en vivo se ha actualizado.\n` +
                `• Respaldo de seguridad guardado en: \`${resBackup.nombreArchivo}\`.`,
                COLORES.verde
            );

            return interaction.editReply({ embeds: [embedExito], components: [] });
        }

        // ── 3. Refrescar Panel de Admin ──
        if (accion === 'panel_refresh') {
            await safeDeferUpdate(interaction);
            const panel = await construirPanelAdmin(guildId);
            return interaction.editReply(panel).catch(() => null);
        }

        // ── 4. Toggle Mantenimiento / Modo Test ──
        if (accion === 'panel_toggle_mantenimiento') {
            await safeDeferUpdate(interaction);
            const config = await ConfigEvento.findOne({ guildId });
            config.modoTest = !config.modoTest;
            await config.save();

            await logAdmin(guildId, interaction.user.id, 'Modo Test / Mantenimiento', `${config.modoTest ? '🟢 ACTIVADO' : '🔴 DESACTIVADO'}`);
            solicitarActualizacionAdminPanel(guildId);
            const panel = await construirPanelAdmin(guildId);
            return interaction.editReply(panel).catch(() => null);
        }

        // ── 5. Dar Huesos: Paso 1 (Seleccionar Usuario) ──
        if (accion === 'panel_dar_huesos') {
            const fila = new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                    .setCustomId(`admin:sel_user_dar:${interaction.user.id}`)
                    .setPlaceholder('🎯 Selecciona al cazador que recibirá los huesos...')
            );
            return interaction.reply({
                content: 'Selecciona al usuario al que deseas otorgar huesos:',
                components: [fila],
                flags: MessageFlags.Ephemeral,
            });
        }

        // Dar Huesos: Paso 2 (Abrir Modal)
        if (accion === 'sel_user_dar') {
            const targetId = interaction.values[0];
            const targetUser = await client.users.fetch(targetId).catch(() => null);

            const modal = new ModalBuilder()
                .setCustomId(`admin:modal_dar:${interaction.user.id}:${targetId}`)
                .setTitle(`🦴 Dar Huesos a ${(targetUser?.username || 'Usuario').slice(0, 20)}`);

            const inputCantidad = new TextInputBuilder()
                .setCustomId('cantidad')
                .setLabel('Cantidad de Huesos')
                .setPlaceholder('Ej: 500')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const inputRazon = new TextInputBuilder()
                .setCustomId('razon')
                .setLabel('Razón / Motivo')
                .setPlaceholder('Ej: Ganador de evento de la comunidad')
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(inputCantidad),
                new ActionRowBuilder().addComponents(inputRazon)
            );
            return interaction.showModal(modal);
        }

        // Dar Huesos: Paso 3 (Procesar Modal)
        if (accion === 'modal_dar') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const targetId = extra;
            const cantidad = parseInt(interaction.fields.getTextInputValue('cantidad'), 10);
            const razon = interaction.fields.getTextInputValue('razon') || 'Otorgado por Staff';

            if (isNaN(cantidad) || cantidad <= 0) {
                return interaction.editReply({ content: '❌ Cantidad inválida. Debe ser un número mayor a 0.' });
            }

            const modificado = await modificarHuesos(targetId, guildId, cantidad, 'admin_dar', `Admin <@${interaction.user.id}>: ${razon}`);
            await logAdmin(guildId, interaction.user.id, 'Dar Huesos', `+${formatoNum(cantidad)} a <@${targetId}> — ${razon}`);
            solicitarActualizacionCripta(guildId);
            solicitarActualizacionAdminPanel(guildId);

            return interaction.editReply({
                embeds: [basePremium('✅ Huesos Otorgados', `Se han añadido **+${formatoNum(cantidad)}** huesos a <@${targetId}>.\n**Nuevo saldo:** ${formatoNum(modificado.huesos)} 🦴`, COLORES.verde)],
            });
        }

        // ── 6. Quitar Huesos: Paso 1 (Seleccionar Usuario) ──
        if (accion === 'panel_quitar_huesos') {
            const fila = new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                    .setCustomId(`admin:sel_user_quitar:${interaction.user.id}`)
                    .setPlaceholder('🎯 Selecciona al cazador al que quitarás huesos...')
            );
            return interaction.reply({
                content: 'Selecciona al usuario al que deseas remover huesos:',
                components: [fila],
                flags: MessageFlags.Ephemeral,
            });
        }

        // Quitar Huesos: Paso 2 (Abrir Modal)
        if (accion === 'sel_user_quitar') {
            const targetId = interaction.values[0];
            const targetUser = await client.users.fetch(targetId).catch(() => null);

            const modal = new ModalBuilder()
                .setCustomId(`admin:modal_quitar:${interaction.user.id}:${targetId}`)
                .setTitle(`💸 Quitar Huesos a ${(targetUser?.username || 'Usuario').slice(0, 20)}`);

            const inputCantidad = new TextInputBuilder()
                .setCustomId('cantidad')
                .setLabel('Cantidad a Remover')
                .setPlaceholder('Ej: 200')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const inputRazon = new TextInputBuilder()
                .setCustomId('razon')
                .setLabel('Razón de la sanción / remoción')
                .setPlaceholder('Ej: Infracción de normas')
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(inputCantidad),
                new ActionRowBuilder().addComponents(inputRazon)
            );
            return interaction.showModal(modal);
        }

        // Quitar Huesos: Paso 3 (Procesar Modal)
        if (accion === 'modal_quitar') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const targetId = extra;
            const cantidad = parseInt(interaction.fields.getTextInputValue('cantidad'), 10);
            const razon = interaction.fields.getTextInputValue('razon') || 'Removido por Staff';

            if (isNaN(cantidad) || cantidad <= 0) {
                return interaction.editReply({ content: '❌ Cantidad inválida. Debe ser un número mayor a 0.' });
            }

            const u = await obtenerUsuario(targetId, guildId);
            const cantidadEfectiva = Math.min(cantidad, u.huesos);

            const modificado = await modificarHuesos(targetId, guildId, -cantidadEfectiva, 'admin_quitar', `Admin <@${interaction.user.id}>: ${razon}`);
            await logAdmin(guildId, interaction.user.id, 'Quitar Huesos', `-${formatoNum(cantidadEfectiva)} a <@${targetId}> — ${razon}`);
            solicitarActualizacionCripta(guildId);
            solicitarActualizacionAdminPanel(guildId);

            return interaction.editReply({
                embeds: [basePremium('✅ Huesos Removidos', `Se han descontado **-${formatoNum(cantidadEfectiva)}** huesos a <@${targetId}>.\n**Nuevo saldo:** ${formatoNum(modificado.huesos)} 🦴`, COLORES.rojo)],
            });
        }

        // ── 7. Forzar Evento Manualmente ──
        if (accion === 'panel_forzar_evento') {
            const menu = new StringSelectMenuBuilder()
                .setCustomId(`admin:sel_evento:${interaction.user.id}`)
                .setPlaceholder('⚡ Selecciona el evento que deseas disparar...')
                .addOptions([
                    { label: '👻 Fantasma Fugaz', value: 'fantasma', description: 'Aparece un fantasma veloz con huesos' },
                    { label: '🎃 Trivia del Terror', value: 'trivia', description: 'Pregunta de terror con 4 opciones' },
                    { label: '🦴 Montón de Huesos', value: 'cofre', description: 'Botín libre en el cementerio para el primero' },
                    { label: '🌕 Eclipse Espectral (x2)', value: 'eclipse_2x', description: 'Multiplicador doble para todo el server (30m)' },
                ]);

            return interaction.reply({
                content: 'Elige el evento aleatorio que deseas invocar:',
                components: [new ActionRowBuilder().addComponents(menu)],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (accion === 'sel_evento') {
            await interaction.deferUpdate();
            const tipoEvento = interaction.values[0];
            const res = await forzarEvento(guildId, client, tipoEvento);
            if (!res) {
                return interaction.editReply({ content: '❌ No se pudo disparar el evento. Revisa que el canal de eventos esté configurado.' });
            }
            await logAdmin(guildId, interaction.user.id, 'Evento Manual Forzado', `Evento: ${tipoEvento}`);
            return interaction.editReply({
                content: `✅ ¡Evento **${tipoEvento}** lanzado con éxito!`,
                components: [],
            });
        }

        // ── 8. Sorteo y Drops Aleatorios ──
        if (accion === 'panel_sorteo') {
            const fila = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`admin:ejecutar_drop:${interaction.user.id}`)
                    .setLabel('🎁 Lanzar Drop en el Canal')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`admin:sorteo_azar:${interaction.user.id}`)
                    .setLabel('🎲 Elegir Cazador al Azar')
                    .setStyle(ButtonStyle.Primary)
            );

            return interaction.reply({
                embeds: [basePremium(
                    '🎉 Sorteos y Drops de Huesos',
                    'Selecciona el formato de sorteo que deseas realizar:\n\n' +
                    '• **🎁 Drop en el Canal:** Publica un botón interactivo público en este canal donde el primer miembro en tocarlo gana **+250 huesos**.\n' +
                    '• **🎲 Elegir Cazador al Azar:** El sistema selecciona automáticamente a un usuario al azar de la base de datos y le acredita **+350 huesos**.',
                    COLORES.dorado
                )],
                components: [fila],
                flags: MessageFlags.Ephemeral,
            });
        }

        // Drop público en el canal
        if (accion === 'ejecutar_drop') {
            await interaction.deferUpdate();
            const premio = 250;
            const embedDrop = basePremium(
                '🎁 ¡DROP RELÁMPAGO DE HUESOS!',
                `¡El Staff <@${interaction.user.id}> ha dejado caer una ofrenda de ultra tumba!\n\n` +
                `💰 **Botín:** **+${formatoNum(premio)} huesos 🦴**\n\n` +
                `👇 *¡El primer cazador en pulsar el botón se queda con todo!*`,
                COLORES.dorado
            );

            const filaBoton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`evento:huesos_drop:todos:${premio}`)
                    .setLabel('¡Reclamar Botín!')
                    .setEmoji('🦴')
                    .setStyle(ButtonStyle.Success)
            );

            await interaction.channel.send({ embeds: [embedDrop], components: [filaBoton] });
            await logAdmin(guildId, interaction.user.id, 'Drop en Canal', `Drop de ${premio} huesos en <#${interaction.channelId}>`);
            return interaction.editReply({ content: '✅ Drop publicado en el canal.', embeds: [], components: [] });
        }

        // Sorteo al azar entre usuarios registrados
        if (accion === 'sorteo_azar') {
            await interaction.deferUpdate();
            const premio = 350;
            const ganadores = await Usuario.aggregate([
                { $match: { guildId } },
                { $sample: { size: 1 } },
            ]);

            if (!ganadores || ganadores.length === 0) {
                return interaction.editReply({ content: '❌ No hay suficientes usuarios registrados en el evento para sortear.', components: [] });
            }

            const ganadorId = ganadores[0].userId;
            await modificarHuesos(ganadorId, guildId, premio, 'sorteo', 'Sorteo aleatorio de administración');
            await logSorteo(guildId, ganadorId, premio, interaction.user.id);
            await logAdmin(guildId, interaction.user.id, 'Sorteo al Azar', `<@${ganadorId}> premiado con +${premio} huesos.`);
            solicitarActualizacionCripta(guildId);
            solicitarActualizacionAdminPanel(guildId);

            const embedAnuncio = basePremium(
                '🎉 ¡SORTEO ALEATORIO DE LA CRIPTA!',
                `¡Las ánimas han elegido a su favorito del día!\n\n` +
                `👑 **Ganador:** <@${ganadorId}>\n` +
                `💰 **Premio:** **+${formatoNum(premio)}** huesos 🦴\n\n` +
                `*Sorteo cortesía del Staff.*`,
                COLORES.dorado
            );

            await interaction.channel.send({ embeds: [embedAnuncio] });
            return interaction.editReply({ content: `✅ Sorteo completado. <@${ganadorId}> recibió sus huesos.`, embeds: [], components: [] });
        }

        // ── 9. Configurar Canales por Menú Interactivo ──
        if (accion === 'panel_menu_canales') {
            const menu = new StringSelectMenuBuilder()
                .setCustomId(`admin:sel_tipo_canal:${interaction.user.id}`)
                .setPlaceholder('⚙️ Selecciona qué canal deseas configurar...')
                .addOptions([
                    { label: '🏰 Canal de La Cripta (Fijo)', value: 'canalCriptaId', description: 'Centro de mando maestro permanente' },
                    { label: '👑 Panel Admin (Fijo)', value: 'canalAdminPanelId', description: 'Panel maestro permanente de administración' },
                    { label: '📢 Canal de Logs Públicos', value: 'canalLogsPublicosId', description: 'Transparencia de justificación de huesos' },
                    { label: '🛡️ Canal de Logs de Admins', value: 'canalLogsId', description: 'Auditoría privada de seguridad' },
                    { label: '🎃 Canal de Eventos Comunitarios', value: 'canalEventosId', description: 'Fantasmas, trivias y cofres' },
                    { label: '🎵 Canal de Música Dedicado', value: 'canalMusicaId', description: 'Reproductor táctil permanente' },
                    { label: '📦 Bóveda de Stickers', value: 'canalStickersId', description: 'Archivador de stickers robados' },
                    { label: '🔬 Canal de Pruebas / Mantenimiento', value: 'canalTestId', description: 'Apariciones aisladas de prueba' },
                ]);

            return interaction.reply({
                content: 'Elige el canal que deseas vincular:',
                components: [new ActionRowBuilder().addComponents(menu)],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (accion === 'sel_tipo_canal') {
            const tipoCanal = interaction.values[0];
            const selectCanal = new ChannelSelectMenuBuilder()
                .setCustomId(`admin:sel_canal_final:${interaction.user.id}:${tipoCanal}`)
                .setPlaceholder('🎯 Selecciona el canal de texto de Discord...')
                .addChannelTypes(ChannelType.GuildText);

            return interaction.update({
                content: `Elige el canal de texto para asignar a **${tipoCanal}**:`,
                components: [new ActionRowBuilder().addComponents(selectCanal)],
            });
        }

        if (accion === 'sel_canal_final') {
            await interaction.deferUpdate();
            const tipoCanal = extra;
            const canalId = interaction.values[0];

            await ConfigEvento.findOneAndUpdate(
                { guildId },
                { $set: { [tipoCanal]: canalId } },
                { upsert: true, new: true }
            );

            if (tipoCanal === 'canalCriptaId') {
                await configurarCanalCripta(guildId, canalId, client);
            } else if (tipoCanal === 'canalMusicaId') {
                await configurarCanalMusica(guildId, canalId, client);
            } else if (tipoCanal === 'canalAdminPanelId') {
                await configurarCanalAdminPanel(guildId, canalId, client);
            }

            solicitarActualizacionAdminPanel(guildId);
            await logAdmin(guildId, interaction.user.id, 'Configuración de Canal', `Asignado **${tipoCanal}** a <#${canalId}>`);

            return interaction.editReply({
                content: `✅ ¡Canal configurado con éxito! Se asignó <#${canalId}> como **${tipoCanal}**.`,
                components: [],
            });
        }

        // ── 10. GESTIÓN DE PERMISOS DE STAFF (Roles y Usuarios) ──
        if (accion === 'panel_menu_permisos') {
            const isOwnerOrAdmin = esSuperAdmin(interaction.member.id) || interaction.member.permissions.has(PermissionFlagsBits.Administrator) || interaction.member.id === interaction.guild?.ownerId;
            if (!isOwnerOrAdmin) {
                return interaction.reply({
                    content: '🔒 Solo los **Administradores nativos**, el Dueño del servidor o el Super-Administrador pueden modificar los roles y usuarios autorizados.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const config = await ConfigEvento.findOne({ guildId }).lean() || {};
            const rolesStr = (config.rolesAdminIds && config.rolesAdminIds.length > 0)
                ? config.rolesAdminIds.map(id => `<@&${id}>`).join(', ')
                : '🔒 *Ninguno (Solo Administradores nativos)*';

            const usersStr = (config.usuariosAdminIds && config.usuariosAdminIds.length > 0)
                ? config.usuariosAdminIds.map(id => `<@${id}>`).join(', ')
                : '_Ninguno adicional_';

            const filaBotones = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('admin:permiso_agregar_rol:admin')
                    .setLabel('➕ Agregar Rol')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('admin:permiso_quitar_rol:admin')
                    .setLabel('➖ Quitar Rol')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('admin:permiso_agregar_user:admin')
                    .setLabel('➕ Agregar Usuario')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('admin:permiso_quitar_user:admin')
                    .setLabel('➖ Quitar Usuario')
                    .setStyle(ButtonStyle.Danger)
            );

            const embedPerms = basePremium(
                '🛡️ Configuración de Permisos de Staff • La Cripta',
                'Define qué roles de Discord o personas específicas tendrán acceso al panel y comandos de moderación:\n\n' +
                `🎭 **Roles Autorizados:** ${rolesStr}\n\n` +
                `👤 **Usuarios Directos:** ${usersStr}\n\n` +
                '*(Los Administradores nativos de Discord siempre tienen acceso maestro).*\n\n' +
                '👇 *Selecciona qué acción deseas realizar:*',
                COLORES.morado
            );

            return interaction.reply({
                embeds: [embedPerms],
                components: [filaBotones],
                flags: MessageFlags.Ephemeral,
            });
        }

        // Agregar Rol: Menú de Selección de Roles
        if (accion === 'permiso_agregar_rol') {
            const select = new RoleSelectMenuBuilder()
                .setCustomId('admin:sel_agregar_rol:admin')
                .setPlaceholder('🎯 Selecciona el rol de Discord a autorizar...')
                .setMinValues(1)
                .setMaxValues(1);

            return interaction.reply({
                content: 'Elige el rol que tendrá acceso a la administración del evento:',
                components: [new ActionRowBuilder().addComponents(select)],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (accion === 'sel_agregar_rol') {
            await interaction.deferUpdate();
            const roleId = interaction.values[0];
            await ConfigEvento.findOneAndUpdate(
                { guildId },
                { $addToSet: { rolesAdminIds: roleId } },
                { upsert: true, new: true }
            );
            await logAdmin(guildId, interaction.user.id, 'Permiso Rol Agregado', `Rol <@&${roleId}> autorizado para administración`);
            solicitarActualizacionAdminPanel(guildId);
            return interaction.editReply({
                content: `✅ ¡Rol <@&${roleId}> agregado con éxito a los permisos de administración!`,
                components: [],
            });
        }

        // Quitar Rol: Menú
        if (accion === 'permiso_quitar_rol') {
            const config = await ConfigEvento.findOne({ guildId }).lean() || {};
            if (!config.rolesAdminIds || config.rolesAdminIds.length === 0) {
                return interaction.reply({
                    content: '❌ No hay roles configurados actualmente para remover.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const opciones = config.rolesAdminIds.map((rid) => {
                const r = interaction.guild?.roles.cache.get(rid);
                return {
                    label: `@${r ? r.name : rid}`.slice(0, 100),
                    value: rid,
                    description: `ID: ${rid}`,
                };
            });

            const select = new StringSelectMenuBuilder()
                .setCustomId('admin:sel_quitar_rol:admin')
                .setPlaceholder('🗑️ Selecciona el rol a revocar...')
                .addOptions(opciones);

            return interaction.reply({
                content: 'Selecciona el rol al que deseas revocar los permisos:',
                components: [new ActionRowBuilder().addComponents(select)],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (accion === 'sel_quitar_rol') {
            await interaction.deferUpdate();
            const roleId = interaction.values[0];
            await ConfigEvento.findOneAndUpdate(
                { guildId },
                { $pull: { rolesAdminIds: roleId } },
                { new: true }
            );
            await logAdmin(guildId, interaction.user.id, 'Permiso Rol Removido', `Rol <@&${roleId}> revocado de administración`);
            solicitarActualizacionAdminPanel(guildId);
            return interaction.editReply({
                content: `✅ Rol <@&${roleId}> removido de los permisos de administración.`,
                components: [],
            });
        }

        // Agregar Usuario Directo
        if (accion === 'permiso_agregar_user') {
            const select = new UserSelectMenuBuilder()
                .setCustomId('admin:sel_agregar_user:admin')
                .setPlaceholder('🎯 Selecciona el usuario a autorizar...')
                .setMinValues(1)
                .setMaxValues(1);

            return interaction.reply({
                content: 'Elige el usuario que tendrá acceso directo a la administración del evento:',
                components: [new ActionRowBuilder().addComponents(select)],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (accion === 'sel_agregar_user') {
            await interaction.deferUpdate();
            const targetId = interaction.values[0];
            await ConfigEvento.findOneAndUpdate(
                { guildId },
                { $addToSet: { usuariosAdminIds: targetId } },
                { upsert: true, new: true }
            );
            await logAdmin(guildId, interaction.user.id, 'Permiso Usuario Agregado', `Usuario <@${targetId}> autorizado directamente`);
            solicitarActualizacionAdminPanel(guildId);
            return interaction.editReply({
                content: `✅ ¡Usuario <@${targetId}> autorizado directamente para la administración del evento!`,
                components: [],
            });
        }

        // Quitar Usuario Directo
        if (accion === 'permiso_quitar_user') {
            const config = await ConfigEvento.findOne({ guildId }).lean() || {};
            if (!config.usuariosAdminIds || config.usuariosAdminIds.length === 0) {
                return interaction.reply({
                    content: '❌ No hay usuarios autorizados directamente para remover.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const opciones = config.usuariosAdminIds.map((uid) => {
                const u = client.users.cache.get(uid);
                return {
                    label: `@${u ? u.tag : uid}`.slice(0, 100),
                    value: uid,
                    description: `ID: ${uid}`,
                };
            });

            const select = new StringSelectMenuBuilder()
                .setCustomId('admin:sel_quitar_user:admin')
                .setPlaceholder('🗑️ Selecciona el usuario a revocar...')
                .addOptions(opciones);

            return interaction.reply({
                content: 'Selecciona al usuario que deseas revocar:',
                components: [new ActionRowBuilder().addComponents(select)],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (accion === 'sel_quitar_user') {
            await interaction.deferUpdate();
            const targetId = interaction.values[0];
            await ConfigEvento.findOneAndUpdate(
                { guildId },
                { $pull: { usuariosAdminIds: targetId } },
                { new: true }
            );
            await logAdmin(guildId, interaction.user.id, 'Permiso Usuario Removido', `Usuario <@${targetId}> revocado`);
            solicitarActualizacionAdminPanel(guildId);
            return interaction.editReply({
                content: `✅ Usuario <@${targetId}> removido de los permisos de administración.`,
                components: [],
            });
        }

        // ── 11. GESTIÓN DE LISTA NEGRA (BLACKLIST) ──
        if (accion === 'panel_menu_blacklist') {
            const isOwnerOrAdmin = esSuperAdmin(interaction.member.id) || interaction.member.permissions.has(PermissionFlagsBits.Administrator) || interaction.member.id === interaction.guild?.ownerId;
            if (!isOwnerOrAdmin) {
                return interaction.reply({
                    content: '🔒 Solo los **Administradores nativos**, el Dueño del servidor o el Super-Administrador pueden gestionar la lista negra.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const config = await ConfigEvento.findOne({ guildId }).lean() || {};
            const rolesStr = (config.blacklistRolesIds && config.blacklistRolesIds.length > 0)
                ? config.blacklistRolesIds.map(id => `<@&${id}>`).join(', ')
                : '_Ningún rol en la lista negra_';

            const usersStr = (config.blacklistUsuariosIds && config.blacklistUsuariosIds.length > 0)
                ? config.blacklistUsuariosIds.map(id => `<@${id}>`).join(', ')
                : '_Ningún usuario en la lista negra_';

            const filaBotones = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('admin:bl_agregar_rol:admin')
                    .setLabel('➕ Bloquear Rol')
                    .setEmoji('🎭')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('admin:bl_quitar_rol:admin')
                    .setLabel('➖ Desbloquear Rol')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('admin:bl_agregar_user:admin')
                    .setLabel('➕ Bloquear Usuario')
                    .setEmoji('👤')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('admin:bl_quitar_user:admin')
                    .setLabel('➖ Desbloquear Usuario')
                    .setStyle(ButtonStyle.Success)
            );

            const embedBL = basePremium(
                '🚫 Lista Negra (Blacklist) • La Cripta de los Huesos',
                'Los usuarios o roles en la lista negra **no pueden participar** del evento (no recibirán huesos por chat ni voz, ni podrán cazar, apostar, retar o responder trivias):\n\n' +
                `🎭 **Roles Bloqueados:** ${rolesStr}\n\n` +
                `👤 **Usuarios Bloqueados:** ${usersStr}\n\n` +
                '👇 *Selecciona qué acción deseas realizar:*',
                COLORES.rojo
            );

            return interaction.reply({
                embeds: [embedBL],
                components: [filaBotones],
                flags: MessageFlags.Ephemeral,
            });
        }

        // Bloquear Rol: Menú
        if (accion === 'bl_agregar_rol') {
            const select = new RoleSelectMenuBuilder()
                .setCustomId('admin:sel_bl_agregar_rol:admin')
                .setPlaceholder('🎯 Selecciona el rol a bloquear del evento...')
                .setMinValues(1)
                .setMaxValues(1);

            return interaction.reply({
                content: 'Elige el rol que será excluido de participar en el evento:',
                components: [new ActionRowBuilder().addComponents(select)],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (accion === 'sel_bl_agregar_rol') {
            await interaction.deferUpdate();
            const roleId = interaction.values[0];
            await ConfigEvento.findOneAndUpdate(
                { guildId },
                { $addToSet: { blacklistRolesIds: roleId } },
                { upsert: true, new: true }
            );
            await logAdmin(guildId, interaction.user.id, 'Blacklist Rol Agregado', `Rol <@&${roleId}> añadido a la lista negra del evento`);
            solicitarActualizacionAdminPanel(guildId);
            return interaction.editReply({
                content: `🚫 ¡Rol <@&${roleId}> añadido a la lista negra! Sus miembros no podrán participar en el evento.`,
                components: [],
            });
        }

        // Desbloquear Rol: Menú
        if (accion === 'bl_quitar_rol') {
            const config = await ConfigEvento.findOne({ guildId }).lean() || {};
            if (!config.blacklistRolesIds || config.blacklistRolesIds.length === 0) {
                return interaction.reply({
                    content: '❌ No hay roles bloqueados actualmente en la lista negra.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const opciones = config.blacklistRolesIds.map((rid) => {
                const r = interaction.guild?.roles.cache.get(rid);
                return {
                    label: `@${r ? r.name : rid}`.slice(0, 100),
                    value: rid,
                    description: `ID: ${rid}`,
                };
            });

            const select = new StringSelectMenuBuilder()
                .setCustomId('admin:sel_bl_quitar_rol:admin')
                .setPlaceholder('🗑️ Selecciona el rol a desbloquear...')
                .addOptions(opciones);

            return interaction.reply({
                content: 'Selecciona el rol que deseas remover de la lista negra:',
                components: [new ActionRowBuilder().addComponents(select)],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (accion === 'sel_bl_quitar_rol') {
            await interaction.deferUpdate();
            const roleId = interaction.values[0];
            await ConfigEvento.findOneAndUpdate(
                { guildId },
                { $pull: { blacklistRolesIds: roleId } },
                { new: true }
            );
            await logAdmin(guildId, interaction.user.id, 'Blacklist Rol Removido', `Rol <@&${roleId}> removido de la lista negra`);
            solicitarActualizacionAdminPanel(guildId);
            return interaction.editReply({
                content: `✅ Rol <@&${roleId}> removido de la lista negra. Ahora sus miembros pueden participar.`,
                components: [],
            });
        }

        // Bloquear Usuario: Menú
        if (accion === 'bl_agregar_user') {
            const select = new UserSelectMenuBuilder()
                .setCustomId('admin:sel_bl_agregar_user:admin')
                .setPlaceholder('🎯 Selecciona el usuario a bloquear...')
                .setMinValues(1)
                .setMaxValues(1);

            return interaction.reply({
                content: 'Elige el usuario que será excluido de participar en el evento:',
                components: [new ActionRowBuilder().addComponents(select)],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (accion === 'sel_bl_agregar_user') {
            await interaction.deferUpdate();
            const targetId = interaction.values[0];

            if (esSuperAdmin(targetId)) {
                return interaction.editReply({
                    content: `❌ El usuario <@${targetId}> es el Super-Administrador y no puede ser bloqueado del evento.`,
                    components: [],
                });
            }

            await ConfigEvento.findOneAndUpdate(
                { guildId },
                { $addToSet: { blacklistUsuariosIds: targetId } },
                { upsert: true, new: true }
            );
            await logAdmin(guildId, interaction.user.id, 'Blacklist Usuario Agregado', `Usuario <@${targetId}> añadido a la lista negra del evento`);
            solicitarActualizacionAdminPanel(guildId);
            return interaction.editReply({
                content: `🚫 ¡Usuario <@${targetId}> añadido a la lista negra! No podrá participar en el evento.`,
                components: [],
            });
        }

        // Desbloquear Usuario: Menú
        if (accion === 'bl_quitar_user') {
            const config = await ConfigEvento.findOne({ guildId }).lean() || {};
            if (!config.blacklistUsuariosIds || config.blacklistUsuariosIds.length === 0) {
                return interaction.reply({
                    content: '❌ No hay usuarios en la lista negra actualmente.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const opciones = config.blacklistUsuariosIds.map((uid) => {
                const u = client.users.cache.get(uid);
                return {
                    label: `@${u ? u.tag : uid}`.slice(0, 100),
                    value: uid,
                    description: `ID: ${uid}`,
                };
            });

            const select = new StringSelectMenuBuilder()
                .setCustomId('admin:sel_bl_quitar_user:admin')
                .setPlaceholder('🗑️ Selecciona el usuario a desbloquear...')
                .addOptions(opciones);

            return interaction.reply({
                content: 'Selecciona al usuario que deseas remover de la lista negra:',
                components: [new ActionRowBuilder().addComponents(select)],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (accion === 'sel_bl_quitar_user') {
            await interaction.deferUpdate();
            const targetId = interaction.values[0];
            await ConfigEvento.findOneAndUpdate(
                { guildId },
                { $pull: { blacklistUsuariosIds: targetId } },
                { new: true }
            );
            await logAdmin(guildId, interaction.user.id, 'Blacklist Usuario Removido', `Usuario <@${targetId}> removido de la lista negra`);
            solicitarActualizacionAdminPanel(guildId);
            return interaction.editReply({
                content: `✅ Usuario <@${targetId}> removido de la lista negra. Ahora puede volver a participar.`,
                components: [],
            });
        }

        // ── 12. Ver Transacciones Recientes ──
        if (accion === 'panel_ver_tx') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const lista = await Transaccion.find({ guildId }).sort({ fecha: -1 }).limit(12).lean();
            let desc = '';
            if (lista.length === 0) desc = '_No hay transacciones registradas aún._';
            else {
                lista.forEach((tx) => {
                    const signo = tx.monto >= 0 ? '+' : '';
                    const emoji = tx.monto >= 0 ? '🟢' : '🔴';
                    desc += `${emoji} <t:${Math.floor(tx.fecha.getTime() / 1000)}:R> <@${tx.userId}> **${signo}${formatoNum(tx.monto)}** 🦴 (${tx.tipo})\n`;
                });
            }

            return interaction.editReply({
                embeds: [basePremium('📜 Transacciones Recientes del Servidor', desc.slice(0, 4000), COLORES.morado)],
            });
        }
    },
};

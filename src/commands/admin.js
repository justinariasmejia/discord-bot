// src/commands/admin.js
// Panel de administración completo de "La Cripta de los Huesos"
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ChannelType,
    EmbedBuilder,
} = require('discord.js');
const ConfigEvento = require('../models/ConfigEvento');
const Transaccion = require('../models/Transaccion');
const Usuario = require('../models/Usuario');
const { modificarHuesos, obtenerUsuario } = require('../services/economia');
const { forzarEvento, activarMultiplicadorGlobal } = require('../services/eventos-aleatorios');
const { verificarYCerrarEvento } = require('../services/cierre');
const { obtenerConfig, esSuperAdmin } = require('../services/evento');
const { base, basePremium, COLORES, formatoNum, SEPARADOR, SEPARADOR_FINO } = require('../utils/embeds');
const { logAdmin } = require('../services/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Panel de administración de La Cripta de los Huesos')
        // ── Dar Huesos ──
        .addSubcommand((sub) =>
            sub
                .setName('dar_huesos')
                .setDescription('Otorga huesos a un cazador')
                .addUserOption((opt) => opt.setName('usuario').setDescription('El cazador').setRequired(true))
                .addIntegerOption((opt) => opt.setName('cantidad').setDescription('Cantidad de huesos').setRequired(true).setMinValue(1))
                .addStringOption((opt) => opt.setName('razon').setDescription('Razón del otorgamiento'))
        )
        // ── Quitar Huesos ──
        .addSubcommand((sub) =>
            sub
                .setName('quitar_huesos')
                .setDescription('Remueve huesos a un cazador')
                .addUserOption((opt) => opt.setName('usuario').setDescription('El cazador').setRequired(true))
                .addIntegerOption((opt) => opt.setName('cantidad').setDescription('Cantidad de huesos').setRequired(true).setMinValue(1))
                .addStringOption((opt) => opt.setName('razon').setDescription('Razón de la remoción'))
        )
        // ── Set Huesos (fijar exacto) ──
        .addSubcommand((sub) =>
            sub
                .setName('set_huesos')
                .setDescription('Fija los huesos de un cazador a una cantidad exacta')
                .addUserOption((opt) => opt.setName('usuario').setDescription('El cazador').setRequired(true))
                .addIntegerOption((opt) => opt.setName('cantidad').setDescription('Cantidad exacta de huesos').setRequired(true).setMinValue(0))
        )
        // ── Ver Usuario Detallado ──
        .addSubcommand((sub) =>
            sub
                .setName('ver_usuario')
                .setDescription('Muestra información detallada de un cazador')
                .addUserOption((opt) => opt.setName('usuario').setDescription('El cazador').setRequired(true))
        )
        // ── Configurar Canales (Unificado) ──
        .addSubcommand((sub) =>
            sub
                .setName('canal')
                .setDescription('Configura uno de los canales dedicados del sistema')
                .addStringOption((opt) =>
                    opt
                        .setName('tipo')
                        .setDescription('Tipo de canal a configurar')
                        .setRequired(true)
                        .addChoices(
                            { name: '🎃 Eventos Comunitarios', value: 'eventos' },
                            { name: '🏰 La Cripta (Panel interactivo)', value: 'cripta' },
                            { name: '🏆 Salón de la Fama / Ranking', value: 'salon_fama' },
                            { name: '🛡️ Logs Internos de Moderación', value: 'logs' },
                            { name: '📢 Logs Públicos de Economía', value: 'logs_publicos' },
                            { name: '📣 Canal de Anuncios', value: 'anuncios' },
                            { name: '🎵 Reproductor de Música', value: 'musica' },
                            { name: '🎨 Bóveda de Stickers', value: 'stickers' },
                            { name: '⚙️ Panel Maestro de Administración', value: 'panel' },
                            { name: '🎂 Canal de Cumpleaños', value: 'cumpleanos' }
                        )
                )
                .addChannelOption((opt) =>
                    opt
                        .setName('canal')
                        .setDescription('Canal de texto de Discord')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('panel')
                .setDescription('Abre el panel interactivo maestro de administración de La Cripta')
        )
        // ── Rol de Alertas de Halloween ──
        .addSubcommand((sub) =>
            sub
                .setName('rol_alertas')
                .setDescription('Configura el rol que recibirá las alertas de eventos de Halloween')
                .addRoleOption((opt) => opt.setName('rol').setDescription('Rol para las notificaciones').setRequired(true))
        )
        // ── Rol de Testers de Modo Prueba ──
        .addSubcommand((sub) =>
            sub
                .setName('rol_tester')
                .setDescription('Configura el rol que tendrá permisos para testear durante mantenimiento')
                .addRoleOption((opt) => opt.setName('rol').setDescription('Rol para los testers').setRequired(true))
        )
        // ── Gestión de Testers Individuales ──
        .addSubcommand((sub) =>
            sub
                .setName('tester_usuario')
                .setDescription('Añade o remueve a un usuario específico como tester durante mantenimiento')
                .addStringOption((opt) =>
                    opt
                        .setName('accion')
                        .setDescription('Añadir o remover tester')
                        .setRequired(true)
                        .addChoices(
                            { name: '➕ Añadir tester', value: 'add' },
                            { name: '➖ Remover tester', value: 'remove' }
                        )
                )
                .addUserOption((opt) =>
                    opt
                        .setName('usuario')
                        .setDescription('Usuario a designar o revocar como tester')
                        .setRequired(true)
                )
        )
        // ── Ver Configuración Actual ──
        .addSubcommand((sub) =>
            sub
                .setName('ver_config')
                .setDescription('Muestra la configuración actual del servidor')
        )
        // ── Evento manual ──
        .addSubcommand((sub) =>
            sub
                .setName('evento')
                .setDescription('Dispara un evento aleatorio manualmente')
                .addStringOption((opt) =>
                    opt
                        .setName('tipo')
                        .setDescription('Tipo de evento')
                        .setRequired(true)
                        .addChoices(
                            { name: '👻 Fantasma Fugaz', value: 'fantasma' },
                            { name: '🎃 Trivia del Terror', value: 'trivia' },
                            { name: '🗝️ Cofre Maldito', value: 'cofre' },
                            { name: '🌕 Eclipse Espectral (x2)', value: 'eclipse_2x' },
                            { name: '🎲 Oogie Boogie', value: 'oogie_boogie' }
                        )
                )
                .addUserOption((opt) =>
                    opt
                        .setName('usuario')
                        .setDescription('Objetivo específico para Oogie Boogie (por defecto tú mismo)')
                        .setRequired(false)
                )
        )
        // ── Multiplicador ──
        .addSubcommand((sub) =>
            sub
                .setName('multiplicador')
                .setDescription('Activa un multiplicador temporal para el servidor')
                .addIntegerOption((opt) => opt.setName('factor').setDescription('Factor (2 = x2)').setRequired(true).setMinValue(1).setMaxValue(5))
                .addIntegerOption((opt) => opt.setName('minutos').setDescription('Duración en minutos').setMinValue(5).setMaxValue(1440))
        )
        // ── Transacciones ──
        .addSubcommand((sub) =>
            sub
                .setName('transacciones')
                .setDescription('Historial de transacciones recientes')
                .addUserOption((opt) => opt.setName('usuario').setDescription('Filtrar por cazador'))
                .addIntegerOption((opt) => opt.setName('cantidad').setDescription('Cantidad de registros (max 25)').setMinValue(1).setMaxValue(25))
        )
        // ── Anunciar ──
        .addSubcommand((sub) =>
            sub
                .setName('anunciar')
                .setDescription('Envía un anuncio al canal de anuncios configurado')
                .addStringOption((opt) => opt.setName('titulo').setDescription('Título del anuncio').setRequired(true))
                .addStringOption((opt) => opt.setName('mensaje').setDescription('Cuerpo del anuncio').setRequired(true))
                .addStringOption((opt) =>
                    opt.setName('color').setDescription('Color del embed')
                        .addChoices(
                            { name: '🟠 Naranja', value: 'naranja' },
                            { name: '🟣 Morado', value: 'morado' },
                            { name: '🔴 Rojo', value: 'rojo' },
                            { name: '🟢 Verde', value: 'verde' },
                            { name: '🔵 Azul', value: 'azul' },
                            { name: '🟡 Dorado', value: 'dorado' }
                        )
                )
        )
        // ── Cerrar Evento ──
        .addSubcommand((sub) =>
            sub.setName('cerrar_evento').setDescription('Fuerza el cierre inmediato del evento')
        )
        // ── Reset Economía ──
        .addSubcommand((sub) =>
            sub.setName('reset_economia').setDescription('Reinicia toda la economía del servidor')
        )
        // ── Modo Test ──
        .addSubcommand((sub) =>
            sub
                .setName('modo_test')
                .setDescription('Configura el modo de pruebas (solo admins y canal aislado para testear)')
                .addBooleanOption((opt) =>
                    opt
                        .setName('activar')
                        .setDescription('¿Activar o desactivar el modo de pruebas?')
                        .setRequired(true)
                )
                .addChannelOption((opt) =>
                    opt
                        .setName('canal_test')
                        .setDescription('Canal específico donde ocurrirán las apariciones durante las pruebas')
                )
        )
        // ── Gestión de Permisos de Staff / Admin ──
        .addSubcommandGroup((grp) =>
            grp
                .setName('permisos')
                .setDescription('Configura qué roles o usuarios tienen acceso al panel y comandos admin')
                .addSubcommand((sub) =>
                    sub
                        .setName('agregar_rol')
                        .setDescription('Autoriza un rol para acceder a la administración')
                        .addRoleOption((opt) => opt.setName('rol').setDescription('El rol de Discord').setRequired(true))
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('quitar_rol')
                        .setDescription('Revoca los permisos de un rol')
                        .addRoleOption((opt) => opt.setName('rol').setDescription('El rol de Discord').setRequired(true))
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('agregar_usuario')
                        .setDescription('Autoriza a un usuario directo para acceder a la administración')
                        .addUserOption((opt) => opt.setName('usuario').setDescription('El usuario de Discord').setRequired(true))
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('quitar_usuario')
                        .setDescription('Revoca los permisos de un usuario directo')
                        .addUserOption((opt) => opt.setName('usuario').setDescription('El usuario de Discord').setRequired(true))
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('ver')
                        .setDescription('Muestra todos los roles y usuarios autorizados')
                )
        )
        // ── Gestión de Blacklist del Evento ──
        .addSubcommandGroup((grp) =>
            grp
                .setName('blacklist')
                .setDescription('Gestiona la lista negra de usuarios y roles excluidos del evento')
                .addSubcommand((sub) =>
                    sub
                        .setName('agregar_rol')
                        .setDescription('Excluye un rol para que no participe en el evento')
                        .addRoleOption((opt) => opt.setName('rol').setDescription('El rol de Discord a bloquear').setRequired(true))
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('quitar_rol')
                        .setDescription('Remueve un rol de la lista negra')
                        .addRoleOption((opt) => opt.setName('rol').setDescription('El rol de Discord a desbloquear').setRequired(true))
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('agregar_usuario')
                        .setDescription('Excluye a un usuario para que no participe en el evento')
                        .addUserOption((opt) => opt.setName('usuario').setDescription('El usuario de Discord a bloquear').setRequired(true))
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('quitar_usuario')
                        .setDescription('Remueve a un usuario de la lista negra')
                        .addUserOption((opt) => opt.setName('usuario').setDescription('El usuario de Discord a desbloquear').setRequired(true))
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('ver')
                        .setDescription('Muestra todos los roles y usuarios en la lista negra')
                )
        ),

    async ejecutar(interaction, client) {
        const guildId = interaction.guildId;
        const { esAdminAsync } = require('../services/evento');
        const autorizado = await esAdminAsync(interaction.member, guildId);
        if (!autorizado) {
            return interaction.reply({
                content: '🔒 No tienes permisos de administración ni un rol autorizado para gestionar el evento.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const group = interaction.options.getSubcommandGroup(false);
        const sub = interaction.options.getSubcommand();

        // ══════ GESTIÓN DE PERMISOS DE STAFF ══════
        if (group === 'permisos') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const isOwnerOrAdmin = esSuperAdmin(interaction.member.id) || interaction.member.permissions.has(PermissionFlagsBits.Administrator) || interaction.member.id === interaction.guild?.ownerId;
            if (!isOwnerOrAdmin) {
                return interaction.editReply({
                    content: '🔒 Solo los **Administradores nativos**, el Dueño del servidor o el Super-Administrador pueden modificar los permisos de staff.',
                });
            }

            const { solicitarActualizacionAdminPanel } = require('../services/panelAdmin');

            if (sub === 'agregar_rol') {
                const rol = interaction.options.getRole('rol');
                await ConfigEvento.findOneAndUpdate(
                    { guildId },
                    { $addToSet: { rolesAdminIds: rol.id } },
                    { upsert: true, new: true }
                );
                await logAdmin(guildId, interaction.user.id, 'Permiso Rol Agregado', `Rol <@&${rol.id}> autorizado`);
                solicitarActualizacionAdminPanel(guildId);
                return interaction.editReply({
                    embeds: [basePremium('✅ Rol Autorizado', `El rol <@&${rol.id}> ahora tiene acceso al panel y comandos de administración del evento.`, COLORES.verde)],
                });
            }

            if (sub === 'quitar_rol') {
                const rol = interaction.options.getRole('rol');
                await ConfigEvento.findOneAndUpdate(
                    { guildId },
                    { $pull: { rolesAdminIds: rol.id } },
                    { new: true }
                );
                await logAdmin(guildId, interaction.user.id, 'Permiso Rol Removido', `Rol <@&${rol.id}> revocado`);
                solicitarActualizacionAdminPanel(guildId);
                return interaction.editReply({
                    embeds: [basePremium('✅ Rol Revocado', `El rol <@&${rol.id}> ya no tiene acceso a la administración del evento.`, COLORES.rojo)],
                });
            }

            if (sub === 'agregar_usuario') {
                const user = interaction.options.getUser('usuario');
                await ConfigEvento.findOneAndUpdate(
                    { guildId },
                    { $addToSet: { usuariosAdminIds: user.id } },
                    { upsert: true, new: true }
                );
                await logAdmin(guildId, interaction.user.id, 'Permiso Usuario Agregado', `Usuario <@${user.id}> autorizado`);
                solicitarActualizacionAdminPanel(guildId);
                return interaction.editReply({
                    embeds: [basePremium('✅ Usuario Autorizado', `El usuario <@${user.id}> ahora tiene acceso directo a la administración del evento.`, COLORES.verde)],
                });
            }

            if (sub === 'quitar_usuario') {
                const user = interaction.options.getUser('usuario');
                await ConfigEvento.findOneAndUpdate(
                    { guildId },
                    { $pull: { usuariosAdminIds: user.id } },
                    { new: true }
                );
                await logAdmin(guildId, interaction.user.id, 'Permiso Usuario Removido', `Usuario <@${user.id}> revocado`);
                solicitarActualizacionAdminPanel(guildId);
                return interaction.editReply({
                    embeds: [basePremium('✅ Usuario Revocado', `El usuario <@${user.id}> ya no tiene acceso directo a la administración del evento.`, COLORES.rojo)],
                });
            }

            if (sub === 'ver') {
                const config = await ConfigEvento.findOne({ guildId }).lean() || {};
                const rolesStr = (config.rolesAdminIds && config.rolesAdminIds.length > 0)
                    ? config.rolesAdminIds.map((id) => `<@&${id}>`).join('\n• ')
                    : '_Ningún rol configurado (Solo Administradores nativos)_';
                const usersStr = (config.usuariosAdminIds && config.usuariosAdminIds.length > 0)
                    ? config.usuariosAdminIds.map((id) => `<@${id}>`).join('\n• ')
                    : '_Ningún usuario directo configurado_';

                const embed = basePremium(
                    '🛡️ Permisos de Administración Configurados',
                    `### 🎭 Roles Autorizados:\n• ${rolesStr}\n\n` +
                    `### 👤 Usuarios Autorizados Directamente:\n• ${usersStr}\n\n` +
                    `*Nota: Los Administradores nativos de Discord y el Dueño del servidor siempre tienen acceso total.*`,
                    COLORES.morado
                );
                return interaction.editReply({ embeds: [embed] });
            }
        }

        // ══════ GESTIÓN DE BLACKLIST DEL EVENTO ══════
        if (group === 'blacklist') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const isOwnerOrAdmin = esSuperAdmin(interaction.member.id) || interaction.member.permissions.has(PermissionFlagsBits.Administrator) || interaction.member.id === interaction.guild?.ownerId;
            if (!isOwnerOrAdmin) {
                return interaction.editReply({
                    content: '🔒 Solo los **Administradores nativos**, el Dueño del servidor o el Super-Administrador pueden gestionar la lista negra.',
                });
            }

            const { solicitarActualizacionAdminPanel } = require('../services/panelAdmin');

            if (sub === 'agregar_rol') {
                const rol = interaction.options.getRole('rol');
                await ConfigEvento.findOneAndUpdate(
                    { guildId },
                    { $addToSet: { blacklistRolesIds: rol.id } },
                    { upsert: true, new: true }
                );
                await logAdmin(guildId, interaction.user.id, 'Blacklist Rol Agregado', `Rol <@&${rol.id}> excluido del evento`);
                solicitarActualizacionAdminPanel(guildId);
                return interaction.editReply({
                    embeds: [basePremium('🚫 Rol Bloqueado del Evento', `Los miembros con el rol <@&${rol.id}> han sido excluidos de participar en el evento.`, COLORES.rojo)],
                });
            }

            if (sub === 'quitar_rol') {
                const rol = interaction.options.getRole('rol');
                await ConfigEvento.findOneAndUpdate(
                    { guildId },
                    { $pull: { blacklistRolesIds: rol.id } },
                    { new: true }
                );
                await logAdmin(guildId, interaction.user.id, 'Blacklist Rol Removido', `Rol <@&${rol.id}> desbloqueado del evento`);
                solicitarActualizacionAdminPanel(guildId);
                return interaction.editReply({
                    embeds: [basePremium('✅ Rol Desbloqueado', `El rol <@&${rol.id}> ha sido removido de la lista negra y sus miembros pueden participar nuevamente.`, COLORES.verde)],
                });
            }

            if (sub === 'agregar_usuario') {
                const user = interaction.options.getUser('usuario');
                if (esSuperAdmin(user.id)) {
                    return interaction.editReply({
                        content: `❌ El usuario <@${user.id}> es el Super-Administrador y no puede ser añadido a la lista negra.`,
                    });
                }
                await ConfigEvento.findOneAndUpdate(
                    { guildId },
                    { $addToSet: { blacklistUsuariosIds: user.id } },
                    { upsert: true, new: true }
                );
                await logAdmin(guildId, interaction.user.id, 'Blacklist Usuario Agregado', `Usuario <@${user.id}> excluido del evento`);
                solicitarActualizacionAdminPanel(guildId);
                return interaction.editReply({
                    embeds: [basePremium('🚫 Usuario Bloqueado del Evento', `El usuario <@${user.id}> ha sido excluido de participar en el evento.`, COLORES.rojo)],
                });
            }

            if (sub === 'quitar_usuario') {
                const user = interaction.options.getUser('usuario');
                await ConfigEvento.findOneAndUpdate(
                    { guildId },
                    { $pull: { blacklistUsuariosIds: user.id } },
                    { new: true }
                );
                await logAdmin(guildId, interaction.user.id, 'Blacklist Usuario Removido', `Usuario <@${user.id}> desbloqueado del evento`);
                solicitarActualizacionAdminPanel(guildId);
                return interaction.editReply({
                    embeds: [basePremium('✅ Usuario Desbloqueado', `El usuario <@${user.id}> ha sido removido de la lista negra y puede participar nuevamente.`, COLORES.verde)],
                });
            }

            if (sub === 'ver') {
                const config = await ConfigEvento.findOne({ guildId }).lean() || {};
                const rolesStr = (config.blacklistRolesIds && config.blacklistRolesIds.length > 0)
                    ? config.blacklistRolesIds.map((id) => `<@&${id}>`).join('\n• ')
                    : '_Ningún rol en la lista negra_';
                const usersStr = (config.blacklistUsuariosIds && config.blacklistUsuariosIds.length > 0)
                    ? config.blacklistUsuariosIds.map((id) => `<@${id}>`).join('\n• ')
                    : '_Ningún usuario en la lista negra_';

                const embed = basePremium(
                    '🚫 Lista Negra del Evento • La Cripta',
                    'Usuarios y roles excluidos de participar en el evento:\n\n' +
                    `### 🎭 Roles Bloqueados:\n• ${rolesStr}\n\n` +
                    `### 👤 Usuarios Bloqueados:\n• ${usersStr}`,
                    COLORES.rojo
                );

                return interaction.editReply({ embeds: [embed] });
            }
        }

        // ══════ DAR HUESOS ══════
        if (sub === 'dar_huesos') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const target = interaction.options.getUser('usuario');
            const cantidad = interaction.options.getInteger('cantidad');
            const razon = interaction.options.getString('razon') || 'Sin razón especificada';

            const modificado = await modificarHuesos(target.id, guildId, cantidad, 'admin_dar', `Admin <@${interaction.user.id}>: ${razon}`);

            const embed = basePremium('🦴 Huesos Otorgados', '', COLORES.verde)
                .addFields(
                    { name: '👤 Cazador', value: `<@${target.id}>`, inline: true },
                    { name: '💰 Cantidad', value: `+${formatoNum(cantidad)} 🦴`, inline: true },
                    { name: '🦴 Nuevo Saldo', value: `${formatoNum(modificado.huesos)} 🦴`, inline: true },
                    { name: '📝 Razón', value: razon, inline: false }
                );

            await logAdmin(guildId, interaction.user.id, 'Dar Huesos', `+${formatoNum(cantidad)} a <@${target.id}> — ${razon}`, [
                { name: 'Cazador', value: `<@${target.id}>`, inline: true },
                { name: 'Cantidad', value: `+${formatoNum(cantidad)}`, inline: true },
            ]);

            return interaction.editReply({ embeds: [embed] });
        }

        // ══════ QUITAR HUESOS ══════
        if (sub === 'quitar_huesos') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const target = interaction.options.getUser('usuario');
            const cantidad = interaction.options.getInteger('cantidad');
            const razon = interaction.options.getString('razon') || 'Sin razón especificada';

            const u = await obtenerUsuario(target.id, guildId);
            const cantidadEfectiva = Math.min(cantidad, u.huesos);

            const modificado = await modificarHuesos(target.id, guildId, -cantidadEfectiva, 'admin_quitar', `Admin <@${interaction.user.id}>: ${razon}`);

            const embed = basePremium('🦴 Huesos Removidos', '', COLORES.rojo)
                .addFields(
                    { name: '👤 Cazador', value: `<@${target.id}>`, inline: true },
                    { name: '💸 Cantidad', value: `-${formatoNum(cantidadEfectiva)} 🦴`, inline: true },
                    { name: '🦴 Nuevo Saldo', value: `${formatoNum(modificado.huesos)} 🦴`, inline: true },
                    { name: '📝 Razón', value: razon, inline: false }
                );

            await logAdmin(guildId, interaction.user.id, 'Quitar Huesos', `-${formatoNum(cantidadEfectiva)} a <@${target.id}> — ${razon}`, [
                { name: 'Cazador', value: `<@${target.id}>`, inline: true },
                { name: 'Cantidad', value: `-${formatoNum(cantidadEfectiva)}`, inline: true },
            ]);

            return interaction.editReply({ embeds: [embed] });
        }

        // ══════ SET HUESOS (FIJAR EXACTO) ══════
        if (sub === 'set_huesos') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const target = interaction.options.getUser('usuario');
            const cantidad = interaction.options.getInteger('cantidad');

            const u = await obtenerUsuario(target.id, guildId);
            const delta = cantidad - u.huesos;

            if (delta !== 0) {
                await modificarHuesos(target.id, guildId, delta, 'admin_set', `Fijado por admin <@${interaction.user.id}>`);
            }

            const embed = basePremium('⚙️ Huesos Fijados', '', COLORES.azul)
                .addFields(
                    { name: '👤 Cazador', value: `<@${target.id}>`, inline: true },
                    { name: '🦴 Saldo anterior', value: `${formatoNum(u.huesos)} 🦴`, inline: true },
                    { name: '🦴 Nuevo saldo', value: `${formatoNum(cantidad)} 🦴`, inline: true }
                );

            await logAdmin(guildId, interaction.user.id, 'Fijar Huesos', `<@${target.id}> fijado a ${formatoNum(cantidad)} 🦴`);
            return interaction.editReply({ embeds: [embed] });
        }

        // ══════ VER USUARIO DETALLADO ══════
        if (sub === 'ver_usuario') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const target = interaction.options.getUser('usuario');
            const u = await obtenerUsuario(target.id, guildId);
            const e = u.estadisticas || {};

            const ultimas = await Transaccion.find({ userId: target.id, guildId }).sort({ fecha: -1 }).limit(10).lean();
            let historial = '';
            if (ultimas.length === 0) {
                historial = '_Sin transacciones_';
            } else {
                ultimas.forEach((tx) => {
                    const signo = tx.monto >= 0 ? '+' : '';
                    historial += `<t:${Math.floor(tx.fecha.getTime() / 1000)}:R> **${signo}${formatoNum(tx.monto)}** 🦴 (${tx.tipo})\n`;
                });
            }

            const embed = basePremium(`🔍 Inspección de <@${target.id}>`, '', COLORES.azul)
                .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 128 }))
                .addFields(
                    { name: '🦴 Saldo', value: `${formatoNum(u.huesos)} huesos`, inline: true },
                    { name: '🔥 Racha', value: `${u.rachaDiaria || 0} día(s)`, inline: true },
                    { name: '📅 Registrado', value: `<t:${Math.floor(u.createdAt.getTime() / 1000)}:D>`, inline: true },
                    { name: '🏹 Cacerías', value: `${e.cazados || 0}`, inline: true },
                    { name: '🎁 Diarios', value: `${e.diarios || 0}`, inline: true },
                    { name: '🎰 Apostado', value: `${formatoNum(e.apostado || 0)} 🦴`, inline: true },
                    { name: '💰 Ganado', value: `${formatoNum(e.ganado || 0)} 🦴`, inline: true },
                    { name: '💸 Perdido', value: `${formatoNum(e.perdido || 0)} 🦴`, inline: true },
                    { name: '⚔️ Duelos', value: `${e.duelosGanados || 0}V / ${e.duelosPerdidos || 0}D`, inline: true },
                    { name: '🕵️ Robos', value: `✅${e.robosExitosos || 0} ❌${e.robosFallidos || 0} 🎯${e.vecesRobado || 0}`, inline: true },
                    { name: '🎒 Inventario', value: (u.inventario || []).length > 0
                        ? u.inventario.map((i) => `${i.itemId} x${i.cantidad}`).join(', ')
                        : '_Vacío_', inline: false },
                    { name: '📜 Últimas Transacciones', value: historial.slice(0, 1024), inline: false }
                );

            return interaction.editReply({ embeds: [embed] });
        }

        // ══════ CONFIGURAR CANALES (UNIFICADO) ══════
        if (sub === 'canal') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const tipo = interaction.options.getString('tipo');
            const canal = interaction.options.getChannel('canal');

            if (tipo === 'eventos') {
                await ConfigEvento.findOneAndUpdate({ guildId }, { $set: { canalEventosId: canal.id } }, { upsert: true, new: true });
                await logAdmin(guildId, interaction.user.id, 'Canal Eventos', `Configurado: <#${canal.id}>`);
                return interaction.editReply({ embeds: [basePremium('✅ Canal de Eventos Configurado', `Los eventos comunitarios aparecerán en <#${canal.id}>.`, COLORES.verde)] });
            }

            if (tipo === 'salon_fama') {
                await ConfigEvento.findOneAndUpdate({ guildId }, { $set: { canalSalonFamaId: canal.id, mensajeSalonFamaId: null } }, { upsert: true, new: true });
                await logAdmin(guildId, interaction.user.id, 'Canal Ranking', `Configurado: <#${canal.id}>`);
                return interaction.editReply({ embeds: [basePremium('✅ Canal de Ranking Configurado', `El ranking en vivo se publicará en <#${canal.id}>.\nSe actualizará automáticamente cada 5 minutos.`, COLORES.verde)] });
            }

            if (tipo === 'logs') {
                await ConfigEvento.findOneAndUpdate({ guildId }, { $set: { canalLogsId: canal.id } }, { upsert: true, new: true });
                const { protegerCanalSoloLectura } = require('../services/canalCripta');
                await protegerCanalSoloLectura(canal, client);
                await logAdmin(guildId, interaction.user.id, 'Canal Logs', `Configurado: <#${canal.id}>`);
                return interaction.editReply({ embeds: [basePremium('✅ Canal de Logs Configurado', `Todos los logs de moderación y actividad se registrarán en <#${canal.id}>.`, COLORES.verde)] });
            }

            if (tipo === 'musica') {
                const { configurarCanalMusica } = require('../services/canalMusica');
                await configurarCanalMusica(interaction.guildId, canal.id, client);
                return interaction.editReply({ embeds: [basePremium('✅ Canal de Música Configurado', `El reproductor maestro en vivo ha sido fijado en ${canal}.`, COLORES.verde)] });
            }

            if (tipo === 'stickers') {
                await ConfigEvento.findOneAndUpdate({ guildId }, { $set: { canalStickersId: canal.id } }, { upsert: true, new: true });
                await logAdmin(guildId, interaction.user.id, 'Canal Bóveda Stickers', `Configurado: <#${canal.id}>`);
                return interaction.editReply({ embeds: [basePremium('✅ Bóveda de Stickers Configurada', `Los stickers y emojis robados se guardarán y archivarán en <#${canal.id}>.`, COLORES.verde)] });
            }

            if (tipo === 'anuncios') {
                await ConfigEvento.findOneAndUpdate({ guildId }, { $set: { canalAnunciosId: canal.id } }, { upsert: true, new: true });
                await logAdmin(guildId, interaction.user.id, 'Canal Anuncios', `Configurado: <#${canal.id}>`);
                return interaction.editReply({ embeds: [basePremium('✅ Canal de Anuncios Configurado', `Los anuncios administrativos se publicarán en <#${canal.id}>.`, COLORES.verde)] });
            }

            if (tipo === 'cripta') {
                const { configurarCanalCripta } = require('../services/canalCripta');
                await configurarCanalCripta(interaction.guildId, canal.id, client);
                return interaction.editReply({
                    embeds: [basePremium(
                        '✅ Canal Interactivo de La Cripta Configurado',
                        `El centro de mando interactivo con ranking en vivo ha sido fijado en ${canal}.\n` +
                        '• **Ranking en vivo:** El Top 10 se muestra arriba y se actualiza en tiempo real.\n' +
                        '• **Botones:** Los usuarios juegan interactuando directamente con los botones sin escribir comandos.\n' +
                        '• **Canal Limpio:** Todo mensaje de texto se elimina para mantener el panel siempre limpio.',
                        COLORES.verde
                    )],
                });
            }

            if (tipo === 'logs_publicos') {
                await ConfigEvento.findOneAndUpdate({ guildId }, { $set: { canalLogsPublicosId: canal.id } }, { upsert: true, new: true });
                const { protegerCanalSoloLectura } = require('../services/canalCripta');
                await protegerCanalSoloLectura(canal, client);
                await logAdmin(guildId, interaction.user.id, 'Canal Logs Públicos', `Configurado: <#${canal.id}>`);
                return interaction.editReply({
                    embeds: [basePremium(
                        '✅ Canal de Logs Públicos Configurado',
                        `El canal <#${canal.id}> registrará públicamente todas las cacerías, apuestas, duelos, diarios y eventos en tiempo real para máxima transparencia.`,
                        COLORES.verde
                    )],
                });
            }

            if (tipo === 'panel') {
                const { configurarCanalAdminPanel } = require('../services/panelAdmin');
                await configurarCanalAdminPanel(interaction.guildId, canal.id, client);
                return interaction.editReply({
                    embeds: [basePremium(
                        '✅ Panel Permanente de Administración Configurado',
                        `El centro de mando interactivo de administración y moderación ha sido fijado en ${canal}.`,
                        COLORES.morado
                    )],
                });
            }

            if (tipo === 'cumpleanos') {
                await ConfigEvento.findOneAndUpdate({ guildId }, { $set: { canalCumpleanosId: canal.id } }, { upsert: true, new: true });
                await logAdmin(guildId, interaction.user.id, 'Canal Cumpleaños', `Configurado: <#${canal.id}>`);
                return interaction.editReply({ embeds: [basePremium('✅ Canal de Cumpleaños Configurado', `Las celebraciones de cumpleaños se publicarán en <#${canal.id}>.`, COLORES.verde)] });
            }
        }

        if (sub === 'rol_alertas') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const rol = interaction.options.getRole('rol');
            await ConfigEvento.findOneAndUpdate({ guildId }, { $set: { rolNotificacionesEventoId: rol.id } }, { upsert: true, new: true });
            await logAdmin(guildId, interaction.user.id, 'Rol Alertas Halloween', `Configurado: <@&${rol.id}>`);
            return interaction.editReply({
                embeds: [basePremium('✅ Rol de Alertas de Halloween Configurado', `Los miembros con el rol <@&${rol.id}> recibirán menciones automáticas cada vez que surja una trivia o evento especial.`, COLORES.verde)],
            });
        }

        if (sub === 'rol_tester') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const rol = interaction.options.getRole('rol');
            await ConfigEvento.findOneAndUpdate({ guildId }, { $set: { rolTesterId: rol.id } }, { upsert: true, new: true });
            await logAdmin(guildId, interaction.user.id, 'Rol Tester Configurado', `Configurado: <@&${rol.id}>`);
            const { solicitarActualizacionAdminPanel } = require('../services/panelAdmin');
            solicitarActualizacionAdminPanel(guildId);
            return interaction.editReply({
                embeds: [basePremium('✅ Rol Tester Configurado', `Los miembros con el rol <@&${rol.id}> podrán participar e interactuar en La Cripta incluso cuando esté en pausa o mantenimiento.`, COLORES.verde)],
            });
        }

        if (sub === 'tester_usuario') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const accion = interaction.options.getString('accion');
            const targetUser = interaction.options.getUser('usuario');
            const conf = await ConfigEvento.findOne({ guildId });
            if (!conf) {
                return interaction.editReply({ content: '❌ No hay configuración del evento para este servidor.' });
            }

            if (!conf.testersIds) conf.testersIds = [];

            if (accion === 'add') {
                if (conf.testersIds.includes(targetUser.id)) {
                    return interaction.editReply({ content: `⚠️ <@${targetUser.id}> ya está en la lista de testers autorizados.` });
                }
                conf.testersIds.push(targetUser.id);
                await conf.save();
                await logAdmin(guildId, interaction.user.id, 'Tester Usuario Agregado', `Usuario: <@${targetUser.id}>`);
                const { solicitarActualizacionAdminPanel } = require('../services/panelAdmin');
                solicitarActualizacionAdminPanel(guildId);
                return interaction.editReply({
                    embeds: [basePremium('✅ Tester Usuario Asignado', `<@${targetUser.id}> ahora puede participar y probar La Cripta durante mantenimiento.`, COLORES.verde)],
                });
            } else {
                conf.testersIds = conf.testersIds.filter(id => id !== targetUser.id);
                await conf.save();
                await logAdmin(guildId, interaction.user.id, 'Tester Usuario Removido', `Usuario: <@${targetUser.id}>`);
                const { solicitarActualizacionAdminPanel } = require('../services/panelAdmin');
                solicitarActualizacionAdminPanel(guildId);
                return interaction.editReply({
                    embeds: [basePremium('✅ Tester Usuario Revocado', `<@${targetUser.id}> ya no tiene permisos de tester durante mantenimiento.`, COLORES.rojo)],
                });
            }
        }

        if (sub === 'canal_cumpleanos') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const canal = interaction.options.getChannel('canal');
            const { configurarCanalCumpleanos } = require('../services/cumpleanos');
            await configurarCanalCumpleanos(interaction.guildId, canal.id, client);
            return interaction.editReply({
                embeds: [basePremium('✅ Panel Maestro de Cumpleaños Configurado', `El panel permanente con los 10 cumpleaños más cercanos en vivo ha sido fijado en ${canal}.`, COLORES.verde)],
            });
        }

        if (sub === 'rol_cumpleanos') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const rol = interaction.options.getRole('rol');
            await ConfigEvento.findOneAndUpdate({ guildId }, { $set: { rolCumpleanosId: rol.id } }, { upsert: true, new: true });
            return interaction.editReply({
                embeds: [basePremium('✅ Rol de Cumpleaños Configurado', `El rol <@&${rol.id}> será asignado automáticamente al cumpleañero en su día.`, COLORES.verde)],
            });
        }

        // ══════ PANEL INTERACTIVO DE ADMINISTRACIÓN ══════
        if (sub === 'panel') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const { construirPanelAdmin } = require('../services/panelAdmin');
            const panel = await construirPanelAdmin(guildId);
            return interaction.editReply(panel);
        }

        // ══════ VER CONFIGURACIÓN ══════
        if (sub === 'ver_config') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const config = await ConfigEvento.findOne({ guildId }).lean();

            const formatCanal = (id) => id ? `<#${id}> ✅` : '❌ No configurado';

            const totalUsuarios = await Usuario.countDocuments({ guildId });
            const totalTransacciones = await Transaccion.countDocuments({ guildId });

            const embed = basePremium('⚙️ Configuración del Servidor', '', COLORES.azul)
                .addFields(
                    { name: '━━━ 📡 Canales Configurados ━━━', value: '\u200B', inline: false },
                    { name: '🎃 Eventos', value: formatCanal(config?.canalEventosId), inline: true },
                    { name: '🏰 Panel Cripta', value: formatCanal(config?.canalCriptaId), inline: true },
                    { name: '🎂 Cumpleaños', value: formatCanal(config?.canalCumpleanosId), inline: true },
                    { name: '📢 Logs Públicos', value: formatCanal(config?.canalLogsPublicosId), inline: true },
                    { name: '🛡️ Logs Admin', value: formatCanal(config?.canalLogsId), inline: true },
                    { name: '🏆 Ranking/Fama', value: formatCanal(config?.canalSalonFamaId), inline: true },
                    { name: '📢 Anuncios', value: formatCanal(config?.canalAnunciosId), inline: true },
                    { name: '🔔 Alertas Halloween', value: config?.rolNotificacionesEventoId ? `<@&${config.rolNotificacionesEventoId}>` : '⚪ Auto (por botón)', inline: true },
                    { name: '🎂 Alertas Cumpleaños', value: config?.rolNotificacionesCumpleId ? `<@&${config.rolNotificacionesCumpleId}>` : '⚪ Auto (por botón)', inline: true },
                    { name: '🎂 Rol Cumpleañero', value: config?.rolCumpleanosId ? `<@&${config.rolCumpleanosId}>` : '⚪ Auto-creable', inline: true },
                    { name: '━━━ 🧪 Modo de Pruebas ━━━', value: '\u200B', inline: false },
                    { name: '🧪 Modo Test', value: config?.modoTest ? '🟢 Activado' : '⚪ Desactivado', inline: true },
                    { name: '🔬 Canal de Pruebas', value: formatCanal(config?.canalTestId), inline: true },
                    { name: '🧪 Rol Tester', value: config?.rolTesterId ? `<@&${config.rolTesterId}>` : '❌ No configurado', inline: true },
                    { name: '🔬 Testers Asignados', value: (config?.testersIds && config.testersIds.length > 0) ? config.testersIds.map(id => `<@${id}>`).join(', ') : 'Ninguno', inline: true },
                    { name: '━━━ 📊 Estado del Evento ━━━', value: '\u200B', inline: false },
                    { name: '📌 Estado', value: config?.estado === 'activo' ? '🟢 Activo' : '🔴 Finalizado', inline: true },
                    { name: '⏳ Cierre', value: config?.fechaCierre ? `<t:${Math.floor(config.fechaCierre.getTime() / 1000)}:R>` : 'No definido', inline: true },
                    { name: '⚡ Multiplicador', value: config?.multiplicador > 1 ? `x${config.multiplicador}` : 'x1 (normal)', inline: true },
                    { name: '━━━ 📈 Estadísticas ━━━', value: '\u200B', inline: false },
                    { name: '👥 Cazadores', value: `${totalUsuarios}`, inline: true },
                    { name: '📜 Transacciones', value: `${formatoNum(totalTransacciones)}`, inline: true }
                );

            return interaction.editReply({ embeds: [embed] });
        }

        // ══════ EVENTO MANUAL ══════
        if (sub === 'evento') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const tipo = interaction.options.getString('tipo');
            const targetUser = interaction.options.getUser('usuario');

            const conf = await ConfigEvento.findOne({ guildId });
            const canalDestinoId = (conf?.modoTest && conf?.canalTestId) ? conf.canalTestId : conf?.canalEventosId;
            if (!conf || !canalDestinoId) {
                return interaction.editReply({ content: '⚠️ Primero configura el canal de eventos o el canal de pruebas: `/admin modo_test` o `/admin canal_eventos`.' });
            }

            let victimaObjetivoId = null;
            if (tipo === 'oogie_boogie') {
                victimaObjetivoId = targetUser ? targetUser.id : interaction.user.id;
            }

            const res = await forzarEvento(guildId, client, tipo, victimaObjetivoId);
            if (!res) {
                return interaction.editReply({ content: '❌ No se pudo disparar el evento.' });
            }

            const avisoTest = conf.modoTest ? ' *(🧪 Lanzado en Canal de Pruebas)*' : '';
            const detalleVictima = (tipo === 'oogie_boogie' && victimaObjetivoId) ? ` contra <@${victimaObjetivoId}>` : '';
            await logAdmin(guildId, interaction.user.id, 'Evento Manual', `Evento **${tipo}** lanzado en <#${canalDestinoId}>${detalleVictima}${avisoTest}`);
            const embed = basePremium('✅ Evento Disparado', `Evento **${tipo}** lanzado en <#${canalDestinoId}>${detalleVictima}.${avisoTest}`, COLORES.verde);
            return interaction.editReply({ embeds: [embed] });
        }

        // ══════ MULTIPLICADOR ══════
        if (sub === 'multiplicador') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const factor = interaction.options.getInteger('factor');
            const minutos = interaction.options.getInteger('minutos') || 30;

            await activarMultiplicadorGlobal(guildId, client, minutos, factor);
            await logAdmin(guildId, interaction.user.id, 'Multiplicador', `x${factor} por ${minutos} minutos`);
            const embed = basePremium('⚡ Multiplicador Activado', `Factor **x${factor}** activo durante **${minutos}** minutos.\nTodas las ganancias de caza se multiplican.`, COLORES.dorado);
            return interaction.editReply({ embeds: [embed] });
        }

        // ══════ TRANSACCIONES ══════
        if (sub === 'transacciones') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const filtroUser = interaction.options.getUser('usuario');
            const cantidadOpt = interaction.options.getInteger('cantidad') || 15;
            const query = { guildId };
            if (filtroUser) query.userId = filtroUser.id;

            const lista = await Transaccion.find(query).sort({ fecha: -1 }).limit(cantidadOpt).lean();

            let desc = '';
            if (lista.length === 0) {
                desc = '_No hay transacciones registradas._';
            } else {
                lista.forEach((tx) => {
                    const signo = tx.monto >= 0 ? '+' : '';
                    const emoji = tx.monto >= 0 ? '🟢' : '🔴';
                    desc += `${emoji} <t:${Math.floor(tx.fecha.getTime() / 1000)}:R> <@${tx.userId}> **${signo}${formatoNum(tx.monto)}** 🦴\n   └ ${tx.tipo}: ${tx.detalle || '—'}\n`;
                });
            }

            const tituloTx = filtroUser ? `📜 Transacciones de <@${filtroUser.id}>` : '📜 Transacciones Recientes';
            const embed = basePremium(tituloTx, desc.slice(0, 4000), COLORES.morado);
            return interaction.editReply({ embeds: [embed] });
        }

        // ══════ ANUNCIAR ══════
        if (sub === 'anunciar') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const titulo = interaction.options.getString('titulo');
            const mensaje = interaction.options.getString('mensaje');
            const colorKey = interaction.options.getString('color') || 'naranja';

            const conf = await ConfigEvento.findOne({ guildId });
            const canalId = conf?.canalAnunciosId || conf?.canalEventosId;
            if (!canalId) {
                return interaction.editReply({ content: '⚠️ Configura el canal de anuncios primero: `/admin canal_anuncios`.' });
            }

            const canal = client.channels.cache.get(canalId) || await client.channels.fetch(canalId).catch(() => null);
            if (!canal) {
                return interaction.editReply({ content: '❌ No se pudo acceder al canal de anuncios.' });
            }

            const embed = basePremium(`📢 ${titulo}`, mensaje, COLORES[colorKey] || COLORES.naranja)
                .setAuthor({ name: `Anuncio de ${interaction.user.displayName}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });

            await canal.send({ embeds: [embed] });
            await logAdmin(guildId, interaction.user.id, 'Anuncio', `"${titulo}" publicado en <#${canalId}>`);

            return interaction.editReply({ content: `✅ Anuncio publicado en <#${canalId}>.` });
        }

        // ══════ CERRAR EVENTO ══════
        if (sub === 'cerrar_evento') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            await ConfigEvento.findOneAndUpdate({ guildId }, { $set: { fechaCierre: new Date() } });
            const cerrado = await verificarYCerrarEvento(guildId, client);
            await logAdmin(guildId, interaction.user.id, 'Cerrar Evento', 'Cierre forzado del evento.');
            const embed = basePremium(
                cerrado ? '🕯️ Evento Cerrado' : '⚠️ Ya Finalizado',
                cerrado ? 'El evento ha sido cerrado y los ganadores han sido proclamados.' : 'El evento ya se encontraba finalizado.',
                cerrado ? COLORES.verde : COLORES.naranja
            );
            return interaction.editReply({ embeds: [embed] });
        }

        // ══════ RESET ECONOMÍA ══════
        if (sub === 'reset_economia') {
            const embedAlerta = basePremium(
                '⚠️ PELIGRO: REINICIO TOTAL',
                '**¿Estás seguro de que deseas borrar TODOS los datos económicos?**\n\n' +
                '🔸 Se borrarán todos los huesos\n' +
                '🔸 Se borrarán todas las estadísticas\n' +
                '🔸 Se borrarán todos los inventarios\n' +
                '🔸 Se borrarán todas las transacciones\n\n' +
                '⚠️ **Esta acción es IRREVERSIBLE.**',
                COLORES.rojo
            );

            const fila = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`admin:reset_confirmar:${interaction.user.id}`)
                    .setLabel('CONFIRMAR REINICIO TOTAL')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('💣'),
                new ButtonBuilder()
                    .setCustomId(`admin:reset_cancelar:${interaction.user.id}`)
                    .setLabel('Cancelar')
                    .setStyle(ButtonStyle.Secondary)
            );

            return interaction.reply({ embeds: [embedAlerta], components: [fila], flags: MessageFlags.Ephemeral });
        }

        // ══════ MODO TEST ══════
        if (sub === 'modo_test') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const activar = interaction.options.getBoolean('activar');
            const canalTest = interaction.options.getChannel('canal_test');

            const { alternarModoTest } = require('../services/evento');
            const conf = await alternarModoTest(guildId, activar, canalTest ? canalTest.id : null);

            const estadoStr = activar ? '🟢 **ACTIVADO**' : '🔴 **DESACTIVADO**';
            const canalStr = conf.canalTestId ? `<#${conf.canalTestId}>` : '_Ninguno específico (usa el canal de eventos configurado)_';

            const embed = basePremium(
                '🧪 Configuración de Modo Test (Pruebas)',
                `El modo de pruebas del evento ha sido actualizado:\n\n` +
                `• **Estado del Modo Test:** ${estadoStr}\n` +
                `• **Canal de Pruebas:** ${canalStr}\n\n` +
                (activar
                    ? '🔒 **Efecto de Aislamiento Activo:**\n' +
                      '• Solo usuarios administradores pueden interactuar con `/cripta`, `/duelo` y botones del evento.\n' +
                      '• Los miembros comunes verán un aviso de que el evento está en pruebas/mantenimiento.\n' +
                      '• Las apariciones (fantasmas, huesos, trivias) ocurrirán **únicamente en el canal de pruebas**.\n' +
                      '• Las recompensas pasivas de chat y voz quedan pausadas para no alterar la economía.\n' +
                      '• *El resto de funciones del bot (música, comandos de moderación) siguen activas para todos sin interrupciones.*'
                    : '🎉 **Efecto Público:**\n' +
                      '• El evento vuelve a estar abierto y activo para todos los cazadores del servidor.'),
                activar ? COLORES.naranja : COLORES.verde
            );

            await logAdmin(guildId, interaction.user.id, 'Modo Test', `${activar ? 'Activado' : 'Desactivado'} — Canal: ${conf.canalTestId || 'Ninguno'}`);

            return interaction.editReply({ embeds: [embed] });
        }
    },
};

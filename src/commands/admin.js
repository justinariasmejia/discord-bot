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
const { base, basePremium, COLORES, formatoNum, SEPARADOR, SEPARADOR_FINO } = require('../utils/embeds');
const { logAdmin } = require('../services/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Panel de administración de La Cripta de los Huesos')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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
        // ── Configurar Canales ──
        .addSubcommand((sub) =>
            sub
                .setName('canal_eventos')
                .setDescription('Canal donde aparecen los eventos comunitarios')
                .addChannelOption((opt) => opt.setName('canal').setDescription('Canal de texto').setRequired(true).addChannelTypes(ChannelType.GuildText))
        )
        .addSubcommand((sub) =>
            sub
                .setName('canal_salon_fama')
                .setDescription('Canal para el Ranking/Salón de la Fama en vivo')
                .addChannelOption((opt) => opt.setName('canal').setDescription('Canal de texto').setRequired(true).addChannelTypes(ChannelType.GuildText))
        )
        .addSubcommand((sub) =>
            sub
                .setName('canal_logs')
                .setDescription('Canal donde se registrarán todos los logs de actividad')
                .addChannelOption((opt) => opt.setName('canal').setDescription('Canal de texto').setRequired(true).addChannelTypes(ChannelType.GuildText))
        )
        .addSubcommand((sub) =>
            sub
                .setName('canal_anuncios')
                .setDescription('Canal para anuncios de administración')
                .addChannelOption((opt) => opt.setName('canal').setDescription('Canal de texto').setRequired(true).addChannelTypes(ChannelType.GuildText))
        )
        .addSubcommand((sub) =>
            sub
                .setName('canal_musica')
                .setDescription('Canal dedicado para el reproductor interactivo en vivo')
                .addChannelOption((opt) => opt.setName('canal').setDescription('Canal de texto').setRequired(true).addChannelTypes(ChannelType.GuildText))
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
                            { name: '🌕 Eclipse Espectral (x2)', value: 'eclipse_2x' }
                        )
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
        ),

    async ejecutar(interaction, client) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

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

        // ══════ CONFIGURAR CANALES ══════
        if (sub === 'canal_eventos') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const canal = interaction.options.getChannel('canal');
            await ConfigEvento.findOneAndUpdate({ guildId }, { $set: { canalEventosId: canal.id } }, { upsert: true, new: true });
            await logAdmin(guildId, interaction.user.id, 'Canal Eventos', `Configurado: <#${canal.id}>`);
            const embed = basePremium('✅ Canal de Eventos Configurado', `Los eventos aleatorios comunitarios aparecerán en <#${canal.id}>.`, COLORES.verde);
            return interaction.editReply({ embeds: [embed] });
        }

        if (sub === 'canal_salon_fama') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const canal = interaction.options.getChannel('canal');
            await ConfigEvento.findOneAndUpdate({ guildId }, { $set: { canalSalonFamaId: canal.id, mensajeSalonFamaId: null } }, { upsert: true, new: true });
            await logAdmin(guildId, interaction.user.id, 'Canal Ranking', `Configurado: <#${canal.id}>`);
            const embed = basePremium('✅ Canal de Ranking Configurado', `El ranking en vivo (Top 5) se publicará en <#${canal.id}>.\nSe actualizará automáticamente cada 5 minutos.`, COLORES.verde);
            return interaction.editReply({ embeds: [embed] });
        }

        if (sub === 'canal_logs') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const canal = interaction.options.getChannel('canal');
            await ConfigEvento.findOneAndUpdate({ guildId }, { $set: { canalLogsId: canal.id } }, { upsert: true, new: true });
            await logAdmin(guildId, interaction.user.id, 'Canal Logs', `Configurado: <#${canal.id}>`);
            const embed = basePremium('✅ Canal de Logs Configurado', `Todas las acciones (caza, apuestas, robos, duelos, compras, admin) se registrarán en <#${canal.id}>.`, COLORES.verde);
            return interaction.editReply({ embeds: [embed] });
        }

        if (sub === 'canal_musica') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const canal = interaction.options.getChannel('canal');
            const { configurarCanalMusica } = require('../services/canalMusica');
            await configurarCanalMusica(interaction.guildId, canal.id, client);
            return interaction.editReply({
                embeds: [basePremium('✅ Canal de Música Configurado', `El reproductor maestro en vivo ha sido fijado en ${canal}.`, COLORES.verde)],
            });
        }

        if (sub === 'canal_anuncios') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const canal = interaction.options.getChannel('canal');
            await ConfigEvento.findOneAndUpdate({ guildId }, { $set: { canalAnunciosId: canal.id } }, { upsert: true, new: true });
            await logAdmin(guildId, interaction.user.id, 'Canal Anuncios', `Configurado: <#${canal.id}>`);
            const embed = basePremium('✅ Canal de Anuncios Configurado', `Los anuncios administrativos se publicarán en <#${canal.id}>.`, COLORES.verde);
            return interaction.editReply({ embeds: [embed] });
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
                    { name: '🏆 Ranking/Fama', value: formatCanal(config?.canalSalonFamaId), inline: true },
                    { name: '📋 Logs', value: formatCanal(config?.canalLogsId), inline: true },
                    { name: '📢 Anuncios', value: formatCanal(config?.canalAnunciosId), inline: true },
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

            const conf = await ConfigEvento.findOne({ guildId });
            if (!conf || !conf.canalEventosId) {
                return interaction.editReply({ content: '⚠️ Primero configura el canal de eventos: `/admin canal_eventos`.' });
            }

            const res = await forzarEvento(guildId, client, tipo);
            if (!res) {
                return interaction.editReply({ content: '❌ No se pudo disparar el evento.' });
            }

            await logAdmin(guildId, interaction.user.id, 'Evento Manual', `Evento **${tipo}** lanzado en <#${conf.canalEventosId}>`);
            const embed = basePremium('✅ Evento Disparado', `Evento **${tipo}** lanzado en <#${conf.canalEventosId}>.`, COLORES.verde);
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
    },
};

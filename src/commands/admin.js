// src/commands/admin.js
// Panel de administración de "La Cripta de los Huesos"
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} = require('discord.js');
const ConfigEvento = require('../models/ConfigEvento');
const Transaccion = require('../models/Transaccion');
const Usuario = require('../models/Usuario');
const { modificarHuesos, obtenerUsuario } = require('../services/economia');
const { forzarEvento, activarMultiplicadorGlobal } = require('../services/eventos-aleatorios');
const { verificarYCerrarEvento } = require('../services/cierre');
const { base, COLORES, formatoNum } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Comandos administrativos para La Cripta de los Huesos')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand((sub) =>
            sub
                .setName('dar_huesos')
                .setDescription('Otorga huesos a un cazador')
                .addUserOption((opt) => opt.setName('usuario').setDescription('El cazador').setRequired(true))
                .addIntegerOption((opt) => opt.setName('cantidad').setDescription('Cantidad de huesos').setRequired(true).setMinValue(1))
        )
        .addSubcommand((sub) =>
            sub
                .setName('quitar_huesos')
                .setDescription('Remueve huesos a un cazador')
                .addUserOption((opt) => opt.setName('usuario').setDescription('El cazador').setRequired(true))
                .addIntegerOption((opt) => opt.setName('cantidad').setDescription('Cantidad de huesos').setRequired(true).setMinValue(1))
        )
        .addSubcommand((sub) =>
            sub
                .setName('evento')
                .setDescription('Dispara inmediatamente un evento aleatorio en el canal')
                .addStringOption((opt) =>
                    opt
                        .setName('tipo')
                        .setDescription('Tipo de evento')
                        .setRequired(true)
                        .addChoices(
                            { name: '👻 Fantasma Fugaz', value: 'fantasma' },
                            { name: '🎃 Trivia del Terror', value: 'trivia' },
                            { name: '🗝️ Cofre Maldito', value: 'cofre' },
                            { name: '🌕 Eclipse Espectral (x2 por 30m)', value: 'eclipse_2x' }
                        )
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('canal_eventos')
                .setDescription('Configura el canal donde aparecerán los eventos comunitarios')
                .addChannelOption((opt) => opt.setName('canal').setDescription('Canal de texto').setRequired(true))
        )
        .addSubcommand((sub) =>
            sub
                .setName('canal_salon_fama')
                .setDescription('Configura el canal para el Salón de la Fama persistente')
                .addChannelOption((opt) => opt.setName('canal').setDescription('Canal de texto').setRequired(true))
        )
        .addSubcommand((sub) =>
            sub
                .setName('multiplicador')
                .setDescription('Activa un multiplicador temporal para todo el servidor')
                .addIntegerOption((opt) => opt.setName('factor').setDescription('Factor (ej. 2 para x2)').setRequired(true).setMinValue(1).setMaxValue(5))
                .addIntegerOption((opt) => opt.setName('minutos').setDescription('Duración en minutos (por defecto 30)').setMinValue(5).setMaxValue(1440))
        )
        .addSubcommand((sub) =>
            sub
                .setName('transacciones')
                .setDescription('Muestra las últimas transacciones de la economía')
                .addUserOption((opt) => opt.setName('usuario').setDescription('Filtrar por cazador específico'))
        )
        .addSubcommand((sub) =>
            sub
                .setName('cerrar_evento')
                .setDescription('Fuerza el cierre inmediato del evento y proclama los ganadores')
        )
        .addSubcommand((sub) =>
            sub
                .setName('reset_economia')
                .setDescription('Reinicia la economía del servidor (Requiere confirmación de seguridad)')
        ),

    async ejecutar(interaction, client) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        // ── 1. Dar Huesos ──
        if (sub === 'dar_huesos') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const target = interaction.options.getUser('usuario');
            const cantidad = interaction.options.getInteger('cantidad');

            const modificado = await modificarHuesos(
                target.id,
                guildId,
                cantidad,
                'admin_dar',
                `Otorgado por admin <@${interaction.user.id}>`
            );

            const embed = base(
                '🦴 Huesos Otorgados',
                `Se han entregado **+${formatoNum(cantidad)}** huesos a <@${target.id}>.\n` +
                `Nuevo saldo: **${formatoNum(modificado.huesos)}** huesos.`,
                COLORES.verde
            );
            return interaction.editReply({ embeds: [embed] });
        }

        // ── 2. Quitar Huesos ──
        if (sub === 'quitar_huesos') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const target = interaction.options.getUser('usuario');
            const cantidad = interaction.options.getInteger('cantidad');

            const u = await obtenerUsuario(target.id, guildId);
            const cantidadEfectiva = Math.min(cantidad, u.huesos);

            const modificado = await modificarHuesos(
                target.id,
                guildId,
                -cantidadEfectiva,
                'admin_quitar',
                `Removido por admin <@${interaction.user.id}>`
            );

            const embed = base(
                '🦴 Huesos Removidos',
                `Se han descontado **-${formatoNum(cantidadEfectiva)}** huesos a <@${target.id}>.\n` +
                `Nuevo saldo: **${formatoNum(modificado.huesos)}** huesos.`,
                COLORES.rojo
            );
            return interaction.editReply({ embeds: [embed] });
        }

        // ── 3. Disparar Evento Inmediato ──
        if (sub === 'evento') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const tipo = interaction.options.getString('tipo');

            const conf = await ConfigEvento.findOne({ guildId });
            if (!conf || !conf.canalEventosId) {
                return interaction.editReply({
                    content: '⚠️ Primero debes configurar el canal de eventos usando `/admin canal_eventos`.',
                });
            }

            const res = await forzarEvento(guildId, client, tipo);
            if (!res) {
                return interaction.editReply({
                    content: '❌ No se pudo disparar el evento. Verifica que el canal de eventos sea accesible.',
                });
            }

            return interaction.editReply({
                content: `✅ Evento **${tipo}** lanzado exitosamente en <#${conf.canalEventosId}>.`,
            });
        }

        // ── 4. Configurar Canal de Eventos ──
        if (sub === 'canal_eventos') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const canal = interaction.options.getChannel('canal');

            await ConfigEvento.findOneAndUpdate(
                { guildId },
                { $set: { canalEventosId: canal.id } },
                { upsert: true, new: true }
            );

            return interaction.editReply({
                content: `✅ Canal de eventos configurado en <#${canal.id}>.`,
            });
        }

        // ── 5. Configurar Canal del Salón de la Fama ──
        if (sub === 'canal_salon_fama') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const canal = interaction.options.getChannel('canal');

            await ConfigEvento.findOneAndUpdate(
                { guildId },
                { $set: { canalSalonFamaId: canal.id, mensajeSalonFamaId: null } },
                { upsert: true, new: true }
            );

            return interaction.editReply({
                content: `✅ Canal del Salón de la Fama configurado en <#${canal.id}>. El panel se publicará en el próximo ciclo de actualización.`,
            });
        }

        // ── 6. Multiplicador ──
        if (sub === 'multiplicador') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const factor = interaction.options.getInteger('factor');
            const minutos = interaction.options.getInteger('minutos') || 30;

            const res = await activarMultiplicadorGlobal(guildId, client, minutos, factor);
            return interaction.editReply({
                content: `✅ Multiplicador **x${factor}** activado durante **${minutos}** minutos.`,
            });
        }

        // ── 7. Transacciones Recientes ──
        if (sub === 'transacciones') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const filtroUser = interaction.options.getUser('usuario');
            const query = { guildId };
            if (filtroUser) query.userId = filtroUser.id;

            const lista = await Transaccion.find(query).sort({ fecha: -1 }).limit(15).lean();

            let desc = '';
            if (lista.length === 0) {
                desc = '_No hay transacciones registradas._';
            } else {
                lista.forEach((tx) => {
                    const signo = tx.monto >= 0 ? '+' : '';
                    desc += `• <t:${Math.floor(tx.fecha.getTime() / 1000)}:R> | <@${tx.userId}> | **${signo}${tx.monto}** 🦴 (${tx.tipo}): ${tx.detalle || ''}\n`;
                });
            }

            const embed = base('📜 Últimas Transacciones', desc.slice(0, 4000), COLORES.morado);
            return interaction.editReply({ embeds: [embed] });
        }

        // ── 8. Forzar Cierre ──
        if (sub === 'cerrar_evento') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            // Adelantar fechaCierre a este instante
            await ConfigEvento.findOneAndUpdate(
                { guildId },
                { $set: { fechaCierre: new Date() } }
            );

            const cerrado = await verificarYCerrarEvento(guildId, client);
            return interaction.editReply({
                content: cerrado
                    ? '🕯️ El evento ha sido cerrado y los ganadores han sido proclamados.'
                    : '⚠️ El evento ya se encontraba finalizado previamente.',
            });
        }

        // ── 9. Reinicio de Economía (Doble Confirmación) ──
        if (sub === 'reset_economia') {
            const embedAlerta = base(
                '⚠️ PELIGRO: REINICIO TOTAL DE ECONOMÍA',
                'Estás a punto de **borrar todos los huesos, estadísticas e inventarios** de todos los cazadores de este servidor.\n\n' +
                'Esta acción es completamente irreversible.\n\n' +
                '¿Deseas continuar con el reinicio?',
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

            return interaction.reply({
                embeds: [embedAlerta],
                components: [fila],
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};

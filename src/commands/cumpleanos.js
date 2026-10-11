// src/commands/cumpleanos.js
// Comando de usuario y administración para consultar, registrar y configurar el sistema de cumpleaños.
const {
    SlashCommandBuilder,
    MessageFlags,
} = require('discord.js');
const Cumpleanos = require('../models/Cumpleanos');
const ConfigEvento = require('../models/ConfigEvento');
const {
    MESES_NOMBRES,
    registrarCumpleanos,
    borrarCumpleanos,
    actualizarPanelCumpleanos,
    obtenerProximosCumpleanos,
    calcularProximidad,
} = require('../services/cumpleanos');
const { esAdminAsync } = require('../services/evento');
const { basePremium, COLORES } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cumpleanos')
        .setDescription('🎂 Sistema de cumpleaños y calendario de celebraciones')
        // ── Registrar ──
        .addSubcommand((sub) =>
            sub
                .setName('registrar')
                .setDescription('Registra tu fecha de cumpleaños')
                .addIntegerOption((opt) =>
                    opt.setName('dia').setDescription('Día de nacimiento (1 al 31)').setRequired(true).setMinValue(1).setMaxValue(31)
                )
                .addIntegerOption((opt) =>
                    opt.setName('mes').setDescription('Mes de nacimiento (1 al 12)').setRequired(true).setMinValue(1).setMaxValue(12)
                )
                .addIntegerOption((opt) =>
                    opt.setName('anio').setDescription('Año de nacimiento (opcional)').setRequired(false).setMinValue(1920).setMaxValue(new Date().getFullYear())
                )
        )
        // ── Ver Próximos ──
        .addSubcommand((sub) =>
            sub
                .setName('proximos')
                .setDescription('Muestra los 10 cumpleaños más cercanos del servidor')
        )
        // ── Ver Usuario ──
        .addSubcommand((sub) =>
            sub
                .setName('ver')
                .setDescription('Consulta el cumpleaños de un usuario')
                .addUserOption((opt) => opt.setName('usuario').setDescription('El miembro a consultar').setRequired(false))
        )
        // ── Borrar ──
        .addSubcommand((sub) =>
            sub
                .setName('borrar')
                .setDescription('Elimina tu fecha de cumpleaños registrada')
        )
        // ── Rol de Cumpleañero (Admin) ──
        .addSubcommand((sub) =>
            sub
                .setName('rol')
                .setDescription('Configura el rol que se asignará automáticamente a quien cumpla años')
                .addRoleOption((opt) => opt.setName('rol').setDescription('Rol de cumpleañero').setRequired(true))
        ),

    async ejecutar(interaction, client) {
        const sub = interaction.options.getSubcommand();

        // ── 1. Registrar Cumpleaños ──
        if (sub === 'registrar') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const dia = interaction.options.getInteger('dia');
            const mes = interaction.options.getInteger('mes');
            const anio = interaction.options.getInteger('anio');

            try {
                await registrarCumpleanos(interaction.guildId, interaction.user.id, dia, mes, anio);
                await actualizarPanelCumpleanos(client, interaction.guildId);

                const prox = calcularProximidad(dia, mes);
                const nombreMes = MESES_NOMBRES[mes - 1];
                let detalleProximo = '';
                if (prox.esHoy) detalleProximo = '🎉 **¡Hoy es tu cumpleaños! ¡Felicidades!**';
                else if (prox.esManana) detalleProximo = '⏰ **¡Tu cumpleaños es mañana!**';
                else detalleProximo = `⏳ Faltan **${prox.diasFaltantes} días** para tu próximo cumpleaños.`;

                return interaction.editReply({
                    embeds: [basePremium(
                        '🎂 ¡Cumpleaños Guardado con Éxito!',
                        `📅 **Fecha registrada:** ${dia} de ${nombreMes}${anio ? ` (${anio})` : ''}\n` +
                        `${detalleProximo}\n\n` +
                        `✨ *El panel fijo de los 10 más cercanos ha sido actualizado automáticamente.*`,
                        COLORES.verde
                    )],
                });
            } catch (err) {
                return interaction.editReply({
                    embeds: [basePremium('❌ Error al registrar', err.message, COLORES.rojo)],
                });
            }
        }

        // ── 2. Ver Próximos 10 Cumpleaños ──
        if (sub === 'proximos') {
            await interaction.deferReply();
            const proximos = await obtenerProximosCumpleanos(interaction.guildId, 10);

            if (proximos.length === 0) {
                return interaction.editReply({
                    embeds: [basePremium(
                        '🎂 Próximos Cumpleaños',
                        'Aún no hay cumpleaños registrados en el servidor. Usa `/cumpleanos registrar` o el botón del panel.',
                        '#9b59b6'
                    )],
                });
            }

            let desc = '### 🎈 Los 10 Cumpleaños Más Cercanos\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
            proximos.forEach((c, i) => {
                const nombreMes = MESES_NOMBRES[c.mes - 1];
                let estado = '';
                if (c.esHoy) estado = ' 🎉 **¡HOY!** 🎂';
                else if (c.esManana) estado = ' ⏰ *(¡Mañana!)*';
                else estado = ` *(en ${c.diasFaltantes} días)*`;

                const edadStr = c.anio ? ` • 🎂 \`${new Date().getFullYear() - c.anio} años\`` : '';
                desc += `**#${i + 1}** <@${c.userId}> — **${c.dia} de ${nombreMes}**${edadStr}${estado}\n`;
            });
            desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

            return interaction.editReply({
                embeds: [basePremium('🎂 Calendario de Cumpleaños', desc, '#9b59b6')],
            });
        }

        // ── 3. Ver Cumpleaños de un Usuario ──
        if (sub === 'ver') {
            await interaction.deferReply();
            const objetivo = interaction.options.getUser('usuario') || interaction.user;
            const doc = await Cumpleanos.findOne({ guildId: interaction.guildId, userId: objetivo.id });

            if (!doc) {
                return interaction.editReply({
                    embeds: [basePremium(
                        '🎂 Consulta de Cumpleaños',
                        `${objetivo.id === interaction.user.id ? 'No tienes' : `<@${objetivo.id}> no tiene`} un cumpleaños registrado en este servidor.`,
                        COLORES.morado
                    )],
                });
            }

            const prox = calcularProximidad(doc.dia, doc.mes);
            const nombreMes = MESES_NOMBRES[doc.mes - 1];
            let estado = '';
            if (prox.esHoy) estado = '🎉 **¡ES HOY!** 🎂🎈';
            else if (prox.esManana) estado = '⏰ **¡Es Mañana!**';
            else estado = `⏳ Faltan **${prox.diasFaltantes} días**.`;

            const edadStr = doc.anio ? `\n🎂 **Edad cumplida este año:** ${new Date().getFullYear() - doc.anio} años` : '';

            return interaction.editReply({
                embeds: [basePremium(
                    `🎂 Cumpleaños de ${objetivo.username}`,
                    `👤 **Usuario:** <@${objetivo.id}>\n` +
                    `📅 **Fecha:** ${doc.dia} de ${nombreMes}${doc.anio ? ` de ${doc.anio}` : ''}${edadStr}\n` +
                    `⏱️ **Estado:** ${estado}`,
                    '#9b59b6'
                )],
            });
        }

        // ── 4. Borrar Cumpleaños ──
        if (sub === 'borrar') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const borrado = await borrarCumpleanos(interaction.guildId, interaction.user.id);
            if (!borrado) {
                return interaction.editReply({
                    content: 'ℹ️ No tenías ningún cumpleaños registrado.',
                });
            }

            await actualizarPanelCumpleanos(client, interaction.guildId);
            return interaction.editReply({
                content: '🗑️ Tu cumpleaños ha sido eliminado y el panel ha sido actualizado.',
            });
        }

        // ── 5. Configurar Rol de Cumpleañero (Admin) ──
        if (sub === 'rol') {
            const autorizado = await esAdminAsync(interaction.member, interaction.guildId);
            if (!autorizado) {
                return interaction.reply({
                    content: '🔒 No tienes permisos para configurar el rol de cumpleaños.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const rol = interaction.options.getRole('rol');

            await ConfigEvento.findOneAndUpdate(
                { guildId: interaction.guildId },
                { $set: { rolCumpleanosId: rol.id } },
                { upsert: true }
            );

            return interaction.editReply({
                embeds: [basePremium(
                    '✅ Rol de Cumpleaños Configurado',
                    `El rol <@&${rol.id}> será asignado automáticamente a los miembros en el día de su cumpleaños y retirado al terminar el día.`,
                    COLORES.verde
                )],
            });
        }
    },
};

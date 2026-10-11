// src/interactions/cumpleanos.js
// Manejador interactivo para el registro y gestión de cumpleaños mediante modal y botones.
const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags,
} = require('discord.js');
const {
    MESES_NOMBRES,
    registrarCumpleanos,
    borrarCumpleanos,
    actualizarPanelCumpleanos,
    calcularProximidad,
} = require('../services/cumpleanos');

function parsearMes(mesInput) {
    if (!mesInput) return null;
    const limpio = mesInput.trim().toLowerCase();
    const num = parseInt(limpio, 10);
    if (!isNaN(num) && num >= 1 && num <= 12) return num;

    const indices = {
        ene: 1, enero: 1,
        feb: 2, febrero: 2,
        mar: 3, marzo: 3,
        abr: 4, abril: 4,
        may: 5, mayo: 5,
        jun: 6, junio: 6,
        jul: 7, julio: 7,
        ago: 8, agosto: 8,
        sep: 9, sept: 9, septiembre: 9, setiembre: 9,
        oct: 10, octubre: 10,
        nov: 11, noviembre: 11,
        dic: 12, diciembre: 12,
    };

    return indices[limpio] || null;
}

module.exports = {
    prefijo: 'cumple',

    async ejecutar(interaction, partes) {
        const accion = partes[1];

        // ── 1. Abrir Modal para Registrar Cumpleaños ──
        if (accion === 'modal_abrir') {
            const modal = new ModalBuilder()
                .setCustomId(`cumple:modal_submit:${interaction.user.id}`)
                .setTitle('🎂 Registrar mi Cumpleaños');

            const inputDia = new TextInputBuilder()
                .setCustomId('dia')
                .setLabel('Día de Nacimiento (1 al 31)')
                .setPlaceholder('Ejemplo: 14')
                .setStyle(TextInputStyle.Short)
                .setMinLength(1)
                .setMaxLength(2)
                .setRequired(true);

            const inputMes = new TextInputBuilder()
                .setCustomId('mes')
                .setLabel('Mes de Nacimiento (1 al 12 o Nombre)')
                .setPlaceholder('Ejemplo: 10 o Octubre')
                .setStyle(TextInputStyle.Short)
                .setMinLength(1)
                .setMaxLength(12)
                .setRequired(true);

            const inputAnio = new TextInputBuilder()
                .setCustomId('anio')
                .setLabel('Año de Nacimiento (Opcional)')
                .setPlaceholder('Ejemplo: 2002 (Puedes dejarlo en blanco)')
                .setStyle(TextInputStyle.Short)
                .setMinLength(4)
                .setMaxLength(4)
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(inputDia),
                new ActionRowBuilder().addComponents(inputMes),
                new ActionRowBuilder().addComponents(inputAnio)
            );

            return interaction.showModal(modal);
        }

        // ── 2. Procesar el Modal Enviado ──
        if (accion === 'modal_submit') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const diaStr = interaction.fields.getTextInputValue('dia');
            const mesStr = interaction.fields.getTextInputValue('mes');
            const anioStr = interaction.fields.getTextInputValue('anio') || '';

            const dia = parseInt(diaStr.trim(), 10);
            const mes = parsearMes(mesStr);
            let anio = null;

            if (anioStr.trim()) {
                anio = parseInt(anioStr.trim(), 10);
                const anioActual = new Date().getFullYear();
                if (isNaN(anio) || anio < 1920 || anio > anioActual) {
                    return interaction.editReply({
                        content: `❌ El año ingresado no es válido. Debe ser un año entre 1920 y ${anioActual}.`,
                    });
                }
            }

            if (isNaN(dia) || dia < 1 || dia > 31) {
                return interaction.editReply({
                    content: '❌ El día ingresado no es válido. Debe ser un número del 1 al 31.',
                });
            }

            if (!mes) {
                return interaction.editReply({
                    content: '❌ El mes ingresado no es válido. Ingresa un número del 1 al 12 o el nombre del mes (Ej: Octubre).',
                });
            }

            try {
                await registrarCumpleanos(interaction.guildId, interaction.user.id, dia, mes, anio);
                
                // Actualizar inmediatamente el panel de los 10 más cercanos
                await actualizarPanelCumpleanos(interaction.client, interaction.guildId);

                const prox = calcularProximidad(dia, mes);
                const nombreMes = MESES_NOMBRES[mes - 1];
                let detalleProximo = '';
                if (prox.esHoy) detalleProximo = '🎉 **¡Hoy es tu cumpleaños! ¡Muchas felicidades!**';
                else if (prox.esManana) detalleProximo = '⏰ **¡Tu cumpleaños es mañana!**';
                else detalleProximo = `⏳ Faltan **${prox.diasFaltantes} días** para tu próximo cumpleaños.`;

                return interaction.editReply({
                    content:
                        `✅ **¡Cumpleaños registrado exitosamente!**\n\n` +
                        `📅 **Fecha:** ${dia} de ${nombreMes}${anio ? ` (${anio})` : ''}\n` +
                        `${detalleProximo}\n\n` +
                        `⚡ *El panel de los 10 cumpleaños más cercanos ha sido actualizado en tiempo real.*`,
                });
            } catch (err) {
                return interaction.editReply({
                    content: `❌ Error al guardar tu fecha: ${err.message}`,
                });
            }
        }

        // ── 3. Borrar Cumpleaños ──
        if (accion === 'borrar') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const eliminado = await borrarCumpleanos(interaction.guildId, interaction.user.id);
            if (!eliminado) {
                return interaction.editReply({
                    content: 'ℹ️ No tenías ningún cumpleaños registrado en este servidor.',
                });
            }

            await actualizarPanelCumpleanos(interaction.client, interaction.guildId);
            return interaction.editReply({
                content: '🗑️ Tu fecha de cumpleaños ha sido eliminada con éxito y el panel ha sido actualizado.',
            });
        }

        // ── 4. Refrescar Lista ──
        if (accion === 'refrescar') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            await actualizarPanelCumpleanos(interaction.client, interaction.guildId);
            return interaction.editReply({
                content: '🔄 ¡El panel de cumpleaños ha sido refrescado con éxito!',
            });
        }
    },
};

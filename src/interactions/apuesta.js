// src/interactions/apuesta.js
// Manejador central para las apuestas del casino: animaciones fluidas, modales y botones directos.
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
} = require('discord.js');
const {
    apostarCaraCruz,
    apostarDados,
    apostarRuleta,
    apostarTragamonedas,
    validarApuesta,
    consultarCooldown,
    sincronizarYConsultarCooldown,
} = require('../services/apuestas');
const {
    panelAnimacionApuesta,
    panelResultadoApuesta,
    filaVolver,
} = require('../utils/paneles');
const { obtenerUsuario } = require('../services/economia');
const { logApuesta } = require('../services/logger');
const tiradasEnProgreso = new Set(); // duenoId -> booleano para anti-concurrencia
const { base, COLORES, formatoNum } = require('../utils/embeds');
const config = require('../data/config');

async function responderInicial(interaction, payload) {
    try {
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(payload);
        }
        if (interaction.isButton() || interaction.isAnySelectMenu()) {
            return await interaction.update(payload);
        }
        return await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    } catch {
        try {
            if (interaction.deferred || interaction.replied) {
                return await interaction.editReply(payload);
            }
            return await interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral });
        } catch {
            /* interacción expirada o cerrada por Discord */
        }
    }
}

async function responderFinal(interaction, payload) {
    try {
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(payload);
        }
        return await responderInicial(interaction, payload);
    } catch {
        /* silenciar errores de interacción expirada o cancelada */
    }
}

async function resolverJuego(interaction, duenoId, tipoJuego, monto, extra) {
    // 🛡️ Anti-Spam: Bloquear si ya hay un giro o cálculo activo para este cazador
    if (tiradasEnProgreso.has(duenoId)) {
        return responderInicial(interaction, {
            content: '⏳ Ya tienes una apuesta en proceso. Espera a que termine tu jugada.',
            flags: MessageFlags.Ephemeral,
        });
    }

    // 🛡️ Pre-chequeo de cooldown inteligente con avisos progresivos y bloqueo por fatiga
    const cdPrev = await sincronizarYConsultarCooldown(duenoId, interaction.guildId);
    if (cdPrev.enCooldown) {
        let aviso = '';
        const segs = Math.ceil(cdPrev.restanteMs / 1000);

        if (cdPrev.esSilencioOogie) {
            const unixDesbloqueo = Math.floor((Date.now() + cdPrev.restanteMs) / 1000);
            aviso = `🐛 **¡SILENCIADO POR OOGIE BOOGIE!**\n\n` +
                `> *El Rey de los Bichos ha maldecido tus dados y cerrado tus bolsillos por cobardía o insolencia.*\n\n` +
                `Un enjambre de cucarachas bloquea las mesas de apuestas y no te permitirá jugar.\n\n` +
                `⏳ **La maldición se disipará:** <t:${unixDesbloqueo}:R> *(en aproximadamente ${Math.ceil(cdPrev.restanteMs / 60000)} minutos)*.`;
            const embedCd = base('🎲 Maldición de Oogie Boogie', aviso, COLORES.rojo);
            return responderInicial(interaction, { embeds: [embedCd], components: [filaVolver(duenoId)] });
        } else if (cdPrev.esBloqueoHoras || cdPrev.restanteMs >= 3600000) {
            const unixDesbloqueo = Math.floor((Date.now() + cdPrev.restanteMs) / 1000);
            aviso = `🛑 **BLOQUEO POR FATIGA DE LA CRIPTA (2 HORAS)**\n\n` +
                `> *Has alcanzado el límite máximo de **${cdPrev.tirosSeguidos || 15} apuestas continuas**.*\n\n` +
                `Para evitar ludopatía, spam y proteger tus huesos, las mesas de juego se han sellado para ti.\n\n` +
                `⏳ **Podrás volver a apostar:** <t:${unixDesbloqueo}:R> *(en aproximadamente ${Math.ceil(cdPrev.restanteMs / 3600000)} horas)*.\n\n` +
                `✨ *¡Aprovecha este tiempo para cazar, participar en duelos o responder las Trivias del Terror!*`;
        } else if (cdPrev.tirosSeguidos >= 10) {
            aviso = `🔥 **Máquina Sobrecalentada (${cdPrev.tirosSeguidos} apuestas seguidas)**\n\n` +
                `Debes esperar **${segs}s** para que los carretes se enfríen.\n\n` +
                `⚠️ **Alerta Máxima:** Si alcanzas **15 apuestas consecutivas**, la máquina se **bloqueará por 2 horas**.\n` +
                `💡 *Descansa 15 minutos para reiniciar tu racha a cero.*`;
        } else if (cdPrev.tirosSeguidos >= 5) {
            aviso = `⚠️ **Aviso de Fatiga (${cdPrev.tirosSeguidos} apuestas seguidas)**\n\n` +
                `Estás apostando a un ritmo muy acelerado. Debes esperar **${segs}s** antes de tu siguiente jugada.\n\n` +
                `💡 *Consejo: Si descansas 15 minutos, tu racha volverá a cero.*`;
        } else {
            aviso = `⏳ **Pausa de Enfriamiento:** Debes esperar **${segs}s** antes de tu siguiente apuesta.\n\n` +
                `🦴 *Un ritmo moderado mantiene la economía equilibrada y protege tus huesos.*`;
        }

        const embedCd = base('🎰 Pausa de Enfriamiento de Apuestas', aviso, cdPrev.esBloqueoHoras ? COLORES.rojo : COLORES.morado);
        return responderInicial(interaction, { embeds: [embedCd], components: [filaVolver(duenoId)] });
    }
    tiradasEnProgreso.add(duenoId);
    try {
    if (tipoJuego === 'cara_cruz') {
        await responderInicial(interaction, panelAnimacionApuesta('cara_cruz', { monto, eleccion: extra }));
        await new Promise((r) => setTimeout(r, 2200));
        const res = await apostarCaraCruz(duenoId, interaction.guildId, monto, extra);
        if (res.ok) {
            logApuesta(interaction.guildId, duenoId, res).catch(() => null);
        }
        return responderFinal(interaction, panelResultadoApuesta(duenoId, res, tipoJuego, monto, extra));
    }

    if (tipoJuego === 'tragamonedas') {
        await responderInicial(interaction, panelAnimacionApuesta('tragamonedas', 1));
        await new Promise((r) => setTimeout(r, 900));

        const res = await apostarTragamonedas(duenoId, interaction.guildId, monto);
        if (res.ok && res.carretes) {
            await interaction.editReply(panelAnimacionApuesta('tragamonedas', { s1: res.carretes[0] })).catch(() => null);
            await new Promise((r) => setTimeout(r, 900));
        }

        if (res.ok) {
            logApuesta(interaction.guildId, duenoId, res).catch(() => null);
        }
        return responderFinal(interaction, panelResultadoApuesta(duenoId, res, tipoJuego, monto, extra));
    }

    if (tipoJuego === 'dados') {
        await responderInicial(interaction, panelAnimacionApuesta('dados'));
        await new Promise((r) => setTimeout(r, config.APUESTAS.DELAY_ANIMACION_MS || 1500));

        let tipoTier = 'bajo';
        let valorExtra = null;
        if (extra.startsWith('exacto')) {
            tipoTier = 'exacto';
            valorExtra = extra.split(':')[1] || '7';
        } else if (extra.startsWith('rango2')) {
            tipoTier = 'rango2';
            valorExtra = extra.split(':')[1] || '7';
        } else if (extra === 'alto') {
            tipoTier = 'alto';
        }

        const res = await apostarDados(duenoId, interaction.guildId, monto, tipoTier, valorExtra);
        if (res.ok) {
            logApuesta(interaction.guildId, duenoId, res).catch(() => null);
        }
        return responderFinal(interaction, panelResultadoApuesta(duenoId, res, tipoJuego, monto, extra));
    }

    if (tipoJuego === 'ruleta') {
        const res = await apostarRuleta(duenoId, interaction.guildId, monto, extra);
        if (res.ok) {
            logApuesta(interaction.guildId, duenoId, res).catch(() => null);
        }
        return responderFinal(interaction, panelResultadoApuesta(duenoId, res, tipoJuego, monto, extra));
    }
    } finally {
        tiradasEnProgreso.delete(duenoId);
    }
}

module.exports = {
    prefijo: 'apuesta',

    async ejecutar(interaction, partes) {
        const accion = partes[1];
        const duenoId = partes[2];

        // 🛡️ Seguridad: Evitar que usuarios interactúen con paneles de apuestas ajenos
        if (duenoId && duenoId !== 'todos' && interaction.user.id !== duenoId) {
            return interaction.reply({
                content: '🔒 Esta consola de apuestas le pertenece a otro cazador. Usa `/cripta` para apostar tus propios huesos.',
                flags: MessageFlags.Ephemeral,
            });
        }

        // ── 1. Girar Tragamonedas Directo (1 Clic) ──
        if (accion === 'girar_traga') {
            const montoRaw = partes[3]; // '10', '25', '50', '100', 'todo'
            const usuario = await obtenerUsuario(duenoId, interaction.guildId);
            const val = validarApuesta(usuario, montoRaw);
            if (!val.valida) {
                const embedError = base('❌ Apuesta Inválida', val.motivo, COLORES.rojo);
                return responderInicial(interaction, { embeds: [embedError], components: [filaVolver(duenoId)] });
            }
            return resolverJuego(interaction, duenoId, 'tragamonedas', val.monto, 'none');
        }

        // ── 2. Abrir Modal de Tragamonedas (Monto Personalizado) ──
        if (accion === 'abrir_modal_traga') {
            const modal = new ModalBuilder()
                .setCustomId(`apuesta:modal_traga:${duenoId}`)
                .setTitle('🎰 Tragamonedas • Tu Apuesta');

            const inputMonto = new TextInputBuilder()
                .setCustomId('monto')
                .setLabel('¿Cuántos huesos deseas apostar?')
                .setPlaceholder('Mínimo 10 huesos (o escribe "todo")')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(8);

            modal.addComponents(new ActionRowBuilder().addComponents(inputMonto));
            return interaction.showModal(modal);
        }

        // ── 3. Envío del Modal de Tragamonedas ──
        if (accion === 'modal_traga') {
            const montoStr = interaction.fields.getTextInputValue('monto');
            const usuario = await obtenerUsuario(duenoId, interaction.guildId);
            const val = validarApuesta(usuario, montoStr);
            if (!val.valida) {
                const embedError = base('❌ Apuesta Inválida', val.motivo, COLORES.rojo);
                return responderInicial(interaction, { embeds: [embedError], components: [filaVolver(duenoId)] });
            }
            return resolverJuego(interaction, duenoId, 'tragamonedas', val.monto, 'none');
        }

        // ── 4. Elegir Monto de Cara o Cruz (Botón 1 Clic) ──
        if (accion === 'elegir_cc') {
            const montoRaw = partes[3];
            const usuario = await obtenerUsuario(duenoId, interaction.guildId);
            const val = validarApuesta(usuario, montoRaw);
            if (!val.valida) {
                const embedError = base('❌ Apuesta Inválida', val.motivo, COLORES.rojo);
                return responderInicial(interaction, { embeds: [embedError], components: [filaVolver(duenoId)] });
            }

            const monto = val.monto;
            const embedElegir = base(
                '🪙 Cara o Cruz • Elige tu Lado',
                `🦴 Has seleccionado apostar: **${formatoNum(monto)}** huesos.\n\n` +
                `¿Por cuál te la juegas ante las ánimas del más allá?\n` +
                `• **👤 Cara** (Multiplicador x2.0)\n` +
                `• **✝️ Cruz** (Multiplicador x2.0)\n\n` +
                `_Presiona un botón para lanzar la moneda giratoria:_`,
                COLORES.morado
            );

            const filaElegir = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`apuesta:resolver:${duenoId}:cara_cruz:${monto}:cara`)
                    .setLabel('Apostar a CARA')
                    .setEmoji('👤')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`apuesta:resolver:${duenoId}:cara_cruz:${monto}:cruz`)
                    .setLabel('Apostar a CRUZ')
                    .setEmoji('✝️')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`cripta:sel_juego_btn:${duenoId}:cara_cruz`)
                    .setLabel('Cambiar Monto')
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary)
            );

            return responderInicial(interaction, { embeds: [embedElegir], components: [filaElegir] });
        }

        // ── 5. Abrir Modal de Cara o Cruz (Monto Personalizado) ──
        if (accion === 'abrir_modal_cc') {
            const modal = new ModalBuilder()
                .setCustomId(`apuesta:modal_cc:${duenoId}`)
                .setTitle('🪙 Cara o Cruz • Tu Apuesta');

            const inputMonto = new TextInputBuilder()
                .setCustomId('monto')
                .setLabel('¿Cuántos huesos deseas apostar?')
                .setPlaceholder('Mínimo 10 huesos (o escribe "todo")')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(8);

            modal.addComponents(new ActionRowBuilder().addComponents(inputMonto));
            return interaction.showModal(modal);
        }

        // ── 6. Envío del Modal de Cara o Cruz ──
        if (accion === 'modal_cc') {
            const montoStr = interaction.fields.getTextInputValue('monto');
            const usuario = await obtenerUsuario(duenoId, interaction.guildId);
            const val = validarApuesta(usuario, montoStr);
            if (!val.valida) {
                const embedError = base('❌ Apuesta Inválida', val.motivo, COLORES.rojo);
                return responderInicial(interaction, { embeds: [embedError], components: [filaVolver(duenoId)] });
            }

            const monto = val.monto;
            const embedElegir = base(
                '🪙 Cara o Cruz • Elige tu Lado',
                `🦴 Has seleccionado apostar: **${formatoNum(monto)}** huesos.\n\n` +
                `¿Por cuál te la juegas ante las ánimas del más allá?\n` +
                `• **👤 Cara** (Multiplicador x2.0)\n` +
                `• **✝️ Cruz** (Multiplicador x2.0)\n\n` +
                `_Presiona un botón para lanzar la moneda giratoria:_`,
                COLORES.morado
            );

            const filaElegir = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`apuesta:resolver:${duenoId}:cara_cruz:${monto}:cara`)
                    .setLabel('Apostar a CARA')
                    .setEmoji('👤')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`apuesta:resolver:${duenoId}:cara_cruz:${monto}:cruz`)
                    .setLabel('Apostar a CRUZ')
                    .setEmoji('✝️')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`cripta:sel_juego_btn:${duenoId}:cara_cruz`)
                    .setLabel('Cambiar Monto')
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary)
            );

            return responderInicial(interaction, { embeds: [embedElegir], components: [filaElegir] });
        }

        // ── 7. Botón de Resolución (ej. cara o cruz tras elegir lado) ──
        if (accion === 'resolver') {
            const tipoJuego = partes[3];
            const monto = parseInt(partes[4], 10);
            const extra = partes[5] || 'cara';
            return resolverJuego(interaction, duenoId, tipoJuego, monto, extra);
        }

        // ── 8. Botón Apostar de nuevo ──
        if (accion === 'repetir') {
            const tipoJuego = partes[3];
            const monto = parseInt(partes[4], 10);
            const extra = partes[5] || 'none';
            return resolverJuego(interaction, duenoId, tipoJuego, monto, extra);
        }

        // ── 9. Modal heredado (antiguos select menus) ──
        if (accion === 'modal') {
            const tipoJuego = partes[3];
            const montoStr = interaction.fields.getTextInputValue('monto');
            let extra = 'none';
            if (tipoJuego === 'cara_cruz') {
                const el = (interaction.fields.getTextInputValue('eleccion') || 'cara').trim().toLowerCase();
                extra = el.includes('cruz') ? 'cruz' : 'cara';
            }
            const usuario = await obtenerUsuario(duenoId, interaction.guildId);
            const val = validarApuesta(usuario, montoStr);
            if (!val.valida) {
                const embedError = base('❌ Apuesta Inválida', val.motivo, COLORES.rojo);
                return responderInicial(interaction, { embeds: [embedError], components: [filaVolver(duenoId)] });
            }
            return resolverJuego(interaction, duenoId, tipoJuego, val.monto, extra);
        }
    },
};

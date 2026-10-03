// src/interactions/apuesta.js
// Manejador central para las apuestas del casino: modales, animaciones y repetición.
const {
    apostarCaraCruz,
    apostarDados,
    apostarRuleta,
    apostarTragamonedas,
} = require('../services/apuestas');
const {
    panelAnimacionApuesta,
    panelResultadoApuesta,
} = require('../utils/paneles');
const config = require('../data/config');

async function resolverJuego(interaction, duenoId, tipoJuego, monto, extra) {
    if (tipoJuego === 'cara_cruz') {
        await interaction.editReply(panelAnimacionApuesta('cara_cruz'));
        await new Promise((r) => setTimeout(r, config.APUESTAS.DELAY_ANIMACION_MS));
        const res = await apostarCaraCruz(duenoId, interaction.guildId, monto, extra);
        return interaction.editReply(panelResultadoApuesta(duenoId, res, tipoJuego, monto, extra));
    }

    if (tipoJuego === 'dados') {
        await interaction.editReply(panelAnimacionApuesta('dados'));
        await new Promise((r) => setTimeout(r, config.APUESTAS.DELAY_ANIMACION_MS));

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
        return interaction.editReply(panelResultadoApuesta(duenoId, res, tipoJuego, monto, extra));
    }

    if (tipoJuego === 'ruleta') {
        await interaction.editReply(panelAnimacionApuesta('ruleta'));
        await new Promise((r) => setTimeout(r, config.APUESTAS.DELAY_ANIMACION_MS));
        const res = await apostarRuleta(duenoId, interaction.guildId, monto, extra);
        return interaction.editReply(panelResultadoApuesta(duenoId, res, tipoJuego, monto, extra));
    }

    if (tipoJuego === 'tragamonedas') {
        await interaction.editReply(panelAnimacionApuesta('tragamonedas', 1));
        await new Promise((r) => setTimeout(r, 900));

        const res = await apostarTragamonedas(duenoId, interaction.guildId, monto);
        if (res.ok && res.carretes) {
            await interaction.editReply(panelAnimacionApuesta('tragamonedas', { s1: res.carretes[0] }));
            await new Promise((r) => setTimeout(r, 900));
        }

        return interaction.editReply(panelResultadoApuesta(duenoId, res, tipoJuego, monto, extra));
    }
}

module.exports = {
    prefijo: 'apuesta',

    async ejecutar(interaction, partes) {
        const accion = partes[1];
        const duenoId = partes[2];
        const tipoJuego = partes[3];

        // ── Envío de modal de juego ──
        if (accion === 'modal') {
            await interaction.deferUpdate();
            const montoStr = interaction.fields.getTextInputValue('monto');
            const monto = parseInt(montoStr, 10);

            let extra = 'none';
            if (tipoJuego === 'cara_cruz') {
                const el = interaction.fields.getTextInputValue('eleccion').trim().toLowerCase();
                extra = el.includes('cruz') ? 'cruz' : 'cara';
            } else if (tipoJuego === 'dados') {
                const t = interaction.fields.getTextInputValue('tier').trim().toLowerCase();
                if (t.includes('alto')) extra = 'alto';
                else if (t.includes('exacto')) extra = t; // ej: exacto:8
                else extra = 'bajo';
            } else if (tipoJuego === 'ruleta') {
                const c = interaction.fields.getTextInputValue('color').trim().toLowerCase();
                if (c.includes('negro')) extra = 'negro';
                else if (c.includes('verde')) extra = 'verde';
                else extra = 'rojo';
            }

            return resolverJuego(interaction, duenoId, tipoJuego, monto, extra);
        }

        // ── Botón Apostar de nuevo ──
        if (accion === 'repetir') {
            await interaction.deferUpdate();
            const monto = parseInt(partes[4], 10);
            const extra = partes[5] || 'none';
            return resolverJuego(interaction, duenoId, tipoJuego, monto, extra);
        }
    },
};

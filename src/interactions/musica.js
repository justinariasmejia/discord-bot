// src/interactions/musica.js
// Manejador interactivo universal de botones y menús para el sistema de música.
const { MessageFlags } = require('discord.js');
const {
    obtenerCola,
    saltar,
    saltarA,
    desconectar,
    pausar,
    reanudar,
    setVolumen,
    toggleMute,
    barajar,
    toggleLoop,
    remover,
    vaciarCola,
} = require('../services/musica');
const { panelNowPlaying, panelCola } = require('../utils/paneles-musica');
const { basePremium, COLORES } = require('../utils/embeds');
const { actualizarPanelDedicado } = require('../services/canalMusica');

module.exports = {
    prefijo: 'musica',

    async ejecutar(interaction, partes, client) {
        const accion = partes[1];
        const guildId = interaction.guildId;
        const miembro = interaction.member;

        // Acusar recibo DE INMEDIATO para garantizar respuesta instantánea de Discord
        await interaction.deferUpdate().catch(() => {});

        // ── Validación de Voz ──
        const canalVozUsuario = miembro?.voice?.channelId;
        const botVoiceChannelId = interaction.guild?.members?.me?.voice?.channelId;

        if (!canalVozUsuario) {
            return interaction.followUp({
                embeds: [basePremium('❌ No estás en un canal de voz', 'Únete al canal de voz donde está el bot para usar los controles.', COLORES.rojo)],
                flags: MessageFlags.Ephemeral,
            }).catch(() => {});
        }

        if (botVoiceChannelId && canalVozUsuario !== botVoiceChannelId) {
            return interaction.followUp({
                embeds: [basePremium('❌ Canal de Voz Diferente', 'Debes estar en el mismo canal de voz que el bot para controlar la música.', COLORES.rojo)],
                flags: MessageFlags.Ephemeral,
            }).catch(() => {});
        }

        const cola = obtenerCola(guildId);

        if (!cola || !cola.current) {
            await actualizarPanelDedicado(client, guildId);
            return;
        }

        // ── 1. PAUSA / REANUDAR ──
        if (accion === 'pause_resume') {
            if (cola.paused) {
                reanudar(guildId);
            } else {
                pausar(guildId);
            }
            await interaction.editReply(panelNowPlaying(cola, interaction.user.id)).catch(() => {});
            await actualizarPanelDedicado(client, guildId);
            return;
        }

        // ── 2. SALTAR PISTA ──
        if (accion === 'skip') {
            saltar(guildId);
            setTimeout(async () => {
                const c = obtenerCola(guildId);
                if (c && c.current) {
                    await interaction.editReply(panelNowPlaying(c, interaction.user.id)).catch(() => {});
                }
                await actualizarPanelDedicado(client, guildId);
            }, 300);
            return;
        }

        // ── 3. SALTO DIRECTO CON SELECT MENU ──
        if (accion === 'jump_select') {
            const trackIdx = parseInt(interaction.values[0], 10);
            saltarA(guildId, trackIdx);
            setTimeout(async () => {
                const c = obtenerCola(guildId);
                if (c && c.current) {
                    await interaction.editReply(panelNowPlaying(c, interaction.user.id)).catch(() => {});
                }
                await actualizarPanelDedicado(client, guildId);
            }, 300);
            return;
        }

        // ── 4. DETENER Y DESCONECTAR ──
        if (accion === 'stop') {
            desconectar(guildId);
            await actualizarPanelDedicado(client, guildId);
            return;
        }

        // ── 5. LOOP (REPETICIÓN) ──
        if (accion === 'loop') {
            toggleLoop(guildId);
            await interaction.editReply(panelNowPlaying(cola, interaction.user.id)).catch(() => {});
            await actualizarPanelDedicado(client, guildId);
            return;
        }

        // ── 6. MEZCLAR COLA ──
        if (accion === 'shuffle') {
            barajar(guildId);
            if (partes[2] === 'all' && interaction.message.embeds[0]?.title?.includes('Cola')) {
                await interaction.editReply(panelCola(cola, interaction.user.id, 0)).catch(() => {});
            } else {
                await interaction.editReply(panelNowPlaying(cola, interaction.user.id)).catch(() => {});
            }
            await actualizarPanelDedicado(client, guildId);
            return;
        }

        // ── 7. VOLUMEN (-10 / +10 / MUTE) ──
        if (accion === 'vol_down') {
            const nuevoVol = Math.max(0, cola.volume - 10);
            await setVolumen(guildId, nuevoVol);
            await interaction.editReply(panelNowPlaying(cola, interaction.user.id)).catch(() => {});
            await actualizarPanelDedicado(client, guildId);
            return;
        }

        if (accion === 'vol_up') {
            const nuevoVol = Math.min(150, cola.volume + 10);
            await setVolumen(guildId, nuevoVol);
            await interaction.editReply(panelNowPlaying(cola, interaction.user.id)).catch(() => {});
            await actualizarPanelDedicado(client, guildId);
            return;
        }

        if (accion === 'mute') {
            toggleMute(guildId);
            await interaction.editReply(panelNowPlaying(cola, interaction.user.id)).catch(() => {});
            await actualizarPanelDedicado(client, guildId);
            return;
        }

        // ── 8. VER COLA ──
        if (accion === 'queue') {
            const pag = parseInt(partes[3] || '0', 10);
            await interaction.editReply(panelCola(cola, interaction.user.id, pag)).catch(() => {});
            return;
        }

        // ── 9. VOLVER AL REPRODUCTOR / REFRESCAR ──
        if (accion === 'np_refresh' || accion === 'np_back') {
            await interaction.editReply(panelNowPlaying(cola, interaction.user.id)).catch(() => {});
            await actualizarPanelDedicado(client, guildId);
            return;
        }

        // ── 10. PAGINACIÓN DE COLA ──
        if (accion === 'queue_prev') {
            const pag = Math.max(0, parseInt(partes[3] || '0', 10) - 1);
            await interaction.editReply(panelCola(cola, interaction.user.id, pag)).catch(() => {});
            return;
        }

        if (accion === 'queue_next') {
            const pag = parseInt(partes[3] || '0', 10) + 1;
            await interaction.editReply(panelCola(cola, interaction.user.id, pag)).catch(() => {});
            return;
        }

        // ── 11. QUITAR CANCIÓN DE COLA CON SELECT MENU ──
        if (accion === 'remove_select') {
            const trackIdx = parseInt(interaction.values[0], 10);
            const pag = parseInt(partes[3] || '0', 10);
            remover(guildId, trackIdx);
            await interaction.editReply(panelCola(cola, interaction.user.id, pag)).catch(() => {});
            await actualizarPanelDedicado(client, guildId);
            return;
        }

        // ── 12. VACIAR TODA LA COLA ──
        if (accion === 'clear_queue') {
            vaciarCola(guildId);
            await interaction.editReply(panelCola(cola, interaction.user.id, 0)).catch(() => {});
            await actualizarPanelDedicado(client, guildId);
            return;
        }
    },
};

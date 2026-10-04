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

module.exports = {
    prefijo: 'musica',

    async ejecutar(interaction, partes, client) {
        const accion = partes[1];
        const guildId = interaction.guildId;
        const miembro = interaction.member;

        // ── Validación de Voz ──
        const canalVozUsuario = miembro?.voice?.channelId;
        const botVoiceChannelId = interaction.guild.members.me?.voice?.channelId;

        if (!canalVozUsuario) {
            return interaction.reply({
                embeds: [basePremium('❌ No estás en un canal de voz', 'Únete al canal de voz donde está el bot para usar los controles.', COLORES.rojo)],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (botVoiceChannelId && canalVozUsuario !== botVoiceChannelId) {
            return interaction.reply({
                embeds: [basePremium('❌ Canal de Voz Diferente', 'Debes estar en el mismo canal de voz que el bot para controlar la música.', COLORES.rojo)],
                flags: MessageFlags.Ephemeral,
            });
        }

        const cola = obtenerCola(guildId);

        if (!cola) {
            return interaction.reply({
                embeds: [basePremium('🔇 Sin Música', 'No hay música reproduciéndose actualmente. Usa `/musica play` para iniciar.', COLORES.rojo)],
                flags: MessageFlags.Ephemeral,
            });
        }

        // ── 1. PAUSA / REANUDAR ──
        if (accion === 'pause_resume') {
            if (cola.paused) {
                reanudar(guildId);
            } else {
                pausar(guildId);
            }
            return interaction.update(panelNowPlaying(cola, interaction.user.id));
        }

        // ── 2. SALTAR PISTA ──
        if (accion === 'skip') {
            if (!cola.current) {
                return interaction.reply({ content: '❌ No hay canción para saltar.', flags: MessageFlags.Ephemeral });
            }
            const titulo = cola.current.info.title;
            saltar(guildId);

            setTimeout(async () => {
                try {
                    const c = obtenerCola(guildId);
                    if (c && c.current) {
                        await interaction.update(panelNowPlaying(c, interaction.user.id));
                    } else {
                        await interaction.update({
                            embeds: [basePremium('⏭️ Canción Saltada', `Se saltó **${titulo}**.\n\nNo hay más canciones en la cola.`, COLORES.verde)],
                            components: [],
                        });
                    }
                } catch {}
            }, 600);
            return;
        }

        // ── 3. SALTO DIRECTO CON SELECT MENU ──
        if (accion === 'jump_select') {
            const trackIdx = parseInt(interaction.values[0], 10);
            const exito = saltarA(guildId, trackIdx);
            if (!exito) {
                return interaction.reply({ content: '❌ No se pudo saltar a esa canción.', flags: MessageFlags.Ephemeral });
            }
            setTimeout(async () => {
                try {
                    const c = obtenerCola(guildId);
                    if (c && c.current) {
                        await interaction.update(panelNowPlaying(c, interaction.user.id));
                    }
                } catch {}
            }, 600);
            return;
        }

        // ── 4. DETENER Y DESCONECTAR ──
        if (accion === 'stop') {
            desconectar(guildId);
            return interaction.update({
                embeds: [basePremium('⏹️ Música Detenida', 'Se detuvo la reproducción y el bot se desconectó de voz.', COLORES.rojo)],
                components: [],
            });
        }

        // ── 5. LOOP (REPETICIÓN) ──
        if (accion === 'loop') {
            toggleLoop(guildId);
            return interaction.update(panelNowPlaying(cola, interaction.user.id));
        }

        // ── 6. MEZCLAR COLA ──
        if (accion === 'shuffle') {
            barajar(guildId);
            if (partes[2] === 'all' && interaction.message.embeds[0]?.title?.includes('Cola')) {
                return interaction.update(panelCola(cola, interaction.user.id, 0));
            }
            return interaction.update(panelNowPlaying(cola, interaction.user.id));
        }

        // ── 7. VOLUMEN (-10 / +10 / MUTE) ──
        if (accion === 'vol_down') {
            const nuevoVol = Math.max(0, cola.volume - 10);
            await setVolumen(guildId, nuevoVol);
            return interaction.update(panelNowPlaying(cola, interaction.user.id));
        }

        if (accion === 'vol_up') {
            const nuevoVol = Math.min(150, cola.volume + 10);
            await setVolumen(guildId, nuevoVol);
            return interaction.update(panelNowPlaying(cola, interaction.user.id));
        }

        if (accion === 'mute') {
            toggleMute(guildId);
            return interaction.update(panelNowPlaying(cola, interaction.user.id));
        }

        // ── 8. VER COLA ──
        if (accion === 'queue') {
            const pag = parseInt(partes[3] || '0', 10);
            return interaction.update(panelCola(cola, interaction.user.id, pag));
        }

        // ── 9. VOLVER AL REPRODUCTOR / REFRESCAR ──
        if (accion === 'np_refresh' || accion === 'np_back') {
            return interaction.update(panelNowPlaying(cola, interaction.user.id));
        }

        // ── 10. PAGINACIÓN DE COLA ──
        if (accion === 'queue_prev') {
            const pag = Math.max(0, parseInt(partes[3] || '0', 10) - 1);
            return interaction.update(panelCola(cola, interaction.user.id, pag));
        }

        if (accion === 'queue_next') {
            const pag = parseInt(partes[3] || '0', 10) + 1;
            return interaction.update(panelCola(cola, interaction.user.id, pag));
        }

        // ── 11. QUITAR CANCIÓN DE COLA CON SELECT MENU ──
        if (accion === 'remove_select') {
            const trackIdx = parseInt(interaction.values[0], 10);
            const pag = parseInt(partes[3] || '0', 10);
            const removida = remover(guildId, trackIdx);

            if (!removida) {
                return interaction.reply({ content: '❌ Canción no encontrada en la cola.', flags: MessageFlags.Ephemeral });
            }

            return interaction.update(panelCola(cola, interaction.user.id, pag));
        }

        // ── 12. VACIAR TODA LA COLA ──
        if (accion === 'clear_queue') {
            vaciarCola(guildId);
            return interaction.update(panelCola(cola, interaction.user.id, 0));
        }
    },
};

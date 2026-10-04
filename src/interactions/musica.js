// src/interactions/musica.js
// Manejador interactivo universal de botones y menús para el sistema de música.
const { MessageFlags } = require('discord.js');
const {
    obtenerCola,
    conectar,
    reproducir,
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
    obtenerBusqueda,
    limpiarBusqueda,
} = require('../services/musica');
const { panelNowPlaying, panelCola } = require('../utils/paneles-musica');
const { basePremium, COLORES } = require('../utils/embeds');

module.exports = {
    prefijo: 'musica',

    async ejecutar(interaction, partes, client) {
        const accion = partes[1];
        const extraParam = partes[2];
        const guildId = interaction.guildId;
        const miembro = interaction.member;

        // ── Validación de Voz ──
        const canalVozUsuario = miembro?.voice?.channelId;
        const botVoiceChannelId = interaction.guild.members.me?.voice?.channelId;

        // Cancelar búsqueda no requiere estar en voz
        if (accion !== 'cancel_search') {
            if (!canalVozUsuario) {
                return interaction.reply({
                    embeds: [basePremium('❌ No estás en un canal de voz', 'Únete al canal de voz del bot para usar los controles interactivos.', COLORES.rojo)],
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (botVoiceChannelId && canalVozUsuario !== botVoiceChannelId) {
                return interaction.reply({
                    embeds: [basePremium('❌ Canal de Voz Diferente', 'Debes estar en el mismo canal de voz que el bot para controlar la música.', COLORES.rojo)],
                    flags: MessageFlags.Ephemeral,
                });
            }
        }

        const cola = obtenerCola(guildId);

        // ── 1. SELECCIÓN DE BÚSQUEDA INTERACTIVA ──
        if (accion === 'select_search') {
            const duenoId = extraParam;
            const searchId = partes[3];

            if (duenoId && duenoId !== interaction.user.id) {
                return interaction.reply({
                    content: '🔒 Esta búsqueda interactiva fue iniciada por otro usuario.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const busquedaData = obtenerBusqueda(searchId);
            if (!busquedaData) {
                return interaction.update({
                    embeds: [basePremium('⏳ Búsqueda Expirada', 'Esta búsqueda ha caducado. Realiza una nueva con `/musica play` o `/musica search`.', COLORES.rojo)],
                    components: [],
                });
            }

            const trackIndex = parseInt(interaction.values[0], 10);
            const trackElegido = busquedaData.tracks[trackIndex];

            if (!trackElegido) {
                return interaction.reply({ content: '❌ Pista no encontrada.', flags: MessageFlags.Ephemeral });
            }

            limpiarBusqueda(searchId);

            // Conectar si no hay cola activa
            let colaActual = cola;
            if (!colaActual) {
                try {
                    colaActual = await conectar(guildId, canalVozUsuario, interaction.channelId, interaction.guild.shardId);
                } catch (err) {
                    console.error('Error al conectar desde select:', err);
                    return interaction.update({
                        embeds: [basePremium('❌ Error de Conexión', 'No se pudo conectar al canal de voz.', COLORES.rojo)],
                        components: [],
                    });
                }
            }

            // Asociar datos del usuario que la pidió
            trackElegido.requester = {
                id: interaction.user.id,
                tag: interaction.user.tag,
                avatar: interaction.user.displayAvatarURL(),
            };

            const yaSonando = !!colaActual.current;
            reproducir(guildId, trackElegido);

            if (yaSonando) {
                const info = trackElegido.info;
                const embed = basePremium('➕ Añadida a la Cola', '', COLORES.verde)
                    .addFields(
                        { name: '🎵 Canción', value: `[${info.title}](${info.uri})`, inline: false },
                        { name: '👤 Artista', value: info.author || 'Desconocido', inline: true },
                        { name: '#️⃣ Posición', value: `#${colaActual.tracks.length}`, inline: true }
                    );
                if (info.artworkUrl) embed.setThumbnail(info.artworkUrl);
                return interaction.update({ embeds: [embed], components: [] });
            }

            // Si empezó a sonar inmediatamente, mostrar el panel del reproductor
            return interaction.update(panelNowPlaying(colaActual, interaction.user.id));
        }

        // ── 2. CANCELAR BÚSQUEDA ──
        if (accion === 'cancel_search') {
            const duenoId = extraParam;
            const searchId = partes[3];

            if (duenoId && duenoId !== interaction.user.id) {
                return interaction.reply({
                    content: '🔒 No puedes cancelar la búsqueda de otro usuario.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            limpiarBusqueda(searchId);
            return interaction.update({
                embeds: [basePremium('❌ Búsqueda Cancelada', 'La selección de música ha sido cancelada.', COLORES.negro)],
                components: [],
            });
        }

        // Si no hay cola activa para las demás acciones
        if (!cola) {
            return interaction.reply({
                embeds: [basePremium('🔇 Sin Música', 'No hay música reproduciéndose actualmente. Usa `/musica play` para iniciar.', COLORES.rojo)],
                flags: MessageFlags.Ephemeral,
            });
        }

        // ── 3. PAUSA / REANUDAR ──
        if (accion === 'pause_resume') {
            if (cola.paused) {
                reanudar(guildId);
            } else {
                pausar(guildId);
            }
            return interaction.update(panelNowPlaying(cola, interaction.user.id));
        }

        // ── 4. SALTAR PISTA ──
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

        // ── 5. SALTO DIRECTO CON SELECT MENU ──
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

        // ── 6. DETENER Y DESCONECTAR ──
        if (accion === 'stop') {
            desconectar(guildId);
            return interaction.update({
                embeds: [basePremium('⏹️ Música Detenida', 'Se detuvo la reproducción y el bot se desconectó de voz.', COLORES.rojo)],
                components: [],
            });
        }

        // ── 7. LOOP (REPETICIÓN) ──
        if (accion === 'loop') {
            toggleLoop(guildId);
            return interaction.update(panelNowPlaying(cola, interaction.user.id));
        }

        // ── 8. MEZCLAR COLA ──
        if (accion === 'shuffle') {
            barajar(guildId);
            if (partes[2] === 'all' && interaction.message.embeds[0]?.title?.includes('Cola')) {
                return interaction.update(panelCola(cola, interaction.user.id, 0));
            }
            return interaction.update(panelNowPlaying(cola, interaction.user.id));
        }

        // ── 9. VOLUMEN (-10 / +10 / MUTE) ──
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

        // ── 10. VER COLA ──
        if (accion === 'queue') {
            const pag = parseInt(partes[3] || '0', 10);
            return interaction.update(panelCola(cola, interaction.user.id, pag));
        }

        // ── 11. VOLVER AL REPRODUCTOR / REFRESCAR ──
        if (accion === 'np_refresh' || accion === 'np_back') {
            return interaction.update(panelNowPlaying(cola, interaction.user.id));
        }

        // ── 12. PAGINACIÓN DE COLA ──
        if (accion === 'queue_prev') {
            const pag = Math.max(0, parseInt(partes[3] || '0', 10) - 1);
            return interaction.update(panelCola(cola, interaction.user.id, pag));
        }

        if (accion === 'queue_next') {
            const pag = parseInt(partes[3] || '0', 10) + 1;
            return interaction.update(panelCola(cola, interaction.user.id, pag));
        }

        // ── 13. QUITAR CANCIÓN DE COLA CON SELECT MENU ──
        if (accion === 'remove_select') {
            const trackIdx = parseInt(interaction.values[0], 10);
            const pag = parseInt(partes[3] || '0', 10);
            const removida = remover(guildId, trackIdx);

            if (!removida) {
                return interaction.reply({ content: '❌ Canción no encontrada en la cola.', flags: MessageFlags.Ephemeral });
            }

            return interaction.update(panelCola(cola, interaction.user.id, pag));
        }

        // ── 14. VACIAR TODA LA COLA ──
        if (accion === 'clear_queue') {
            vaciarCola(guildId);
            return interaction.update(panelCola(cola, interaction.user.id, 0));
        }
    },
};

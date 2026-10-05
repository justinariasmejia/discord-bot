// src/services/accionesMusica.js
// Implementaciones centrales de acciones musicales reutilizables por comandos slash (/play, /skip...) y /musica.
const { MessageFlags } = require('discord.js');
const {
    buscar,
    obtenerCola,
    conectar,
    reproducir,
    saltar,
    desconectar,
    pausar,
    reanudar,
    setVolumen,
    barajar,
    toggleLoop,
    remover,
    vaciarCola,
    formatearDuracion,
} = require('./musica');
const { panelNowPlaying, panelCola } = require('../utils/paneles-musica');
const { basePremium, COLORES } = require('../utils/embeds');
const { actualizarPanelDedicado } = require('./canalMusica');

async function enviarRespuesta(interaction, payload) {
    try {
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(payload);
        } else {
            return await interaction.reply(payload);
        }
    } catch {
        try {
            return await interaction.followUp(payload);
        } catch (e2) {
            console.error('Error enviando respuesta:', e2?.message || e2);
        }
    }
}

async function ejecutarPlay(interaction, query) {
    const guildId = interaction.guildId;
    const miembro = interaction.member;
    const canalVoz = miembro?.voice?.channel;

    if (!canalVoz) {
        return enviarRespuesta(interaction, {
            embeds: [basePremium('❌ No estás en un canal de voz', 'Únete a un canal de voz primero para poner música.', COLORES.rojo)],
            flags: MessageFlags.Ephemeral,
        });
    }

    if (!interaction.deferred && !interaction.replied) {
        try {
            await interaction.deferReply();
        } catch {}
    }

    const resultado = await buscar(query);

    if (resultado && resultado.error === 'NO_NODE') {
        return enviarRespuesta(interaction, {
            embeds: [basePremium('⚠️ Conectando a Servidor de Audio', 'El servidor de música (Lavalink) se está inicializando. Por favor intenta en 3 segundos.', COLORES.naranja)],
        });
    }

    if (!resultado || !resultado.data) {
        return enviarRespuesta(interaction, {
            embeds: [basePremium('🔍 Sin Resultados', `No se encontró ninguna canción para: **${query}**\n\n💡 Tip: Intenta con el nombre de la canción y artista, o pega un enlace directo de YouTube/Spotify.`, COLORES.rojo)],
        });
    }

    let tracks = [];
    let esPlaylist = false;
    let nombrePlaylist = '';

    if (resultado.loadType === 'playlist') {
        tracks = resultado.data.tracks || resultado.data;
        esPlaylist = true;
        nombrePlaylist = resultado.data.info?.name || 'Playlist';
    } else if (resultado.loadType === 'track') {
        tracks = [resultado.data];
    } else if (resultado.loadType === 'search') {
        tracks = Array.isArray(resultado.data) ? resultado.data : [resultado.data];
    }

    if (!tracks || tracks.length === 0) {
        return enviarRespuesta(interaction, {
            embeds: [basePremium('🔍 Sin Resultados', `No se encontraron canciones disponibles para: **${query}**`, COLORES.rojo)],
        });
    }

    // Conectar al canal de voz si no está ya conectado
    let cola = obtenerCola(guildId);
    if (!cola) {
        try {
            cola = await conectar(guildId, canalVoz.id, interaction.channelId, interaction.guild.shardId);
        } catch (err) {
            console.error('Error al conectar a voz:', err);
            return enviarRespuesta(interaction, {
                embeds: [basePremium('❌ Error de Conexión', 'No se pudo conectar al canal de voz. Verifica los permisos del bot (Conectar y Hablar).', COLORES.rojo)],
            });
        }
    }

    const requester = {
        id: interaction.user.id,
        tag: interaction.user.tag,
        avatar: interaction.user.displayAvatarURL(),
    };

    const yaSonando = !!cola.current;
    const cancionesAñadir = esPlaylist ? tracks : [tracks[0]];

    for (const t of cancionesAñadir) {
        t.requester = requester;
        reproducir(guildId, t);
    }

    // ── Si ya había música sonando: Respuesta temporal que se auto-elimina en 6 segundos ──
    if (yaSonando) {
        const track = cancionesAñadir[0];
        const info = track.info;

        const embedConfirmacion = basePremium('➕ Añadida a la Cola', 'Se añadió a la lista de reproducción.', COLORES.verde)
            .addFields(
                { name: '🎵 Canción', value: `[${info.title}](${info.uri})`, inline: false },
                { name: '👤 Artista', value: info.author || 'Desconocido', inline: true },
                { name: '⏱️ Duración', value: formatearDuracion(info.length), inline: true },
                { name: '#️⃣ Posición en Cola', value: `#${cola.tracks.length}`, inline: true }
            );
        if (info.artworkUrl) embedConfirmacion.setThumbnail(info.artworkUrl);

        await enviarRespuesta(interaction, { embeds: [embedConfirmacion] });

        // Auto-eliminar el mensaje de confirmación para no perder el reproductor
        setTimeout(() => {
            interaction.deleteReply().catch(() => {});
        }, 2500);

        // Actualizar el panel maestro permanente en tiempo real
        await actualizarPanelDedicado(interaction.client, guildId);
        return;
    }

    // Si es la primera canción: Enviar el reproductor interactivo
    const res = await enviarRespuesta(interaction, panelNowPlaying(cola, interaction.user.id));
    if (res?.id) {
        cola.mensajeId = res.id;
    }
    await actualizarPanelDedicado(interaction.client, guildId);
    return res;
}

async function ejecutarSkip(interaction) {
    const guildId = interaction.guildId;
    const cola = obtenerCola(guildId);
    if (!cola || !cola.current) {
        return enviarRespuesta(interaction, {
            embeds: [basePremium('❌ Sin Música', 'No hay ninguna canción reproduciéndose actualmente.', COLORES.rojo)],
            flags: MessageFlags.Ephemeral,
        });
    }
    const saltada = cola.current.info.title;
    saltar(guildId);
    await actualizarPanelDedicado(interaction.client, guildId);
    return enviarRespuesta(interaction, {
        embeds: [basePremium('⏭️ Canción Saltada', `Se saltó **${saltada}**.`, COLORES.verde)],
    });
}

async function ejecutarStop(interaction) {
    const guildId = interaction.guildId;
    const cola = obtenerCola(guildId);
    if (!cola) {
        return enviarRespuesta(interaction, {
            embeds: [basePremium('❌ Sin Música', 'El bot no está reproduciendo música en este servidor.', COLORES.rojo)],
            flags: MessageFlags.Ephemeral,
        });
    }
    desconectar(guildId);
    await actualizarPanelDedicado(interaction.client, guildId);
    return enviarRespuesta(interaction, {
        embeds: [basePremium('⏹️ Música Detenida', 'Se detuvo la reproducción y el bot se desconectó.', COLORES.rojo)],
    });
}

async function ejecutarPause(interaction) {
    const guildId = interaction.guildId;
    const exito = pausar(guildId);
    if (!exito) {
        return enviarRespuesta(interaction, {
            embeds: [basePremium('❌ Error', 'No hay música activa para pausar.', COLORES.rojo)],
            flags: MessageFlags.Ephemeral,
        });
    }
    await actualizarPanelDedicado(interaction.client, guildId);
    return enviarRespuesta(interaction, {
        embeds: [basePremium('⏸️ Música Pausada', 'Usa `/resume` o el botón ▶️ del panel para continuar.', COLORES.naranja)],
    });
}

async function ejecutarResume(interaction) {
    const guildId = interaction.guildId;
    const exito = reanudar(guildId);
    if (!exito) {
        return enviarRespuesta(interaction, {
            embeds: [basePremium('❌ Error', 'No hay música pausada para reanudar.', COLORES.rojo)],
            flags: MessageFlags.Ephemeral,
        });
    }
    await actualizarPanelDedicado(interaction.client, guildId);
    return enviarRespuesta(interaction, {
        embeds: [basePremium('▶️ Música Reanudada', 'La reproducción continúa.', COLORES.verde)],
    });
}

async function ejecutarQueue(interaction) {
    const guildId = interaction.guildId;
    const cola = obtenerCola(guildId);
    if (!cola || (!cola.current && cola.tracks.length === 0)) {
        return enviarRespuesta(interaction, {
            embeds: [basePremium('📋 Cola Vacía', 'No hay canciones en la cola.\n\nUsa `/play` para agregar canciones.', COLORES.morado)],
            flags: MessageFlags.Ephemeral,
        });
    }
    return enviarRespuesta(interaction, panelCola(cola, interaction.user.id, 0));
}

async function ejecutarNp(interaction) {
    const guildId = interaction.guildId;
    const cola = obtenerCola(guildId);
    if (!cola || !cola.current) {
        return enviarRespuesta(interaction, {
            embeds: [basePremium('🔇 Silencio', 'No hay ninguna canción reproduciéndose.', COLORES.morado)],
            flags: MessageFlags.Ephemeral,
        });
    }
    return enviarRespuesta(interaction, panelNowPlaying(cola, interaction.user.id));
}

async function ejecutarVolume(interaction, nivel) {
    const guildId = interaction.guildId;
    const exito = await setVolumen(guildId, nivel);
    if (!exito) {
        return enviarRespuesta(interaction, {
            embeds: [basePremium('❌ Error', 'No hay música activa para cambiar el volumen.', COLORES.rojo)],
            flags: MessageFlags.Ephemeral,
        });
    }
    await actualizarPanelDedicado(interaction.client, guildId);
    const emoji = nivel === 0 ? '🔇' : nivel < 50 ? '🔉' : '🔊';
    return enviarRespuesta(interaction, {
        embeds: [basePremium(`${emoji} Volumen Ajustado`, `Volumen establecido a **${nivel}%**`, COLORES.verde)],
    });
}

async function ejecutarShuffle(interaction) {
    const guildId = interaction.guildId;
    const exito = barajar(guildId);
    if (!exito) {
        return enviarRespuesta(interaction, {
            embeds: [basePremium('❌ Error', 'Se necesitan al menos 2 canciones en espera en la cola para mezclar.', COLORES.rojo)],
            flags: MessageFlags.Ephemeral,
        });
    }
    await actualizarPanelDedicado(interaction.client, guildId);
    return enviarRespuesta(interaction, {
        embeds: [basePremium('🔀 Cola Mezclada', 'El orden de las canciones ha sido barajado aleatoriamente.', COLORES.verde)],
    });
}

async function ejecutarLoop(interaction) {
    const guildId = interaction.guildId;
    const modo = toggleLoop(guildId);
    if (modo === null) {
        return enviarRespuesta(interaction, {
            embeds: [basePremium('❌ Error', 'No hay música activa para cambiar el modo de repetición.', COLORES.rojo)],
            flags: MessageFlags.Ephemeral,
        });
    }
    await actualizarPanelDedicado(interaction.client, guildId);
    const textos = {
        off: '▶️ **Desactivado** — Las pistas se reproducen una vez.',
        track: '🔂 **Canción Actual** — La canción actual se repetirá continuamente.',
        queue: '🔁 **Toda la Cola** — La lista completa se repetirá al terminar.',
    };
    return enviarRespuesta(interaction, {
        embeds: [basePremium('🔄 Modo de Repetición', textos[modo], COLORES.verde)],
    });
}

async function ejecutarRemove(interaction, pos) {
    const guildId = interaction.guildId;
    const index = pos - 1;
    const removida = remover(guildId, index);
    if (!removida) {
        return enviarRespuesta(interaction, {
            embeds: [basePremium('❌ Posición Inválida', 'No existe ninguna canción en esa posición. Usa `/queue` para ver la lista.', COLORES.rojo)],
            flags: MessageFlags.Ephemeral,
        });
    }
    await actualizarPanelDedicado(interaction.client, guildId);
    return enviarRespuesta(interaction, {
        embeds: [basePremium('🗑️ Canción Removida', `Se quitó **${removida.info.title}** de la cola.`, COLORES.verde)],
    });
}

async function ejecutarClear(interaction) {
    const guildId = interaction.guildId;
    const total = vaciarCola(guildId);
    await actualizarPanelDedicado(interaction.client, guildId);
    return enviarRespuesta(interaction, {
        embeds: [basePremium('🧹 Cola Vaciada', `Se eliminaron **${total}** canciones de la cola de espera.`, COLORES.verde)],
    });
}

module.exports = {
    ejecutarPlay,
    ejecutarSkip,
    ejecutarStop,
    ejecutarPause,
    ejecutarResume,
    ejecutarQueue,
    ejecutarNp,
    ejecutarVolume,
    ejecutarShuffle,
    ejecutarLoop,
    ejecutarRemove,
    ejecutarClear,
};

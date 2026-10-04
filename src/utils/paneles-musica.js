// src/utils/paneles-musica.js
// Paneles visuales interactivos y profesionales para el sistema de música.
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require('discord.js');
const { basePremium, COLORES } = require('./embeds');
const { formatearDuracion, barraProgreso } = require('../services/musica');

// ── Panel Now Playing (Reproductor Interactivo) ──
function panelNowPlaying(cola, userId) {
    const track = cola?.current;
    if (!track) {
        return {
            embeds: [basePremium('🔇 Sin Reproducción', 'No hay ninguna canción sonando en este momento.\n\nUsa `/musica play` para iniciar la fiesta.', COLORES.morado)],
            components: [],
        };
    }

    const info = track.info;
    const posicion = cola.player?.position || 0;
    const barra = barraProgreso(posicion, info.length);
    const durActual = formatearDuracion(posicion);
    const durTotal = formatearDuracion(info.length);

    const loopTexto = cola.loop === 'track' ? '🔂 Canción' : cola.loop === 'queue' ? '🔁 Cola' : 'Off';
    const statusEmoji = cola.paused ? '⏸️' : '▶️';
    const volEmoji = cola.volume === 0 ? '🔇' : cola.volume < 50 ? '🔉' : '🔊';

    const embed = basePremium(
        '🎵 Reproduciendo Ahora • La Cripta',
        '> *Controla la reproducción con los botones inferiores.*',
        COLORES.morado
    ).addFields(
        { name: '🎶 Canción', value: `[${info.title}](${info.uri})`, inline: false },
        { name: '👤 Artista', value: info.author || 'Desconocido', inline: true },
        { name: '⏱️ Duración', value: `${durActual} / ${durTotal}`, inline: true },
        { name: `${volEmoji} Volumen`, value: `${cola.volume}%`, inline: true },
        {
            name: '━━━ Progreso ━━━',
            value: `${statusEmoji} ${barra}\n` +
                   `**${durActual}** ▬▬▬▬▬▬▬▬▬▬▬▬ **${durTotal}** • Loop: **${loopTexto}**`,
            inline: false,
        }
    );

    if (cola.tracks.length > 0) {
        const prox = cola.tracks[0].info;
        embed.addFields({
            name: '⏭️ Siguiente en Cola',
            value: `[${prox.title.slice(0, 55)}](${prox.uri}) — ` +
                   `*${prox.author.slice(0, 25)}* [${formatearDuracion(prox.length)}]\n` +
                   `*(+${cola.tracks.length} canción${cola.tracks.length > 1 ? 'es' : ''} más)*`,
            inline: false,
        });
    }

    if (track.requester) {
        embed.setFooter({
            text: `Pedido por: ${track.requester.tag || 'Mortal de la Cripta'}`,
            iconURL: track.requester.avatar || undefined,
        });
    }

    if (info.artworkUrl) {
        embed.setThumbnail(info.artworkUrl);
    }

    const fila1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('musica:pause_resume:all')
            .setLabel(cola.paused ? 'Reanudar' : 'Pausar')
            .setEmoji(cola.paused ? '▶️' : '⏸️')
            .setStyle(cola.paused ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('musica:skip:all')
            .setLabel('Saltar')
            .setEmoji('⏭️')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('musica:stop:all')
            .setLabel('Detener')
            .setEmoji('⏹️')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('musica:loop:all')
            .setLabel(`Loop: ${loopTexto}`)
            .setEmoji('🔁')
            .setStyle(cola.loop === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('musica:shuffle:all')
            .setLabel('Mezclar')
            .setEmoji('🔀')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(cola.tracks.length < 2)
    );

    const fila2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('musica:vol_down:all')
            .setLabel('-10%')
            .setEmoji('🔉')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('musica:vol_up:all')
            .setLabel('+10%')
            .setEmoji('🔊')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('musica:mute:all')
            .setLabel(cola.volume === 0 ? 'Desmutear' : 'Mute')
            .setEmoji('🔇')
            .setStyle(cola.volume === 0 ? ButtonStyle.Danger : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('musica:queue:all:0')
            .setLabel(`Cola (${cola.tracks.length})`)
            .setEmoji('📋')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('musica:np_refresh:all')
            .setLabel('Refrescar')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Secondary)
    );

    const components = [fila1, fila2];

    if (cola.tracks.length > 0) {
        const opcionesSalto = cola.tracks.slice(0, 5).map((t, idx) => ({
            label: `#${idx + 1} ${t.info.title.slice(0, 80)}`,
            description: `${(t.info.author || 'Desconocido').slice(0, 40)} • [${formatearDuracion(t.info.length)}]`,
            value: String(idx),
            emoji: '🎶',
        }));

        const fila3 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('musica:jump_select:all')
                .setPlaceholder('⏭️ Saltar directamente a una canción...')
                .addOptions(opcionesSalto)
        );
        components.push(fila3);
    }

    return { embeds: [embed], components };
}

// ── Panel de Cola Interactiva con Paginación y Eliminación Rápida ──
function panelCola(cola, userId, pagina = 0) {
    const porPagina = 8;
    const totalPaginas = Math.max(1, Math.ceil(cola.tracks.length / porPagina));
    pagina = Math.max(0, Math.min(pagina, totalPaginas - 1));

    let desc = '';

    if (cola.current) {
        const info = cola.current.info;
        const dur = formatearDuracion(info.length);
        desc += '🎵 **Sonando ahora:**\n';
        desc += `[${info.title}](${info.uri})\n` +
                `👤 *${info.author || 'Desconocido'}* • ⏱️ **${dur}**\n\n`;
    }

    desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    const inicio = pagina * porPagina;
    const fin = Math.min(inicio + porPagina, cola.tracks.length);
    const pistasPagina = cola.tracks.slice(inicio, fin);

    if (cola.tracks.length === 0) {
        desc += '\n*La cola está vacía. Usa* `/musica play` *para agregar canciones.*\n';
    } else {
        pistasPagina.forEach((t, i) => {
            const num = inicio + i + 1;
            desc += `**${num}.** [${t.info.title.slice(0, 50)}](${t.info.uri})\n` +
                    `   👤 *${(t.info.author || 'Desconocido').slice(0, 25)}* • ⏱️ **${formatearDuracion(t.info.length)}**\n`;
        });
    }

    desc += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

    const durTotal = cola.tracks.reduce((acc, t) => acc + (t.info.length || 0), 0);
    const loopTexto = cola.loop === 'off' ? 'Off' : cola.loop === 'track' ? '🔂 Canción' : '🔁 Cola';

    desc += `\n\n📊 **${cola.tracks.length}** en cola • ⏱️ **${formatearDuracion(durTotal)}** total\n` +
            `🔄 Loop: **${loopTexto}** • 🔊 Volumen: **${cola.volume}%**`;

    const embed = basePremium(`📋 Cola de Reproducción • Pág. ${pagina + 1}/${totalPaginas}`, desc, COLORES.azul);

    const fila1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`musica:queue_prev:all:${pagina}`)
            .setLabel('◀ Anterior')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pagina === 0),
        new ButtonBuilder()
            .setCustomId(`musica:queue_next:all:${pagina}`)
            .setLabel('Siguiente ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pagina >= totalPaginas - 1),
        new ButtonBuilder()
            .setCustomId('musica:np_back:all')
            .setLabel('Reproductor')
            .setEmoji('🎵')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('musica:shuffle:all')
            .setLabel('Mezclar')
            .setEmoji('🔀')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(cola.tracks.length < 2),
        new ButtonBuilder()
            .setCustomId('musica:clear_queue:all')
            .setLabel('Vaciar')
            .setEmoji('🧹')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(cola.tracks.length === 0)
    );

    const components = [fila1];

    if (pistasPagina.length > 0) {
        const opcionesQuitar = pistasPagina.map((t, idx) => {
            const realIdx = inicio + idx;
            return {
                label: `Quitar #${realIdx + 1}: ${t.info.title.slice(0, 75)}`,
                description: `${(t.info.author || 'Desconocido').slice(0, 35)} • [${formatearDuracion(t.info.length)}]`,
                value: String(realIdx),
                emoji: '🗑️',
            };
        });

        const fila2 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`musica:remove_select:all:${pagina}`)
                .setPlaceholder('🗑️ Selecciona una canción para quitarla de la cola...')
                .addOptions(opcionesQuitar)
        );
        components.push(fila2);
    }

    return { embeds: [embed], components };
}

module.exports = {
    panelNowPlaying,
    panelCola,
};

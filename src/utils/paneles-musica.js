// src/utils/paneles-musica.js
// Paneles visuales interactivos, ultra-minimalistas y profesionales para el sistema de música.
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require('discord.js');
const { basePremium, COLORES } = require('./embeds');
const { formatearDuracion } = require('../services/musica');

// ── Panel Standby Minimalista (Cuando no hay música sonando) ──
function panelEsperaMusica() {
    const desc = 
        '### 🎧 No hay música sonando\n' +
        '> Escribe el **nombre de una canción** o pega un **enlace** aquí abajo para reproducir.\n\n' +
        '⚡ **Fuentes:** `YouTube` • `Spotify` • `SoundCloud`\n' +
        '🎮 **Comandos:** `/play`, `/skip`, `/queue`, `/stop`';

    const embed = basePremium('🎵 Reproductor • La Cripta', desc, COLORES.morado);
    embed.setFooter({ text: '🎃 La Cripta de los Huesos • Sistema de Audio' });

    const fila1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('musica:pause_resume:all').setLabel('Pausar/Reanudar').setEmoji('⏯️').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('musica:skip:all').setLabel('Saltar').setEmoji('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('musica:stop:all').setLabel('Detener').setEmoji('⏹️').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('musica:loop:all').setLabel('Loop').setEmoji('🔁').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('musica:shuffle:all').setLabel('Mezclar').setEmoji('🔀').setStyle(ButtonStyle.Secondary).setDisabled(true)
    );

    const fila2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('musica:vol_down:all').setLabel('-10%').setEmoji('🔉').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('musica:vol_up:all').setLabel('+10%').setEmoji('🔊').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('musica:mute:all').setLabel('Mute').setEmoji('🔇').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('musica:queue:all:0').setLabel('Cola (0)').setEmoji('📋').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('musica:np_refresh:all').setLabel('Refrescar').setEmoji('🔄').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [fila1, fila2] };
}

// ── Panel Now Playing Minimalista con Imagen Grande y Sin Barra de Progreso ──
function panelNowPlaying(cola, userId) {
    const track = cola?.current;
    if (!track) {
        return panelEsperaMusica();
    }

    const info = track.info;
    const durTotal = formatearDuracion(info.length);
    const loopTexto = cola.loop === 'track' ? '🔂 Canción' : cola.loop === 'queue' ? '🔁 Cola' : 'Off';
    const volEmoji = cola.volume === 0 ? '🔇' : cola.volume < 50 ? '🔉' : '🔊';
    const requesterTag = track.requester?.id ? `<@${track.requester.id}>` : (track.requester?.tag || 'Mortal');

    // ── Descripción Minimalista y Elegante (Sin barra de progreso) ──
    const desc = 
        `### [${info.title}](${info.uri})\n` +
        `👤 **Artista:** \`${info.author || 'Desconocido'}\`\n` +
        `⏱️ **Duración:** \`${durTotal}\`  •  ${volEmoji} **Volumen:** \`${cola.volume}%\`  •  🔁 **Loop:** \`${loopTexto}\`\n` +
        `🎧 **Pedida por:** ${requesterTag}`;

    const embed = basePremium('🎵 Reproduciendo Ahora', desc, COLORES.morado);

    // ── IMAGEN EN GRANDE (Full Width Banner) ──
    if (info.artworkUrl) {
        let imgGrande = info.artworkUrl;
        if (imgGrande.includes('hqdefault.jpg')) {
            imgGrande = imgGrande.replace('hqdefault.jpg', 'maxresdefault.jpg');
        }
        embed.setImage(imgGrande);
    }

    // ── LISTA DE ESPERA EN VIVO (Minimalista) ──
    if (cola.tracks && cola.tracks.length > 0) {
        const maxVista = 5;
        const listaItems = cola.tracks.slice(0, maxVista).map((t, idx) => {
            const req = t.requester?.id ? `<@${t.requester.id}>` : (t.requester?.tag || 'Mortal');
            const dur = formatearDuracion(t.info.length);
            const titulo = t.info.title.length > 40 ? t.info.title.slice(0, 38) + '...' : t.info.title;
            return `\`#${idx + 1}\` [${titulo}](${t.info.uri}) \`[${dur}]\` • ${req}`;
        }).join('\n');

        let extra = '';
        if (cola.tracks.length > maxVista) {
            extra = `\n*(+ ${cola.tracks.length - maxVista} más en espera. Usa \`/queue\` para ver todas)*`;
        }

        embed.addFields({
            name: `📜 Lista de Espera (${cola.tracks.length})`,
            value: listaItems + extra,
            inline: false,
        });
    }

    if (track.requester) {
        embed.setFooter({
            text: `La Cripta • Pedida por: ${track.requester.tag || 'Mortal'}`,
            iconURL: track.requester.avatar || undefined,
        });
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
            .setDisabled(cola.tracks ? cola.tracks.length < 2 : true)
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
            .setLabel(`Cola (${cola.tracks ? cola.tracks.length : 0})`)
            .setEmoji('📋')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('musica:np_refresh:all')
            .setLabel('Refrescar')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Secondary)
    );

    const components = [fila1, fila2];

    // Fila 3: Salto directo con Select Menu
    if (cola.tracks && cola.tracks.length > 0) {
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

// ── Panel de Cola Interactiva con Paginación ──
function panelCola(cola, userId, pagina = 0) {
    const porPagina = 8;
    const totalPaginas = Math.max(1, Math.ceil((cola.tracks?.length || 0) / porPagina));
    pagina = Math.max(0, Math.min(pagina, totalPaginas - 1));

    let desc = '';

    if (cola.current) {
        const info = cola.current.info;
        const dur = formatearDuracion(info.length);
        desc += '🎵 **Sonando ahora:**\n';
        desc += `[${info.title}](${info.uri})\n` +
                `👤 *${info.author || 'Desconocido'}* • ⏱️ \`${dur}\`\n\n`;
    }

    desc += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    const inicio = pagina * porPagina;
    const fin = Math.min(inicio + porPagina, cola.tracks?.length || 0);
    const pistasPagina = (cola.tracks || []).slice(inicio, fin);

    if (!cola.tracks || cola.tracks.length === 0) {
        desc += '\n*La cola está vacía. Escribe una canción para agregarla.*\n';
    } else {
        pistasPagina.forEach((t, i) => {
            const num = inicio + i + 1;
            const req = t.requester?.id ? `<@${t.requester.id}>` : (t.requester?.tag || 'Mortal');
            desc += `**${num}.** [${t.info.title.slice(0, 50)}](${t.info.uri})\n` +
                    `   👤 *${(t.info.author || 'Desconocido').slice(0, 25)}* • ⏱️ **${formatearDuracion(t.info.length)}** • Por: ${req}\n`;
        });
    }

    desc += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

    const durTotal = (cola.tracks || []).reduce((acc, t) => acc + (t.info.length || 0), 0);
    const loopTexto = cola.loop === 'off' ? 'Off' : cola.loop === 'track' ? '🔂 Canción' : '🔁 Cola';

    desc += `\n\n📊 **${cola.tracks?.length || 0}** en cola • ⏱️ **${formatearDuracion(durTotal)}** total\n` +
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
            .setDisabled((cola.tracks?.length || 0) < 2),
        new ButtonBuilder()
            .setCustomId('musica:clear_queue:all')
            .setLabel('Vaciar')
            .setEmoji('🧹')
            .setStyle(ButtonStyle.Danger)
            .setDisabled((cola.tracks?.length || 0) === 0)
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
    panelEsperaMusica,
    panelNowPlaying,
    panelCola,
};

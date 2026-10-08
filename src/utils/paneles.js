// src/utils/paneles.js
// Constructores de paneles (embed + componentes) del hub /cripta (Versión simplificada y limpia).
// Formato customId: prefijo:accion:duenoId:extra
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require('discord.js');
const { base, basePremium, COLORES, formatoNum, tiempoRelativo, BARRA_PROGRESO } = require('./embeds');
const { TOPE_RACHA } = require('../services/diario');
const config = require('../data/config');

const boton = (accion, duenoId, etiqueta, emoji, estilo = ButtonStyle.Secondary, deshabilitado = false, extra = '') => {
    const customId = extra ? `cripta:${accion}:${duenoId}:${extra}` : `cripta:${accion}:${duenoId}`;
    const btn = new ButtonBuilder().setCustomId(customId).setLabel(etiqueta).setStyle(estilo).setDisabled(deshabilitado);
    if (emoji) btn.setEmoji(emoji);
    return btn;
};

const filaVolver = (duenoId) =>
    new ActionRowBuilder().addComponents(boton('menu', duenoId, 'Volver al Menú', '⬅️'));

// ─── MENÚ PRINCIPAL DEL HUB ───
function panelMenu(duenoId, usuario) {
    const embed = base(
        '🎃 La Cripta de los Huesos',
        `> *Bienvenido a la Cripta. Reúne huesos chateando, en salas de voz, con cacerías y duelos para conquistar el podio.*\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🦴 **Tus huesos:** ${formatoNum(usuario.huesos)}\n` +
            `🔥 **Racha diaria:** ${usuario.rachaDiaria || 0} día(s)\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━`,
        COLORES.naranja
    );

    // Fila 1: Cazar, Diario, Apostar, Ranking
    const fila1 = new ActionRowBuilder().addComponents(
        boton('cazar', duenoId, 'Cazar', '🏹', ButtonStyle.Primary),
        boton('diario', duenoId, 'Diario', '🎁', ButtonStyle.Success),
        boton('apostar', duenoId, 'Apostar', '🎰', ButtonStyle.Danger),
        boton('ranking', duenoId, 'Ranking', '🏆', ButtonStyle.Secondary)
    );

    // Fila 2: Mi Perfil, Guía / Ayuda
    const fila2 = new ActionRowBuilder().addComponents(
        boton('perfil', duenoId, 'Mi Perfil', '👤', ButtonStyle.Secondary),
        boton('ayuda', duenoId, '¿Cómo Jugar?', '❓', ButtonStyle.Primary)
    );

    return { embeds: [embed], components: [fila1, fila2] };
}

// ─── PERFIL DEL CAZADOR ───
function panelPerfil(duenoId, usuario, nombre, posicion, total, avatarURL) {
    const e = usuario.estadisticas || {};
    const pctRanking = total > 1 ? 1 - ((posicion - 1) / (total - 1)) : 1;
    const barra = BARRA_PROGRESO(pctRanking);

    const embed = basePremium(
        `👤 ${nombre}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🦴 **${formatoNum(usuario.huesos)}** huesos\n` +
        `🏆 Posición #${formatoNum(posicion)} de ${formatoNum(total)}\n` +
        `${barra} ${Math.round(pctRanking * 100)}% del top\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━`,
        COLORES.morado
    );
    if (avatarURL) embed.setThumbnail(avatarURL);
    embed.addFields(
        { name: '🏆 Posición', value: `#${formatoNum(posicion)} de ${formatoNum(total)}`, inline: true },
        { name: '🔥 Racha diaria', value: `${usuario.rachaDiaria || 0} día(s)`, inline: true },
        { name: '🏹 Cacerías', value: `${e.cazados || 0}`, inline: true },
        { name: '🎁 Diarios reclamados', value: `${e.diarios || 0}`, inline: true },
        {
            name: '🎰 Estadísticas de Apuestas',
            value: `• Apostado: **${formatoNum(e.apostado || 0)}** 🦴\n` +
                   `• Ganado: **${formatoNum(e.ganado || 0)}** 🦴\n` +
                   `• Perdido: **${formatoNum(e.perdido || 0)}** 🦴`,
            inline: true,
        },
        {
            name: '⚔️ Duelos PvP',
            value: `• Victorias: **${e.duelosGanados || 0}** 🏆\n` +
                   `• Derrotas: **${e.duelosPerdidos || 0}** 💀\n` +
                   `• Total: **${(e.duelosGanados || 0) + (e.duelosPerdidos || 0)}**`,
            inline: true,
        }
    );
    return { embeds: [embed], components: [filaVolver(duenoId)] };
}

// ─── DIARIO ───
function panelDiario(duenoId, r) {
    if (!r.ok) {
        if (r.motivo === 'cooldown') {
            const embed = base(
                '⏳ Recompensa Diaria Ya Reclamada',
                `Ya has recibido tu bendición de ultratumba el día de hoy.\n\n` +
                `Podrás reclamar de nuevo ${tiempoRelativo(r.proximo)}.\n\n` +
                `🔥 Tu racha actual es de **${r.racha}** día(s).`,
                COLORES.morado
            );
            return { embeds: [embed], components: [filaVolver(duenoId)] };
        }
        if (r.motivo === 'evento_cerrado') {
            const embed = base('🕯️ La Cripta ha cerrado', 'El evento ha finalizado.', COLORES.negro);
            return { embeds: [embed], components: [filaVolver(duenoId)] };
        }
        const embed = base('⏳ Un momento', 'Se está procesando tu solicitud.', COLORES.morado);
        return { embeds: [embed], components: [filaVolver(duenoId)] };
    }

    const bonusTexto = r.racha > 1 ? ` (incluye bonus de racha x${r.racha})` : '';
    const multTexto = r.multiplicador > 1 ? ` ¡x${r.multiplicador} por evento activo!` : '';

    const embed = base(
        '🎁 ¡Recompensa Diaria Reclamada!',
        `Las almas benevolentes de la Cripta te entregan tu ofrenda.\n\n` +
        `🦴 Has recibido: **+${formatoNum(r.premio)}** huesos 🦴${bonusTexto}${multTexto}\n` +
        `🔥 Racha actual: **${r.racha}** día(s) (máximo ${TOPE_RACHA} días)\n` +
        `💰 Saldo actual: **${formatoNum(r.usuario.huesos)}** huesos.\n\n` +
        `_Vuelve mañana para seguir aumentando tu racha y tus ganancias._`,
        COLORES.verde
    );

    return { embeds: [embed], components: [filaVolver(duenoId)] };
}

// ─── CACERÍA ANIMACIÓN Y RESULTADO ───
function panelCazarAnimacion(paso = 1) {
    if (paso === 1) {
        return {
            embeds: [
                base(
                    '🏹 Adentrándote en las Sombras...',
                    'Caminas entre lápidas rotas y una niebla espesa y gélida...\n' +
                    '_Escuchas susurros lejanos..._',
                    COLORES.morado
                ),
            ],
            components: [],
        };
    }
    return {
        embeds: [
            base(
                '🏹 Cavando en la Tierra Profanada...',
                'Remueves la tierra húmeda junto a un viejo mausoleo...\n' +
                '_¡Tus manos tocan algo enterrado!_',
                COLORES.naranja
            ),
        ],
        components: [],
    };
}

function panelCazar(duenoId, r) {
    if (!r.ok) {
        if (r.motivo === 'cooldown') {
            const embed = base(
                '⏳ Descanso del Cazador',
                `Las ánimas del cementerio aún recuerdan tus pasos.\n\n` +
                `Podrás volver a cazar ${tiempoRelativo(r.proximo)}.\n\n` +
                `💡 *Consejo: Mientras esperas, ¡escribe en el chat o habla en salas de voz para seguir acumulando huesos!*`,
                COLORES.morado
            );
            return { embeds: [embed], components: [filaVolver(duenoId)] };
        }
        if (r.motivo === 'evento_cerrado') {
            const embed = base('🕯️ La Cripta ha cerrado', 'El evento ha finalizado.', COLORES.negro);
            return { embeds: [embed], components: [filaVolver(duenoId)] };
        }
        const embed = base('⏳ Un momento', 'Se está procesando otra acción. Intenta de nuevo en un segundo.', COLORES.morado);
        return { embeds: [embed], components: [filaVolver(duenoId)] };
    }

    let color = COLORES.verde;
    let icono = '🏹';

    if (r.tipo === 'hueso_raro') {
        color = COLORES.naranja;
        icono = '✨';
    } else if (r.tipo === 'calabaza_sorpresa') {
        color = COLORES.naranja;
        icono = '🎃';
    }

    const embed = base(
        `${icono} ${r.titulo}`,
        `${r.descripcion}\n\n` +
        `🦴 Has ganado: **+${formatoNum(r.premio)}** huesos${r.multiplicador > 1 ? ` (¡x${r.multiplicador} por bonus!)` : ''}\n` +
        `💰 Saldo actual: **${formatoNum(r.usuario.huesos)}** huesos.`,
        color
    );

    return { embeds: [embed], components: [filaVolver(duenoId)] };
}

// ─── RANKING ───
function panelRanking(duenoId, datos) {
    const MEDALLAS = ['🥇', '🥈', '🥉'];
    const inicioPuesto = (datos.pagina - 1) * 10;

    let descripcion = '🏆 **Tabla de Clasificación de la Cripta**\n\n';

    if (datos.usuarios.length === 0) {
        descripcion += '_No hay cazadores registrados aún en el reino._\n';
    } else {
        datos.usuarios.forEach((u, i) => {
            const puesto = inicioPuesto + i + 1;
            const icono = MEDALLAS[puesto - 1] || `\`#${puesto}\``;
            const esDueno = u.userId === duenoId;
            const linea = `${icono} <@${u.userId}> — **${formatoNum(u.huesos)}** 🦴`;
            descripcion += esDueno ? `👉 **${linea}**\n` : `${linea}\n`;
        });
    }

    descripcion += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    descripcion += `👤 **Tu posición:** #${formatoNum(datos.solicitante.posicion)} de ${formatoNum(datos.totalUsuarios)} ` +
        `| 🦴 **${formatoNum(datos.solicitante.huesos)}** huesos`;

    const embed = base('🏆 Ranking de los Condenados', descripcion, COLORES.naranja);
    embed.setFooter({ text: `Página ${datos.pagina} de ${datos.totalPaginas} • 🎃 La Cripta de los Huesos` });

    const btnAnterior = boton('ranking', duenoId, '◀ Anterior', null, ButtonStyle.Primary, datos.pagina <= 1, String(datos.pagina - 1));
    const btnVolver = boton('menu', duenoId, 'Volver', '⬅️', ButtonStyle.Secondary);
    const btnSiguiente = boton('ranking', duenoId, 'Siguiente ▶', null, ButtonStyle.Primary, datos.pagina >= datos.totalPaginas, String(datos.pagina + 1));

    const filaPaginacion = new ActionRowBuilder().addComponents(btnAnterior, btnVolver, btnSiguiente);
    return { embeds: [embed], components: [filaPaginacion] };
}

// ─── APUESTAS ───
function panelMenuApuestas(duenoId, usuario) {
    const maxPermitido = Math.min(
        Math.floor(usuario.huesos * config.APUESTAS.MAXIMO_PORCENTAJE),
        config.APUESTAS.MAXIMA_ABSOLUTA
    );

    const desc = `🎲 **El Antro de las Ánimas — Apuestas**\n` +
        `Elige tu juego en el menú desplegable:\n\n` +
        `🪙 **Cara o Cruz**: Lanza la moneda espectral. 50% prob. | Paga **x2.0**\n` +
        `🎰 **Tragamonedas**: 3 carretes de Halloween (🎃 👻 💀 🦴 🕷️) | Hasta **x15.0**\n` +
        `👥 **Ruleta Grupal**: Ronda pública de 30s en el canal donde todos pueden apostar\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🦴 **Tus huesos disponibles:** ${formatoNum(usuario.huesos)}\n` +
        `⚖️ **Límites:** Mínimo **${config.APUESTAS.MINIMA}** | Máximo **${formatoNum(maxPermitido)}** huesos`;

    const embed = base('🎰 El Antro de las Ánimas — Apuestas', desc, COLORES.morado);

    const selectJuegos = new StringSelectMenuBuilder()
        .setCustomId(`cripta:sel_juego:${duenoId}`)
        .setPlaceholder('Elige un juego para apostar...')
        .addOptions([
            {
                label: 'Cara o Cruz',
                value: 'cara_cruz',
                description: 'Lanza la moneda espectral y duplica tus huesos (x2.0)',
                emoji: '🪙',
            },
            {
                label: 'Tragamonedas de Halloween',
                value: 'tragamonedas',
                description: 'Gira los 3 carretes malditos y alinea símbolos (hasta x15.0)',
                emoji: '🎰',
            },
            {
                label: 'Ruleta Grupal (Pública)',
                value: 'ruleta_grupal',
                description: 'Inicia una ronda comunitaria de 30s en el canal',
                emoji: '👥',
            },
        ]);

    const filaSelect = new ActionRowBuilder().addComponents(selectJuegos);
    return { embeds: [embed], components: [filaSelect, filaVolver(duenoId)] };
}

function panelAnimacionApuesta(juego, frame = 1) {
    let titulo = '🎰 Apostando...';
    let descripcion = 'La suerte de ultratumba está decidiéndose...';
    let color = COLORES.morado;

    if (juego === 'cara_cruz') {
        titulo = '🪙 Lanzando la moneda maldita...';
        descripcion = 'La moneda gira en el aire entre sombras... ¿Cara o Cruz?';
    } else if (juego === 'tragamonedas') {
        titulo = '🎰 Girando carretes de Halloween...';
        descripcion = typeof frame === 'object' && frame.s1
            ? `[ ${frame.s1} | 🔄 | 🔄 ]\n¡Los carretes se van deteniendo!`
            : `[ 🔄 | 🔄 | 🔄 ]\n¡Espíritus alineando los símbolos!`;
    }

    return { embeds: [base(titulo, descripcion, color)], components: [] };
}

function panelResultadoApuesta(duenoId, res, tipoJuego, monto, extra) {
    if (!res.ok) {
        let mensaje = 'No se pudo procesar la apuesta.';
        if (res.motivo === 'saldo_insuficiente') mensaje = 'No tienes suficientes huesos para esta apuesta.';
        if (res.motivo === 'cooldown') mensaje = `Espera **${Math.ceil((res.restanteMs || 3000) / 1000)}s** antes de volver a apostar.`;
        if (res.motivo === 'invalido') mensaje = res.detalle;
        if (res.motivo === 'evento_cerrado') mensaje = 'La Cripta ya ha cerrado sus puertas.';

        const embedError = base('❌ Apuesta Rechazada', mensaje, COLORES.rojo);
        return { embeds: [embedError], components: [filaVolver(duenoId)] };
    }

    const color = res.gana ? COLORES.verde : COLORES.rojo;
    const titulo = res.gana ? '🎉 ¡VICTORIA ESPECTRAL!' : '💀 LA CASA DE LAS ÁNIMAS GANA';

    let descripcion = '';

    if (res.juego === 'cara_cruz') {
        descripcion = `🪙 La moneda cayó en: **${res.resultado.toUpperCase()}**\n` +
            `Tu predicción: **${res.eleccion.toUpperCase()}**\n\n`;
        if (res.gana) {
            descripcion += `💰 ¡Has ganado **+${formatoNum(res.premio)}** huesos! 🦴\n`;
        } else {
            descripcion += `🩸 Has perdido **-${formatoNum(res.monto)}** huesos.\n`;
        }
        descripcion += `🦴 Saldo actual: **${formatoNum(res.saldoFinal)}** huesos.`;
    } else if (res.juego === 'tragamonedas') {
        descripcion = `🎰 Carretes: [ ${res.carretes.join(' | ')} ]\n` +
            `Combinación: **${res.combinacion}**\n\n`;
        if (res.gana) {
            descripcion += `💰 ¡Has ganado **+${formatoNum(res.premio)}** huesos! (x${res.mult})\n`;
        } else {
            descripcion += `🩸 Has perdido **-${formatoNum(res.monto)}** huesos.\n`;
        }
        descripcion += `🦴 Saldo actual: **${formatoNum(res.saldoFinal)}** huesos.`;
    }

    const embed = base(titulo, descripcion, color);

    const btnRepetir = new ButtonBuilder()
        .setCustomId(`apuesta:repetir:${duenoId}:${tipoJuego}:${monto}:${extra}`)
        .setLabel(`Apostar de nuevo (${formatoNum(monto)} 🦴)`)
        .setEmoji('🔁')
        .setStyle(ButtonStyle.Success);

    const btnCambiarJuego = new ButtonBuilder()
        .setCustomId(`cripta:apostar:${duenoId}`)
        .setLabel('Cambiar Juego')
        .setEmoji('🎲')
        .setStyle(ButtonStyle.Primary);

    const btnMenu = new ButtonBuilder()
        .setCustomId(`cripta:menu:${duenoId}`)
        .setLabel('Menú')
        .setEmoji('⬅️')
        .setStyle(ButtonStyle.Secondary);

    const filaBotones = new ActionRowBuilder().addComponents(btnRepetir, btnCambiarJuego, btnMenu);
    return { embeds: [embed], components: [filaBotones] };
}

// ─── GUÍA Y AYUDA (/ayuda) ───
function panelAyuda(duenoId) {
    const desc = 
        `Bienvenido a **La Cripta de los Huesos**, el evento de Halloween donde todos compiten por acumular la mayor cantidad de huesos 🦴 antes de la noche del **31 de Octubre**.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🦴 **¿CÓMO GANAR HUESOS SIENDO ACTIVO?**\n` +
        `• 💬 **Actividad en Chat:** Habla en cualquier canal de texto. Cada mensaje que envíes tiene oportunidad de darte huesos automáticamente (con cooldown anti-spam).\n` +
        `• 🎙️ **Salas de Voz (VC):** Pasa tiempo hablando en llamadas (mínimo 2 personas en la sala sin ensordecer) y recibirás huesos periódicamente por tu tiempo en voz.\n` +
        `• 🎁 **Recompensa Diaria:** Entra a \`/cripta\` y reclama tu bono diario cada 24 horas. ¡Cada día consecutivo aumentará tu racha y tus ganancias!\n` +
        `• 🏹 **Cacería Espectral:** Cada 1 hora puedes explorar el cementerio desde \`/cripta\` para desenterrar huesos comunes, calabazas o cráneos dorados.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👻 **EVENTOS ALEATORIOS EN EL CHAT**\n` +
        `¡Mantente atento al chat! Espontáneamente ocurrirán apariciones sorpresa:\n` +
        `• 👻 **Fantasma Fugaz:** Aparece un espectro por 60s. ¡El primero en pulsar el botón lo atrapa y se queda los huesos!\n` +
        `• 🎃 **Aparición de Huesos:** Emerge una pila de huesos en el cementerio. ¡El primero en pulsar el botón los recolecta!\n` +
        `• 📜 **Trivia del Terror:** Preguntas de Halloween y cine de terror. El primero en acertar la opción correcta gana el botín.\n` +
        `• 🌕 **Eclipse Espectral:** Noche de luna carmesí donde ¡todas las ganancias de huesos se multiplican por x2 durante 30 minutos!\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🎰 **APUESTAS Y DUELOS**\n` +
        `• ⚔️ **Duelos PvP (\`/duelo @usuario\`):** Reta a otro miembro a un duelo de reflejos apostando huesos.\n` +
        `• 🪙 **Apuestas con el Bot:** Juega a **Cara o Cruz** o la **Tragamonedas** desde \`/cripta\` para arriesgar y multiplicar tus huesos.\n` +
        `• 🏆 **Ranking:** Consulta las posiciones del servidor con el botón Ranking o en el Salón de la Fama. ¡El Top 3 final se llevará la gloria!`;

    const embed = basePremium('🎃 Guía del Evento — La Cripta de los Huesos', desc, COLORES.naranja);
    embed.setFooter({ text: '🎃 ¡Chatea, conéctate a voz, diviértete y escala al podio!' });

    return { embeds: [embed], components: [filaVolver(duenoId)] };
}

module.exports = {
    panelMenu,
    panelPerfil,
    panelDiario,
    panelCazarAnimacion,
    panelCazar,
    panelRanking,
    panelMenuApuestas,
    panelAnimacionApuesta,
    panelResultadoApuesta,
    panelAyuda,
    filaVolver,
};

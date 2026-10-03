// src/utils/paneles.js
// Constructores de paneles (embed + componentes) del hub /cripta.
// Formato customId:  prefijo:accion:duenoId:extra
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { base, COLORES, formatoNum, tiempoRelativo } = require('./embeds');
const { TOPE_RACHA } = require('../services/diario');
const config = require('../data/config');

const boton = (accion, duenoId, etiqueta, emoji, estilo = ButtonStyle.Secondary, deshabilitado = false, extra = '') => {
    const customId = extra ? `cripta:${accion}:${duenoId}:${extra}` : `cripta:${accion}:${duenoId}`;
    const btn = new ButtonBuilder().setCustomId(customId).setLabel(etiqueta).setStyle(estilo).setDisabled(deshabilitado);
    if (emoji) btn.setEmoji(emoji);
    return btn;
};

const filaVolver = (duenoId) =>
    new ActionRowBuilder().addComponents(boton('menu', duenoId, 'Volver', '⬅️'));

function panelMenu(duenoId, usuario) {
    const embed = base(
        '🎃 La Cripta de los Huesos',
        `Bienvenido a la Cripta. Reúne huesos, desafía la suerte y llega al top antes del cierre.\n\n` +
            `🦴 **Tus huesos:** ${formatoNum(usuario.huesos)}`,
        COLORES.naranja
    );

    const fila1 = new ActionRowBuilder().addComponents(
        boton('cazar', duenoId, 'Cazar', '🏹', ButtonStyle.Primary),
        boton('diario', duenoId, 'Diario', '🎁', ButtonStyle.Success),
        boton('apostar', duenoId, 'Apostar', '🎰', ButtonStyle.Danger),
        boton('tienda', duenoId, 'Tienda', '🛒')
    );
    const fila2 = new ActionRowBuilder().addComponents(
        boton('inventario', duenoId, 'Inventario', '🎒'),
        boton('ranking', duenoId, 'Ranking', '🏆'),
        boton('perfil', duenoId, 'Perfil', '👤')
    );
    return { embeds: [embed], components: [fila1, fila2] };
}

function panelPerfil(duenoId, usuario, nombre, posicion, total) {
    const ahora = new Date();
    const efectos = (usuario.efectos || []).filter((e) => e.expiraEn && e.expiraEn > ahora);
    const e = usuario.estadisticas || {};

    const embed = base(`👤 Perfil de ${nombre}`, `🦴 **${formatoNum(usuario.huesos)}** huesos`, COLORES.morado).addFields(
        { name: '🏆 Posición', value: `#${formatoNum(posicion)} de ${formatoNum(total)}`, inline: true },
        { name: '🔥 Racha diaria', value: `${usuario.rachaDiaria || 0} día(s)`, inline: true },
        { name: '🏹 Cacerías', value: `${e.cazados || 0}`, inline: true },
        { name: '🎁 Diarios reclamados', value: `${e.diarios || 0}`, inline: true },
        {
            name: '🎰 Estadísticas de Apuestas',
            value: `• Apostado: **${formatoNum(e.apostado || 0)}** 🦴\n` +
                   `• Ganado: **${formatoNum(e.ganado || 0)}** 🦴\n` +
                   `• Perdido: **${formatoNum(e.perdido || 0)}** 🦴\n` +
                   `• Duelos: **${e.duelosGanados || 0}V** - **${e.duelosPerdidos || 0}D**`,
            inline: false,
        },
        {
            name: '✨ Efectos activos',
            value: efectos.length ? efectos.map((x) => `• ${x.tipo} (${tiempoRelativo(x.expiraEn.getTime())})`).join('\n') : 'Ninguno',
            inline: false,
        }
    );
    return { embeds: [embed], components: [filaVolver(duenoId)] };
}

function panelDiario(duenoId, r) {
    let embed;
    if (r.ok) {
        embed = base(
            '🎁 ¡Recompensa diaria!',
            `Recibes **+${formatoNum(r.premio)}** 🦴${r.multiplicador > 1 ? ` (¡x${r.multiplicador} por evento!)` : ''}\n` +
                `🔥 Racha: **${r.racha}** día(s) ${r.racha >= TOPE_RACHA ? '(bono máximo)' : ''}\n\n` +
                `🦴 Ahora tienes **${formatoNum(r.usuario.huesos)}** huesos.`,
            COLORES.verde
        );
    } else if (r.motivo === 'cooldown') {
        embed = base('🎁 Aún no está listo', `Tu próxima recompensa estará disponible ${tiempoRelativo(r.proximo)}.`, COLORES.morado);
    } else if (r.motivo === 'evento_cerrado') {
        embed = base('🕯️ El evento terminó', 'La Cripta ya cerró sus puertas. ¡Gracias por jugar!', COLORES.negro);
    } else {
        embed = base('⏳ Un momento', 'Estoy procesando tu acción anterior. Intenta de nuevo en un segundo.', COLORES.morado);
    }
    return { embeds: [embed], components: [filaVolver(duenoId)] };
}

function panelCazarAnimacion(paso) {
    let titulo;
    let descripcion;
    let color;

    if (paso === 1) {
        titulo = '🌫️ Explorando el cementerio...';
        descripcion = 'Cruzas las rejas oxidadas y te adentras en la niebla espectral.\n\n_Buscando tumbas olvidadas..._';
        color = COLORES.morado;
    } else {
        titulo = '👀 ¡Algo se mueve!';
        descripcion = 'Un sonido seco rompe el silencio nocturno.\n¡La tierra se remueve bajo tus botas!\n\n_Desenterrando el hallazgo..._';
        color = COLORES.naranja;
    }

    const embed = base(titulo, descripcion, color);
    return { embeds: [embed], components: [] };
}

function panelCazar(duenoId, r) {
    let embed;

    if (!r.ok) {
        if (r.motivo === 'cooldown') {
            embed = base(
                '🏹 El cementerio descansa en paz',
                `Aún estás exhausto por tu última expedición.\n` +
                `Podrás volver a cazar ${tiempoRelativo(r.proximo)}.`,
                COLORES.morado
            );
        } else if (r.motivo === 'evento_cerrado') {
            embed = base('🕯️ La Cripta ha cerrado', 'El evento ha finalizado y el cementerio ha quedado en silencio.', COLORES.negro);
        } else {
            embed = base('⏳ Un momento', 'Estoy procesando tu acción anterior. Intenta de nuevo en un segundo.', COLORES.morado);
        }
        return { embeds: [embed], components: [filaVolver(duenoId)] };
    }

    if (r.tipo === 'hueso_comun') {
        embed = base(
            `🏹 ${r.titulo}`,
            `${r.descripcion}\n\n` +
            `🦴 Has ganado: **+${formatoNum(r.premio)}** huesos${r.multiplicador > 1 ? ` (¡x${r.multiplicador} por bonus!)` : ''}\n` +
            `💰 Saldo actual: **${formatoNum(r.usuario.huesos)}** huesos.`,
            COLORES.verde
        );
    } else if (r.tipo === 'hueso_raro') {
        embed = base(
            `🌟 ${r.titulo}`,
            `${r.descripcion}\n\n` +
            `✨ **¡Recompensa Legendaria!**\n` +
            `🦴 Has ganado: **+${formatoNum(r.premio)}** huesos${r.multiplicador > 1 ? ` (¡x${r.multiplicador} por bonus!)` : ''}\n` +
            `💰 Saldo actual: **${formatoNum(r.usuario.huesos)}** huesos.`,
            COLORES.naranja
        );
    } else if (r.tipo === 'item') {
        embed = base(
            `🎁 ${r.titulo}`,
            `${r.descripcion}\n\n` +
            `${r.item.emoji} **${r.item.nombre}**\n` +
            `📜 _${r.item.descripcion}_\n\n` +
            `🎒 Guardado en tu inventario.\n` +
            `💰 Saldo actual: **${formatoNum(r.usuario.huesos)}** huesos.`,
            COLORES.morado
        );
    } else if (r.tipo === 'emboscada') {
        const detallePerdida = r.perdida > 0
            ? `🩸 El monstruo te arrebató **-${formatoNum(r.perdida)}** huesos.`
            : `¡Por suerte no tenías huesos que pudieran robarte!`;
        embed = base(
            `👻 ${r.titulo}`,
            `${r.descripcion}\n\n` +
            `${detallePerdida}\n` +
            `💰 Saldo actual: **${formatoNum(r.usuario.huesos)}** huesos.`,
            COLORES.rojo
        );
    } else {
        embed = base(
            `🍂 ${r.titulo}`,
            `${r.descripcion}\n\n` +
            `💰 Saldo actual: **${formatoNum(r.usuario.huesos)}** huesos.`,
            COLORES.negro
        );
    }

    return { embeds: [embed], components: [filaVolver(duenoId)] };
}

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

// ─── PANELES DE APUESTAS (Fase 3) ───
function panelMenuApuestas(duenoId, usuario) {
    const maxPermitido = Math.min(
        Math.floor(usuario.huesos * config.APUESTAS.MAXIMO_PORCENTAJE),
        config.APUESTAS.MAXIMA_ABSOLUTA
    );

    const desc = `🎲 **Bienvenido al Antro de las Ánimas**\n` +
        `Aquí los espíritus juegan con el destino. Elige tu juego en el menú desplegable:\n\n` +
        `🪙 **Cara o Cruz**: 48% prob. de victoria | Paga **x2.0**\n` +
        `🎲 **Dados Malditos**: 2 dados (2-12). Bajo/Alto (x1.9), Rango 2 (x2.8), Exacto (x5.5)\n` +
        `🎡 **Ruleta de la Calabaza**: 37 casillas. Rojo/Negro (x2.0), Verde Calabaza (x14.0)\n` +
        `🎰 **Tragamonedas**: 3 carretes con 🎃👻💀🦴🕷️ (hasta **x15.0**)\n` +
        `👥 **Ruleta Grupal**: Inicia una ronda comunitaria pública de 30s en este canal\n\n` +
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
                label: 'Dados Malditos',
                value: 'dados',
                description: 'Elige tu nivel de riesgo con la suma de 2 dados (hasta x5.5)',
                emoji: '🎲',
            },
            {
                label: 'Ruleta de la Calabaza',
                value: 'ruleta',
                description: 'Apuesta al Rojo, Negro o Verde Calabaza (hasta x14.0)',
                emoji: '🎡',
            },
            {
                label: 'Tragamonedas de Halloween',
                value: 'tragamonedas',
                description: 'Gira los 3 carretes malditos y alinea símbolos',
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
        descripcion = 'La moneda gira en el aire girando velozmente entre las sombras...\n\n_¿Cara o cruz?_';
    } else if (juego === 'dados') {
        titulo = '🎲 Rodando los dados malditos...';
        descripcion = 'Los dos dados rebotan sobre lápidas agrietadas...\n\n_Calculando la suma..._';
    } else if (juego === 'ruleta') {
        titulo = '🎡 Girando la Ruleta de la Calabaza...';
        descripcion = 'La bola espectral salta entre casillas rojas, negras y la calabaza verde...\n\n🔴 ⚫ 🟢 🔴 ⚫';
    } else if (juego === 'tragamonedas') {
        titulo = '🎰 Tragamonedas de Halloween';
        if (frame === 1) descripcion = '[ 🎰 | 🎰 | 🎰 ]\n\n_Los carretes giran con frenesí..._';
        else descripcion = `[ ${frame.s1 || '🎃'} | 🎰 | 🎰 ]\n\n_Un carrete se detiene..._`;
    }

    const embed = base(titulo, descripcion, color);
    return { embeds: [embed], components: [] };
}

function panelResultadoApuesta(duenoId, res, tipoJuego, monto, extra = 'none') {
    let titulo;
    let descripcion;
    let color;

    if (!res.ok) {
        if (res.motivo === 'cooldown') {
            const seg = (res.restanteMs / 1000).toFixed(1);
            embed = base('⏳ Calma tu vicio', `Debes esperar **${seg}s** antes de apostar nuevamente.`, COLORES.morado);
        } else if (res.motivo === 'evento_cerrado') {
            embed = base('🕯️ La Cripta ha cerrado', 'El evento ha finalizado y el casino está sellado.', COLORES.negro);
        } else {
            embed = base('❌ Apuesta no realizada', res.detalle || 'No fue posible procesar tu apuesta.', COLORES.rojo);
        }
        return { embeds: [embed], components: [filaVolver(duenoId)] };
    }

    if (res.gana) {
        color = COLORES.verde;
        titulo = '🎉 ¡VICTORIA!';
    } else {
        color = COLORES.rojo;
        titulo = '💀 DERROTA';
    }

    if (res.juego === 'cara_cruz') {
        descripcion = `Elegiste: **${res.eleccion.toUpperCase()}** | Cayó: **${res.resultadoLado.toUpperCase()}**\n\n`;
        if (res.gana) {
            descripcion += `💰 ¡Has ganado **+${formatoNum(res.premio)}** huesos! 🦴\n`;
        } else {
            descripcion += `🩸 Has perdido **-${formatoNum(res.monto)}** huesos.\n`;
        }
        descripcion += `🦴 Saldo actual: **${formatoNum(res.saldoFinal)}** huesos.`;
    } else if (res.juego === 'dados') {
        descripcion = `🎲 Dados: **[ ${res.dado1} ]** y **[ ${res.dado2} ]** ➔ Suma: **${res.suma}**\n` +
            `Tu apuesta: Tipo **${res.tipoTier.toUpperCase()}** ${res.valorExtra ? `(${res.valorExtra})` : ''}\n\n`;
        if (res.gana) {
            descripcion += `💰 ¡Has ganado **+${formatoNum(res.premio)}** huesos! 🦴\n`;
        } else {
            descripcion += `🩸 Has perdido **-${formatoNum(res.monto)}** huesos.\n`;
        }
        descripcion += `🦴 Saldo actual: **${formatoNum(res.saldoFinal)}** huesos.`;
    } else if (res.juego === 'ruleta') {
        const emojiColor = res.colorResultado === 'verde' ? '🟢' : res.colorResultado === 'rojo' ? '🔴' : '⚫';
        descripcion = `🎡 Casilla ganadora: **${res.numero}** ${emojiColor} (${res.colorResultado.toUpperCase()})\n` +
            `Tu apuesta: Color **${res.colorElegido.toUpperCase()}**\n\n`;
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

    // Botones de acción: Repetir apuesta, Cambiar juego, Menú
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

function panelProximamente(duenoId, nombre, fase) {
    const embed = base(`🔒 ${nombre}`, `Esta zona de la Cripta aún está sellada.\nSe abrirá en la **Fase ${fase}**.`, COLORES.negro);
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
    panelProximamente,
    filaVolver,
};

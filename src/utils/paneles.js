// src/utils/paneles.js
// Constructores de paneles (embed + componentes) del hub /cripta.
// Formato customId:  prefijo:accion:duenoId:extra
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
} = require('discord.js');
const { base, basePremium, COLORES, formatoNum, tiempoRelativo, SEPARADOR, BARRA_PROGRESO } = require('./embeds');
const { TOPE_RACHA } = require('../services/diario');
const { ITEMS } = require('../data/items');
const config = require('../data/config');

const boton = (accion, duenoId, etiqueta, emoji, estilo = ButtonStyle.Secondary, deshabilitado = false, extra = '') => {
    const customId = extra ? `cripta:${accion}:${duenoId}:${extra}` : `cripta:${accion}:${duenoId}`;
    const btn = new ButtonBuilder().setCustomId(customId).setLabel(etiqueta).setStyle(estilo).setDisabled(deshabilitado);
    if (emoji) btn.setEmoji(emoji);
    return btn;
};

const filaVolver = (duenoId) =>
    new ActionRowBuilder().addComponents(boton('menu', duenoId, 'Volver', '⬅️'));

// ─── MENÚ PRINCIPAL DEL HUB ───
function panelMenu(duenoId, usuario) {
    const efectosActivos = (usuario.efectos || []).filter((e) => {
        if (e.expiraEn && e.expiraEn <= new Date()) return false;
        if (e.usosRestantes !== undefined && e.usosRestantes <= 0) return false;
        return true;
    });
    const efectoTexto = efectosActivos.length > 0
        ? `\n✨ **Efectos activos:** ${efectosActivos.length}`
        : '';

    const embed = base(
        '🎃 La Cripta de los Huesos',
        `> *Bienvenido a la Cripta, mortal. Reúne huesos, desafía la suerte y escala al trono antes del cierre.*\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🦴 **Tus huesos:** ${formatoNum(usuario.huesos)}\n` +
            `🔥 **Racha diaria:** ${usuario.rachaDiaria || 0} día(s)` +
            efectoTexto +
            `\n━━━━━━━━━━━━━━━━━━━━━━━━`,
        COLORES.naranja
    );

    // Fila 1: Cazar, Diario, Apostar, Tienda, Inventario (Exactamente 5 botones)
    const fila1 = new ActionRowBuilder().addComponents(
        boton('cazar', duenoId, 'Cazar', '🏹', ButtonStyle.Primary),
        boton('diario', duenoId, 'Diario', '🎁', ButtonStyle.Success),
        boton('apostar', duenoId, 'Apostar', '🎰', ButtonStyle.Danger),
        boton('tienda', duenoId, 'Tienda', '🛒'),
        boton('inventario', duenoId, 'Inventario', '🎒')
    );

    // Fila 2: Ranking, Perfil, Robar, (Limosna si califica)
    const botonesFila2 = [
        boton('ranking', duenoId, 'Ranking', '🏆'),
        boton('perfil', duenoId, 'Perfil', '👤'),
        boton('robar_menu', duenoId, 'Robar', '🕵️', ButtonStyle.Secondary),
    ];

    if (usuario.huesos < config.LIMOSNA.LIMITE_HUESOS) {
        botonesFila2.push(boton('limosna', duenoId, 'Limosna', '🤲', ButtonStyle.Primary));
    }

    const fila2 = new ActionRowBuilder().addComponents(botonesFila2);
    return { embeds: [embed], components: [fila1, fila2] };
}

// ─── PERFIL DEL CAZADOR ───
function panelPerfil(duenoId, usuario, nombre, posicion, total, avatarURL) {
    const ahora = new Date();
    const efectos = (usuario.efectos || []).filter((e) => {
        if (e.expiraEn && e.expiraEn <= ahora) return false;
        if (e.usosRestantes !== undefined && e.usosRestantes <= 0) return false;
        return true;
    });
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
                   `• Perdido: **${formatoNum(e.perdido || 0)}** 🦴\n` +
                   `• Duelos: **${e.duelosGanados || 0}V** - **${e.duelosPerdidos || 0}D**`,
            inline: false,
        },
        {
            name: '🕵️ Estadísticas de Robos',
            value: `• Robos exitosos: **${e.robosExitosos || 0}**\n` +
                   `• Robos fallidos: **${e.robosFallidos || 0}**\n` +
                   `• Veces robado: **${e.vecesRobado || 0}**`,
            inline: true,
        },
        {
            name: '✨ Efectos activos',
            value: efectos.length
                ? efectos
                      .map((x) => {
                          const item = ITEMS[x.tipo];
                          const detalle = x.expiraEn
                              ? tiempoRelativo(x.expiraEn.getTime())
                              : `${x.usosRestantes} uso(s)`;
                          return `• ${item?.emoji || '✨'} **${item?.nombre || x.tipo}** (${detalle})`;
                      })
                      .join('\n')
                : 'Ninguno',
            inline: false,
        }
    );
    return { embeds: [embed], components: [filaVolver(duenoId)] };
}

// ─── DIARIO ───
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

// ─── CAZAR ───
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

    let extraTexto = '';
    if (r.tieneLinterna) extraTexto += '🏮 _La luz de la linterna guió tus pasos entre la niebla._\n';
    if (r.detalleDobleONada) extraTexto += `${r.detalleDobleONada}\n`;
    if (r.detalleMaldicion) extraTexto += `${r.detalleMaldicion.texto}\n`;
    if (extraTexto) extraTexto = `\n━━━━━━━━━━━━━━━━━━━━\n${extraTexto}`;

    if (r.tipo === 'hueso_comun') {
        embed = base(
            `🏹 ${r.titulo}`,
            `${r.descripcion}\n\n` +
            `🦴 Has ganado: **+${formatoNum(r.premio)}** huesos${r.multiplicador > 1 ? ` (¡x${r.multiplicador} por bonus!)` : ''}\n` +
            `💰 Saldo actual: **${formatoNum(r.usuario.huesos)}** huesos.${extraTexto}`,
            COLORES.verde
        );
    } else if (r.tipo === 'hueso_raro') {
        embed = base(
            `🌟 ${r.titulo}`,
            `${r.descripcion}\n\n` +
            `✨ **¡Recompensa Legendaria!**\n` +
            `🦴 Has ganado: **+${formatoNum(r.premio)}** huesos${r.multiplicador > 1 ? ` (¡x${r.multiplicador} por bonus!)` : ''}\n` +
            `💰 Saldo actual: **${formatoNum(r.usuario.huesos)}** huesos.${extraTexto}`,
            COLORES.naranja
        );
    } else if (r.tipo === 'item') {
        embed = base(
            `🎁 ${r.titulo}`,
            `${r.descripcion}\n\n` +
            `${r.item.emoji} **${r.item.nombre}**\n` +
            `📜 _${r.item.descripcion}_\n\n` +
            `🎒 Guardado en tu inventario.\n` +
            `💰 Saldo actual: **${formatoNum(r.usuario.huesos)}** huesos.${extraTexto}`,
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
            `💰 Saldo actual: **${formatoNum(r.usuario.huesos)}** huesos.${extraTexto}`,
            COLORES.rojo
        );
    } else {
        embed = base(
            `🍂 ${r.titulo}`,
            `${r.descripcion}\n\n` +
            `💰 Saldo actual: **${formatoNum(r.usuario.huesos)}** huesos.${extraTexto}`,
            COLORES.negro
        );
    }

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
        let embed;
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

// ─── TIENDA (Fase 4) ───
function panelTienda(duenoId, usuario, itemElegidoId = null) {
    let desc = `🛒 **Bazar de los Nigromantes**\n` +
        `Artefactos y pociones forjadas para dominar la Cripta.\n\n` +
        `🦴 **Tus huesos disponibles:** ${formatoNum(usuario.huesos)}\n\n`;

    const item = itemElegidoId ? ITEMS[itemElegidoId] : null;

    if (item) {
        desc += `📌 **Ítem Seleccionado:**\n` +
            `${item.emoji} **${item.nombre}** — **${formatoNum(item.precio)}** 🦴\n` +
            `📜 _${item.descripcion}_\n\n` +
            `Selecciona una cantidad para adquirir:`;
    } else {
        desc += `Selecciona un artículo en el menú inferior para ver sus propiedades y adquirirlo.`;
    }

    const embed = base('🛒 Tienda de la Cripta', desc, COLORES.naranja);

    const selectItems = new StringSelectMenuBuilder()
        .setCustomId(`cripta:sel_tienda:${duenoId}`)
        .setPlaceholder('Elige un artículo de la tienda...')
        .addOptions(
            Object.values(ITEMS).map((it) => ({
                label: `${it.nombre} (${formatoNum(it.precio)} 🦴)`,
                value: it.id,
                description: it.descripcion.slice(0, 95),
                emoji: it.emoji,
                default: it.id === itemElegidoId,
            }))
        );

    const filaSelect = new ActionRowBuilder().addComponents(selectItems);
    const componentes = [filaSelect];

    if (item) {
        const filaComprar = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`cripta:comprar:${duenoId}:${item.id}:1`)
                .setLabel(`Comprar x1 (${formatoNum(item.precio)} 🦴)`)
                .setStyle(ButtonStyle.Success)
                .setDisabled(usuario.huesos < item.precio),
            new ButtonBuilder()
                .setCustomId(`cripta:comprar:${duenoId}:${item.id}:3`)
                .setLabel(`x3 (${formatoNum(item.precio * 3)} 🦴)`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(usuario.huesos < item.precio * 3),
            new ButtonBuilder()
                .setCustomId(`cripta:comprar:${duenoId}:${item.id}:5`)
                .setLabel(`x5 (${formatoNum(item.precio * 5)} 🦴)`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(usuario.huesos < item.precio * 5)
        );
        componentes.push(filaComprar);
    }

    componentes.push(filaVolver(duenoId));
    return { embeds: [embed], components: componentes };
}

// ─── INVENTARIO (Fase 4) ───
function panelInventario(duenoId, usuario, itemSeleccionadoId = null) {
    const ahora = new Date();
    const efectos = (usuario.efectos || []).filter((e) => {
        if (e.expiraEn && e.expiraEn <= ahora) return false;
        if (e.usosRestantes !== undefined && e.usosRestantes <= 0) return false;
        return true;
    });

    const itemsConCantidad = (usuario.inventario || []).filter((i) => i.cantidad > 0);

    let desc = `🎒 **Tu Mochila Espectral**\n\n`;

    if (itemsConCantidad.length === 0) {
        desc += `_Tu inventario está vacío. Visita la **Tienda** para conseguir artefactos._\n\n`;
    } else {
        desc += `📦 **Objetos en posesión:**\n`;
        itemsConCantidad.forEach((inv) => {
            const it = ITEMS[inv.itemId];
            if (it) {
                desc += `• ${it.emoji} **${it.nombre}** x${inv.cantidad}\n  _${it.descripcion}_\n`;
            }
        });
        desc += '\n';
    }

    desc += `✨ **Efectos Activos:**\n`;
    if (efectos.length === 0) {
        desc += `_No tienes ningún encantamiento activo actualmente._\n`;
    } else {
        efectos.forEach((ef) => {
            const it = ITEMS[ef.tipo];
            const dur = ef.expiraEn ? tiempoRelativo(ef.expiraEn.getTime()) : `${ef.usosRestantes} uso(s)`;
            desc += `• ${it?.emoji || '✨'} **${it?.nombre || ef.tipo}** (${dur})\n`;
        });
    }

    const embed = base('🎒 Inventario de Artefactos', desc, COLORES.morado);
    const componentes = [];

    if (itemsConCantidad.length > 0) {
        const selectUsar = new StringSelectMenuBuilder()
            .setCustomId(`cripta:sel_usar:${duenoId}`)
            .setPlaceholder('Selecciona un objeto de tu inventario...')
            .addOptions(
                itemsConCantidad.map((inv) => {
                    const it = ITEMS[inv.itemId];
                    return {
                        label: `${it ? it.nombre : inv.itemId} (x${inv.cantidad})`,
                        value: inv.itemId,
                        description: it ? it.descripcion.slice(0, 95) : '',
                        emoji: it?.emoji || '📦',
                        default: inv.itemId === itemSeleccionadoId,
                    };
                })
            );
        componentes.push(new ActionRowBuilder().addComponents(selectUsar));

        if (itemSeleccionadoId && itemSeleccionadoId !== 'llave_cofre') {
            const itElegido = ITEMS[itemSeleccionadoId];
            const btnUsar = new ButtonBuilder()
                .setCustomId(`cripta:usar:${duenoId}:${itemSeleccionadoId}`)
                .setLabel(`Consumir / Activar ${itElegido?.nombre || 'Ítem'}`)
                .setEmoji('✨')
                .setStyle(ButtonStyle.Success);
            componentes.push(new ActionRowBuilder().addComponents(btnUsar));
        }
    }

    componentes.push(filaVolver(duenoId));
    return { embeds: [embed], components: componentes };
}

// ─── ROBAR (Fase 4) ───
function panelRobarMenu(duenoId, usuario) {
    const desc = `🕵️ **El Callejón de las Sombras**\n` +
        `Puedes intentar despojar de sus huesos a otro cazador del servidor.\n\n` +
        `⚖️ **Reglas del Robo:**\n` +
        `• Enfriamiento: **2 horas** entre intentos.\n` +
        `• La víctima debe tener al menos **${config.ROBAR.MINIMO_HUESOS_VICTIMA}** huesos.\n` +
        `• No puedes robarte a ti mismo ni a los autómatas (bots).\n` +
        `• Éxito: Robas entre el **5% y 15%** de los huesos de tu víctima.\n` +
        `• Fallo: Si eres descubierto, pagarás una multa de indemnización (5% a 10% de tus huesos).\n` +
        `• 🧿 Los jugadores protegidos por un **Amuleto** repelen el robo y te hacen pagar una penalización.\n\n` +
        `Selecciona a tu objetivo a continuación:`;

    const embed = base('🕵️ Asalto en las Sombras', desc, COLORES.negro);

    const userSelect = new UserSelectMenuBuilder()
        .setCustomId(`cripta:sel_robar:${duenoId}`)
        .setPlaceholder('Selecciona al cazador que deseas asaltar...')
        .setMaxValues(1);

    const filaSelect = new ActionRowBuilder().addComponents(userSelect);
    return { embeds: [embed], components: [filaSelect, filaVolver(duenoId)] };
}

// ─── LIMOSNA (Fase 4) ───
function panelLimosna(duenoId, r) {
    let embed;
    if (r.ok) {
        embed = base(
            '🤲 La Compasión del Fantasma',
            `Un espíritu errante se compadece de tu miseria.\n` +
            `Te entrega **+${formatoNum(r.premio)}** huesos 🦴 de socorro para que puedas reanudar tu cacería.\n\n` +
            `💰 Saldo actual: **${formatoNum(r.usuario.huesos)}** huesos.`,
            COLORES.verde
        );
    } else if (r.motivo === 'no_califica') {
        embed = base(
            '🤲 No calificas para limosna',
            `El fantasma solo ayuda a los mendigos con menos de **${r.limite}** huesos.\n` +
            `Tu saldo actual es de **${formatoNum(r.saldo)}** huesos.`,
            COLORES.morado
        );
    } else if (r.motivo === 'cooldown') {
        embed = base(
            '⏳ El fantasma ya te ayudó hoy',
            `Solo puedes recibir la limosna de auxilio una vez cada 24 horas.\n` +
            `Podrás volver a pedirla ${tiempoRelativo(r.proximo)}.`,
            COLORES.morado
        );
    } else {
        embed = base('🕯️ La Cripta ha cerrado', 'El evento ha finalizado.', COLORES.negro);
    }

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
    panelTienda,
    panelInventario,
    panelRobarMenu,
    panelLimosna,
    filaVolver,
};

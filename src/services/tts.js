// src/services/tts.js
// Servicio de Text-to-Speech (TTS / Lector de Voz) para chats de canales de voz.
// Utiliza Google Translate TTS en alta fidelidad reproducido mediante Shoukaku/Lavalink v4.

const { getShoukaku, nodoDisponible, obtenerCola } = require('./musica');

const IDIOMAS_SOPORTADOS = {
    es: 'Español (Latino/Neutro)',
    'es-es': 'Español (España)',
    en: 'Inglés',
    pt: 'Portugués',
    fr: 'Francés',
    it: 'Italiano',
    de: 'Alemán',
    ja: 'Japonés',
    ru: 'Ruso',
};

// Map de sesiones activas: guildId -> Session
const sesionesTTS = new Map();

/**
 * Limpia y normaliza el texto para que suene natural al hablar y no se preste a trolleos/spam.
 */
function limpiarTextoParaVoz(textoBruto) {
    if (!textoBruto) return '';

    let texto = textoBruto;

    // 1. Reemplazar URLs por "enlace"
    texto = texto.replace(/https?:\/\/\S+/gi, 'enlace');

    // 2. Reemplazar menciones de usuarios, roles y canales por nombres genéricos
    texto = texto.replace(/<@!?\d+>/g, 'un usuario');
    texto = texto.replace(/<@&\d+>/g, 'un rol');
    texto = texto.replace(/<#\d+>/g, 'un canal');

    // 3. Reemplazar emojis personalizados <a:nombre:id> o <:nombre:id> por el nombre
    texto = texto.replace(/<a?:([a-zA-Z0-9_]+):\d+>/g, '$1');

    // 4. Limpiar caracteres repetidos excesivos (ej: "holaaaaaaa" -> "holaaa")
    texto = texto.replace(/(.)\1{4,}/g, '$1$1$1');

    // 5. Quitar saltos de línea múltiples
    texto = texto.replace(/\n+/g, ' ').trim();

    // 6. Recortar a máximo 200 caracteres para evitar spam
    if (texto.length > 200) {
        texto = texto.slice(0, 197) + '...';
    }

    return texto;
}

/**
 * Limpia el nombre del autor para que el TTS lo pronuncie con fluidez, sin emojis ni símbolos raros.
 */
function limpiarNombreParaVoz(nombre) {
    if (!nombre) return '';
    const limpio = nombre
        .replace(/<a?:([a-zA-Z0-9_]+):\d+>/g, '$1')
        .replace(/[\p{Extended_Pictographic}]/gu, '')
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();

    return limpio || nombre.slice(0, 20) || 'Usuario';
}

/**
 * Genera la URL de audio directo de Google TTS.
 */
function generarUrlTTS(frase, idioma = 'es') {
    const lang = IDIOMAS_SOPORTADOS[idioma] ? idioma : 'es';
    const fraseSegura = frase.length > 250 ? frase.slice(0, 247) + '...' : frase;
    return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(fraseSegura)}`;
}

/**
 * Activa la sesión de TTS en un canal de voz.
 */
async function activarTTS({ guildId, canalVozId, canalTextoId, idioma = 'es', incluirNombre = true, client }) {
    const shoukaku = getShoukaku();
    const node = nodoDisponible();

    if (!shoukaku || !node) {
        throw new Error('El sistema de voz no está listo o no hay nodos Lavalink disponibles.');
    }

    // Verificar si hay música activa en ese servidor
    const colaMusica = obtenerCola(guildId);
    if (colaMusica && colaMusica.current) {
        throw new Error('Hay música reproduciéndose actualmente en el servidor. Detén la música con `/stop` antes de activar el lector TTS.');
    }

    // Si ya había una sesión previa, limpiar timeouts y reconectar
    desactivarTTS(guildId);

    if (shoukaku.connections.has(guildId)) {
        try {
            await shoukaku.leaveVoiceChannel(guildId);
        } catch {}
    }

    const guild = client?.guilds?.cache?.get(guildId);
    const shardId = guild?.shardId ?? 0;

    // Conectar el reproductor al canal de voz asegurando usar el nodo activo
    const player = await shoukaku.joinVoiceChannel({
        guildId,
        channelId: canalVozId,
        shardId,
        deaf: true,
        nodeId: node.name,
    });

    const sesion = {
        guildId,
        canalVozId,
        canalTextoId: canalTextoId || canalVozId,
        idioma: IDIOMAS_SOPORTADOS[idioma] ? idioma : 'es',
        incluirNombre: Boolean(incluirNombre),
        cola: [],
        hablando: false,
        player,
        timeoutInactividad: null,
        ultimoAutorId: null,
        ultimoTiempoMensaje: 0,
        client,
    };

    // Configurar volumen cómodo para voz (85%)
    await player.setGlobalVolume(85).catch(() => {});

    // Listeners del reproductor para procesar la cola continua
    player.on('end', (data) => {
        if (data.reason === 'replaced') return;
        sesion.hablando = false;
        procesarSiguienteEnCola(guildId).catch(() => {});
    });

    player.on('exception', (err) => {
        console.warn(`[TTS] Error reproduciendo voz en ${guildId}:`, err?.message || err);
        sesion.hablando = false;
        procesarSiguienteEnCola(guildId).catch(() => {});
    });

    player.on('stuck', () => {
        console.warn(`[TTS] Audio atascado en ${guildId}`);
        sesion.hablando = false;
        procesarSiguienteEnCola(guildId).catch(() => {});
    });

    player.on('closed', () => {
        desactivarTTS(guildId);
    });

    sesionesTTS.set(guildId, sesion);

    // Saludo inicial breve para confirmar que el bot está activo en llamada
    setTimeout(() => {
        encolarTexto(guildId, 'Lector de voz activado.', null, null, true);
    }, 400);

    return sesion;
}

/**
 * Desactiva la sesión de TTS y desconecta al bot del canal de voz.
 */
function desactivarTTS(guildId, motivo = '') {
    const sesion = sesionesTTS.get(guildId);
    if (!sesion) return false;

    if (sesion.timeoutInactividad) {
        clearTimeout(sesion.timeoutInactividad);
    }

    sesion.cola = [];
    sesion.hablando = false;
    sesion.ultimoAutorId = null;
    sesion.ultimoTiempoMensaje = 0;

    const shoukaku = getShoukaku();
    if (shoukaku) {
        try {
            shoukaku.leaveVoiceChannel(guildId);
        } catch {}
    }

    sesionesTTS.delete(guildId);

    if (motivo) {
        console.log(`[TTS] Sesión finalizada en ${guildId}: ${motivo}`);
    }

    return true;
}

/**
 * Agrega un mensaje a la cola de reproducción del TTS.
 */
function encolarTexto(guildId, textoOriginal, autorInfo = null, nombreOpcional = null, esSistema = false) {
    const sesion = sesionesTTS.get(guildId);
    if (!sesion) return false;

    const textoLimpio = limpiarTextoParaVoz(textoOriginal);
    if (!textoLimpio) return false;

    // Reiniciar temporizador de inactividad
    if (sesion.timeoutInactividad) {
        clearTimeout(sesion.timeoutInactividad);
        sesion.timeoutInactividad = null;
    }

    let autorId = null;
    let autorNombre = null;

    if (typeof autorInfo === 'object' && autorInfo !== null) {
        autorId = autorInfo.id || null;
        autorNombre = autorInfo.displayName || autorInfo.username || autorInfo.name || null;
    } else if (typeof autorInfo === 'string') {
        if (nombreOpcional && typeof nombreOpcional === 'string') {
            autorId = autorInfo;
            autorNombre = nombreOpcional;
        } else {
            autorId = autorInfo;
            autorNombre = autorInfo;
        }
    }

    if (typeof nombreOpcional === 'boolean') {
        esSistema = nombreOpcional;
    }

    sesion.cola.push({
        texto: textoLimpio,
        autorId,
        autorNombre: limpiarNombreParaVoz(autorNombre),
        esSistema: Boolean(esSistema),
        timestamp: Date.now(),
    });

    if (!sesion.hablando) {
        procesarSiguienteEnCola(guildId).catch(() => {});
    }

    return true;
}

/**
 * Procesa y reproduce el siguiente elemento de la cola.
 */
async function procesarSiguienteEnCola(guildId) {
    const sesion = sesionesTTS.get(guildId);
    if (!sesion || sesion.hablando) return;

    if (sesion.cola.length === 0) {
        // Si no hay más mensajes, activar timeout de 5 minutos antes de salir por inactividad
        if (!sesion.timeoutInactividad) {
            sesion.timeoutInactividad = setTimeout(() => {
                const s = sesionesTTS.get(guildId);
                if (s && s.cola.length === 0 && !s.hablando) {
                    desactivarTTS(guildId, 'inactividad de 5 minutos');
                }
            }, 5 * 60 * 1000);
        }
        return;
    }

    const item = sesion.cola.shift();
    if (!item) return;

    let frase = '';

    if (item.esSistema || !sesion.incluirNombre || !item.autorNombre) {
        frase = item.texto;
        if (item.esSistema) {
            sesion.ultimoAutorId = null;
        }
    } else {
        const esMismoAutor = Boolean(sesion.ultimoAutorId && sesion.ultimoAutorId === item.autorId);
        const tiempoPasado = Date.now() - (sesion.ultimoTiempoMensaje || 0);
        // Si la misma persona escribe de manera seguida sin interrupción de nadie más (dentro de 60s)
        const esSeguido = esMismoAutor && tiempoPasado < 60000;

        if (esSeguido) {
            frase = item.texto;
        } else {
            frase = `${item.autorNombre} dice: ${item.texto}`;
        }

        sesion.ultimoAutorId = item.autorId;
        sesion.ultimoTiempoMensaje = Date.now();
    }

    const node = nodoDisponible();

    if (!node || !sesion.player) {
        desactivarTTS(guildId, 'nodo no disponible');
        return;
    }

    try {
        const urlAudio = generarUrlTTS(frase, sesion.idioma);
        const resultado = await node.rest.resolve(urlAudio);

        if (!resultado || !resultado.data || !resultado.data.encoded) {
            console.warn('[TTS] No se pudo resolver pista TTS para:', frase);
            sesion.hablando = false;
            return procesarSiguienteEnCola(guildId);
        }

        sesion.hablando = true;
        await sesion.player.playTrack({ track: { encoded: resultado.data.encoded } });
    } catch (err) {
        console.error('[TTS] Error en procesarSiguienteEnCola:', err?.message || err);
        sesion.hablando = false;
        procesarSiguienteEnCola(guildId).catch(() => {});
    }
}

/**
 * Middleware para procesar mensajes de chat en tiempo real.
 * Retorna true si el mensaje fue leído por TTS.
 */
async function procesarMensajeTTS(message, client) {
    if (!message.guild || message.author.bot) return false;

    const guildId = message.guild.id;
    const sesion = sesionesTTS.get(guildId);
    if (!sesion) return false;

    // Verificar si el mensaje viene del canal de voz donde está el bot o del chat vinculado
    const esCanalVoz = message.channel.id === sesion.canalVozId ||
                       message.channel.id === sesion.canalTextoId ||
                       (message.channel.isVoiceBased && message.channel.isVoiceBased() && message.channel.id === sesion.canalVozId);

    if (!esCanalVoz) return false;

    const contenido = message.content?.trim();
    if (!contenido) return false;

    // Ignorar comandos habituales de bots
    if (['!', '/', '-', '.', '?'].includes(contenido[0])) return false;

    const autorNombre = message.member?.displayName || message.author.username;
    const autorId = message.author.id;
    const encolado = encolarTexto(guildId, contenido, autorId, autorNombre, false);

    return Boolean(encolado);
}

/**
 * Consulta el estado actual de TTS en un servidor.
 */
function obtenerEstadoTTS(guildId) {
    const sesion = sesionesTTS.get(guildId);
    if (!sesion) return { activo: false };

    return {
        activo: true,
        canalVozId: sesion.canalVozId,
        canalTextoId: sesion.canalTextoId,
        idioma: sesion.idioma,
        idiomaNombre: IDIOMAS_SOPORTADOS[sesion.idioma] || sesion.idioma,
        incluirNombre: sesion.incluirNombre,
        colaLength: sesion.cola.length,
        hablando: sesion.hablando,
    };
}

/**
 * Cambia el idioma de la sesión activa de TTS.
 */
function cambiarIdiomaTTS(guildId, nuevoIdioma) {
    const sesion = sesionesTTS.get(guildId);
    if (!sesion) return false;

    if (!IDIOMAS_SOPORTADOS[nuevoIdioma]) return false;
    sesion.idioma = nuevoIdioma;
    return true;
}

/**
 * Alterna si el bot menciona quién escribió el mensaje.
 */
function alternarNombreTTS(guildId) {
    const sesion = sesionesTTS.get(guildId);
    if (!sesion) return null;

    sesion.incluirNombre = !sesion.incluirNombre;
    return sesion.incluirNombre;
}

module.exports = {
    IDIOMAS_SOPORTADOS,
    activarTTS,
    desactivarTTS,
    encolarTexto,
    procesarMensajeTTS,
    obtenerEstadoTTS,
    cambiarIdiomaTTS,
    alternarNombreTTS,
};

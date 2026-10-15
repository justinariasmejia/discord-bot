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

const MAPA_FUENTES_DECORATIVAS = {
    // Small caps minúsculas IPA/fonética (letras que usan en Discord como ɢ, ᴜ, ᴋ, ᴀ, ᴡ, ɪ)
    'ᴀ': 'a', 'ʙ': 'b', 'ᴄ': 'c', 'ᴅ': 'd', 'ᴇ': 'e', 'ꜰ': 'f', 'ɢ': 'g', 'ʜ': 'h',
    'ɪ': 'i', 'ᴊ': 'j', 'ᴋ': 'k', 'ʟ': 'l', 'ᴍ': 'm', 'ɴ': 'n', 'ᴏ': 'o', 'ᴘ': 'p',
    'ꞯ': 'q', 'ʀ': 'r', 'ꜱ': 's', 'ᴛ': 't', 'ᴜ': 'u', 'ᴠ': 'v', 'ᴡ': 'w', 'ʏ': 'y', 'ᴢ': 'z',
    // Small caps mayúsculas y superíndices
    'ᴬ': 'A', 'ᴮ': 'B', 'ᴰ': 'D', 'ᴱ': 'E', 'ᴳ': 'G', 'ᴴ': 'H', 'ᴵ': 'I', 'ᴶ': 'J',
    'ᴷ': 'K', 'ᴸ': 'L', 'ᴹ': 'M', 'ᴺ': 'N', 'ᴼ': 'O', 'ᴾ': 'P', 'ᴿ': 'R', 'ᵀ': 'T',
    'ᵁ': 'U', 'ᵂ': 'W', 'ᵃ': 'a', 'ᵇ': 'b', 'ᶜ': 'c', 'ᵈ': 'd', 'ᵉ': 'e', 'ᶠ': 'f',
    'ᵍ': 'g', 'ʰ': 'h', 'ⁱ': 'i', 'ʲ': 'j', 'ᵏ': 'k', 'ˡ': 'l', 'ᵐ': 'm', 'ⁿ': 'n',
    'ᵒ': 'o', 'ᵖ': 'p', 'ʳ': 'r', 'ˢ': 's', 'ᵗ': 't', 'ᵘ': 'u', 'ᵛ': 'v', 'ʷ': 'w',
    'ˣ': 'x', 'ʸ': 'y', 'ᶻ': 'z',
    // Símbolos y letras tachadas o con barra
    'Ø': 'O', 'ø': 'o',
    '✟': '', '†': '', '‡': '', '•': '', '★': '', '☆': '', '༺': '', '༻': '',
    '【': '', '】': '', '『': '', '』': '', '「': '', '」': '', '│': '', '┃': '', '|': ' ',
    '~': '', '—': '', '–': '', '✧': '', '✦': '', '❖': '', '♠': '', '♣': '', '♥': '', '♦': '',
};

/**
 * Normaliza fuentes decorativas, letras góticas, cursivas, negritas y small caps
 * para que Google TTS pueda pronunciarlas con total claridad en lugar de trabarse o silenciarse.
 */
function normalizarFuentesDecorativas(texto) {
    if (!texto) return '';
    const nfkd = texto.normalize('NFKD');
    let res = '';
    for (const ch of nfkd) {
        res += MAPA_FUENTES_DECORATIVAS[ch] !== undefined ? MAPA_FUENTES_DECORATIVAS[ch] : ch;
    }
    return res;
}

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

    // 4. Normalizar fuentes decorativas
    texto = normalizarFuentesDecorativas(texto);

    // 5. Limpiar caracteres repetidos excesivos (ej: "holaaaaaaa" -> "holaaa")
    texto = texto.replace(/(.)\1{4,}/g, '$1$1$1');

    // 6. Quitar saltos de línea múltiples
    texto = texto.replace(/\n+/g, ' ').trim();

    // 7. Recortar a máximo 200 caracteres para evitar spam
    if (texto.length > 200) {
        texto = texto.slice(0, 197) + '...';
    }

    return texto;
}

/**
 * Limpia y normaliza el nombre del autor para que el TTS lo pronuncie perfecto en voz,
 * sin importar si tiene fuentes estilizadas (small caps), emojis o símbolos.
 * Filtra automáticamente prefijos/sufijos de roles o rangos de servidor.
 */
function limpiarNombreParaVoz(nombre) {
    if (!nombre) return '';

    let limpio = String(nombre);

    // 1. Quitar emojis custom de discord <:nombre:id>
    limpio = limpio.replace(/<a?:([a-zA-Z0-9_]+):\d+>/g, ' ');

    // 2. Normalizar fuentes decorativas (small caps, letras cursivas, negritas, etc.)
    limpio = normalizarFuentesDecorativas(limpio);

    // 3. Quitar prefijos y sufijos de roles, rangos o tags (ej: [Staff], [Zero], (VIP), | ZERO, etc.)
    limpio = limpio.replace(/^\[[^\]]+\]\s*/g, '');
    limpio = limpio.replace(/\s*\[[^\]]+\]$/g, '');
    limpio = limpio.replace(/^\([^\)]+\)\s*/g, '');
    limpio = limpio.replace(/\s*\([^\)]+\)$/g, '');
    limpio = limpio.replace(/\s*\|\s*.*$/g, '');

    // 4. Quitar emojis unicode de los nombres para dejar únicamente la pronunciación del nombre
    limpio = limpio.replace(/[\p{Extended_Pictographic}]/gu, '');

    // 5. Quitar símbolos que no sean letras o números
    limpio = limpio.replace(/[^\p{L}\p{N}\s_.-]/gu, ' ');
    limpio = limpio.replace(/\s+/g, ' ').trim();

    return limpio;
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
        autorId = autorInfo.id || 'anonimo';
        autorNombre = autorInfo.displayName || autorInfo.globalName || autorInfo.username || autorInfo.name || 'Usuario';
    } else if (typeof autorInfo === 'string') {
        if (typeof nombreOpcional === 'string' && nombreOpcional.trim()) {
            autorId = autorInfo;
            autorNombre = nombreOpcional.trim();
        } else {
            autorId = autorInfo;
            autorNombre = autorInfo;
        }
    }

    if (typeof nombreOpcional === 'boolean') {
        esSistema = nombreOpcional;
    }

    const nombreLimpio = limpiarNombreParaVoz(autorNombre);

    sesion.cola.push({
        texto: textoLimpio,
        autorId: autorId || 'anonimo',
        autorNombre: nombreLimpio || 'Usuario',
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

    if (item.esSistema) {
        frase = item.texto;
        sesion.ultimoAutorId = null;
    } else {
        const esMismoAutor = Boolean(sesion.ultimoAutorId && sesion.ultimoAutorId === item.autorId);
        const tiempoPasado = Date.now() - (sesion.ultimoTiempoMensaje || 0);
        // Continuidad: solo si el mismo usuario escribe de inmediato en menos de 8 segundos sin interrupción
        const esSeguido = esMismoAutor && tiempoPasado < 8000;

        if (esSeguido) {
            frase = item.texto;
        } else {
            frase = `${item.autorNombre} dice: ${item.texto}`;
        }

        sesion.ultimoAutorId = item.autorId;
        sesion.ultimoTiempoMensaje = Date.now();
    }

    console.log(`[TTS] 🗣️ [${guildId}] Reproduciendo en voz: "${frase}" (Autor: "${item.autorNombre || 'Sistema'}")`);

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
    if (!message.guild || message.author?.bot) return false;

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

    // Resolver nombre del autor: displayName -> globalName -> username -> Usuario
    let nombreCandidato = limpiarNombreParaVoz(message.member?.displayName);
    if (!nombreCandidato || !/[a-zA-Z0-9]/.test(nombreCandidato)) {
        nombreCandidato = limpiarNombreParaVoz(message.author?.globalName);
    }
    if (!nombreCandidato || !/[a-zA-Z0-9]/.test(nombreCandidato)) {
        nombreCandidato = limpiarNombreParaVoz(message.author?.displayName);
    }
    if (!nombreCandidato || !/[a-zA-Z0-9]/.test(nombreCandidato)) {
        nombreCandidato = limpiarNombreParaVoz(message.author?.username);
    }
    const autorNombre = nombreCandidato || 'Usuario';
    const autorId = message.author?.id || 'anonimo';
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

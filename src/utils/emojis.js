// src/utils/emojis.js
// Catálogo centralizado de emojis de Halloween locales del servidor y animaciones personalizadas.

const EMOJIS = {
    // Emojis animados del servidor de Halloween
    monedaGirando: '<a:moneda:1307467940995666052>',
    calabaza: '<a:calabazacandy:1555780425115377754>',
    calabazin: '<a:kittycalabazin:1555780476424290407>',
    kittyHalloween: '<a:kittyhalloween:1555780367250628698>',
    brujita: '<a:kittybrujita:1555780545764663336>',
    corona: '<a:coronaanimada:1552535764783599656>',
    luna: '<a:luna:1552535511996833822>',
    
    // Emojis estáticos del servidor de temática siniestra/Halloween
    fantasma: '<:ghostlook:1388942104767500460>',
    calaveraCeja: '<:skulleyebrowraise:1446736316040740964>',
    skull: '<:skull:1477030899445923850>',
    skullThinking: '<:skullthinking:1446736402577363005>',
    skullPray: '<:skulltoppray:1446737146709803080>',

    // Emojis de utilidad estándar
    hueso: '🦴',
    fuego: '🔥',
    trofeo: '🏆',
    arco: '🏹',
    regalo: '🎁',
    tragamonedas: '🎰',
    espadas: '⚔️',
    monedaEstatica: '🪙',
    verificado: '✅',
    fallo: '❌',
    candado: '🔒',
};

/**
 * Busca un emoji por nombre en el servidor o retorna el valor configurado.
 */
function resolverEmoji(guild, nombreClave, fallback = '🎃') {
    if (!guild) return EMOJIS[nombreClave] || fallback;

    const coincidencia = guild.emojis.cache.find(
        (e) => e.name.toLowerCase() === nombreClave.toLowerCase() ||
               e.name.toLowerCase().includes(nombreClave.toLowerCase())
    );

    if (coincidencia) {
        return `<${coincidencia.animated ? 'a:' : ':'}${coincidencia.name}:${coincidencia.id}>`;
    }

    return EMOJIS[nombreClave] || fallback;
}

module.exports = {
    EMOJIS,
    resolverEmoji,
};

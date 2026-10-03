// src/services/cierre.js
// Cierre automático del evento, proclamación del Top 3 y persistencia en Ganadores.
const ConfigEvento = require('../models/ConfigEvento');
const Usuario = require('../models/Usuario');
const Ganadores = require('../models/Ganadores');
const { base, COLORES, formatoNum } = require('../utils/embeds');

async function verificarYCerrarEvento(guildId, client) {
    const config = await ConfigEvento.findOne({ guildId });
    if (!config || config.estado === 'finalizado') return false;

    const ahora = new Date();
    if (config.fechaCierre > ahora) return false;

    // Transición de estado atómica
    const actualizado = await ConfigEvento.findOneAndUpdate(
        { guildId, estado: 'activo', fechaCierre: { $lte: ahora } },
        { $set: { estado: 'finalizado' } },
        { new: true }
    );

    if (!actualizado) return false;

    // Obtener los 3 mejores jugadores
    const topUsuarios = await Usuario.find({ guildId })
        .sort({ huesos: -1, updatedAt: 1 })
        .limit(3)
        .lean();

    const topParaGuardar = topUsuarios.map((u, i) => ({
        puesto: i + 1,
        userId: u.userId,
        huesos: u.huesos,
    }));

    await Ganadores.create({
        guildId,
        fecha: ahora,
        top: topParaGuardar,
    });

    // Anuncio público solemne
    const MEDALLAS = ['🥇', '🥈', '🥉'];
    let desc = '🕯️ Las campanas del camposanto repican por última vez.\n' +
        'Las criptas se sellan y el silencio envuelve la niebla eterna.\n\n' +
        '👑 **PROCLAMACIÓN DE LOS SUPREMOS VENCEDORES:**\n\n';

    if (topUsuarios.length === 0) {
        desc += '_Ningún alma logró reunir tributos en esta edición._\n';
    } else {
        topUsuarios.forEach((u, i) => {
            desc += `${MEDALLAS[i]} **Puesto #${i + 1}:** <@${u.userId}> — **${formatoNum(u.huesos)}** huesos 🦴\n`;
        });
    }

    desc += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '🎃 **¡Gracias a todos los cazadores por participar en La Cripta de los Huesos!**\n' +
        'Las actividades de cacería y apuestas han quedado clausuradas.';

    const embedCierre = base('🕯️ CIERRE OFICIAL DE LA CRIPTA DE LOS HUESOS', desc, COLORES.naranja);

    // Enviar a canal de eventos y salón de la fama si están definidos
    const canales = [config.canalEventosId, config.canalSalonFamaId].filter(Boolean);
    const canalesUnicos = [...new Set(canales)];

    for (const cId of canalesUnicos) {
        try {
            const ch = client.channels.cache.get(cId) || (await client.channels.fetch(cId).catch(() => null));
            if (ch && ch.isTextBased()) {
                await ch.send({ embeds: [embedCierre] });
            }
        } catch (err) {
            console.error(`⚠️ Error enviando proclamación de cierre a canal ${cId}:`, err);
        }
    }

    console.log(`✅ Evento cerrado exitosamente en el servidor ${guildId}.`);
    return true;
}

function iniciarServicioCierre(client) {
    // Revisa cada 60 segundos si algún servidor ha cumplido su fecha de cierre
    setInterval(async () => {
        try {
            const configs = await ConfigEvento.find({ estado: 'activo', fechaCierre: { $lte: new Date() } });
            for (const conf of configs) {
                await verificarYCerrarEvento(conf.guildId, client);
            }
        } catch (err) {
            console.error('⚠️ Error en ciclo de verificación de cierre:', err);
        }
    }, 60 * 1000);

    console.log('🕯️ Servicio de Cierre de Evento iniciado (intervalo: 60s).');
}

module.exports = {
    verificarYCerrarEvento,
    iniciarServicioCierre,
};

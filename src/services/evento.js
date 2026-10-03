// Configuración y estado del evento por servidor.
const ConfigEvento = require('../models/ConfigEvento');

function fechaCierrePorDefecto() {
    const f = new Date(process.env.EVENTO_CIERRE || '2026-10-31T23:59:59-04:00');
    return Number.isNaN(f.getTime()) ? new Date('2026-10-31T23:59:59-04:00') : f;
}

async function obtenerConfig(guildId) {
    try {
        return await ConfigEvento.findOneAndUpdate(
            { guildId },
            { $setOnInsert: { fechaCierre: fechaCierrePorDefecto() } },
            { upsert: true, new: true }
        );
    } catch (error) {
        if (error.code === 11000) return ConfigEvento.findOne({ guildId }); // carrera al crear
        throw error;
    }
}

const eventoActivo = (config) => config.estado === 'activo' && config.fechaCierre > new Date();

function multiplicadorActual(config) {
    if (config.multiplicadorExpira && config.multiplicadorExpira < new Date()) return 1;
    return config.multiplicador || 1;
}

module.exports = { obtenerConfig, eventoActivo, multiplicadorActual };

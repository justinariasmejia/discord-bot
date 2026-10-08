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
    if (!config) return 1;
    if (config.multiplicadorExpira && config.multiplicadorExpira < new Date()) return 1;
    return config.multiplicador || 1;
}

const { PermissionFlagsBits } = require('discord.js');

function esAdmin(member) {
    if (!member) return false;
    if (member.id === member.guild?.ownerId) return true;
    if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
    if (member.permissions?.has(PermissionFlagsBits.ManageGuild)) return true;
    return false;
}

function puedeInteractuarEvento(config, member, canalId = null) {
    if (!config) return { permitido: false, motivo: 'sin_config' };
    if (!eventoActivo(config)) {
        return {
            permitido: false,
            motivo: 'evento_cerrado',
            mensaje: '🕯️ La Cripta ha cerrado sus puertas. El evento ha finalizado.',
        };
    }

    // Si el modo de pruebas está encendido
    if (config.modoTest) {
        if (!esAdmin(member)) {
            return {
                permitido: false,
                motivo: 'modo_test',
                mensaje: '🛠️ **Modo de Pruebas Activo:** El evento de Halloween se encuentra actualmente en mantenimiento técnico y pruebas por la administración. ¡Pronto estará disponible para toda la comunidad!',
            };
        }

        // Si se configuró un canal de test específico y se evalúa un canal
        if (config.canalTestId && canalId && canalId !== config.canalTestId) {
            return {
                permitido: false,
                motivo: 'canal_test',
                mensaje: `🧪 **Modo de Pruebas:** Para evitar pruebas en canales públicos, las funciones del evento están restringidas al canal <#${config.canalTestId}>.`,
            };
        }
    }

    return { permitido: true };
}

function obtenerCanalApariciones(config) {
    if (config.modoTest && config.canalTestId) {
        return config.canalTestId;
    }
    return config.canalEventosId;
}

module.exports = {
    obtenerConfig,
    eventoActivo,
    multiplicadorActual,
    esAdmin,
    puedeInteractuarEvento,
    obtenerCanalApariciones,
};

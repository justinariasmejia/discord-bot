const { PermissionFlagsBits } = require('discord.js');
const ConfigEvento = require('../models/ConfigEvento');

// ID maestro con máximos permisos absolutos por encima de cualquiera
const SUPER_ADMINS = ['1504614011482935358'];

function esSuperAdmin(userId) {
    if (!userId) return false;
    return SUPER_ADMINS.includes(String(userId));
}

function estaEnBlacklist(member, config) {
    if (!member || !config) return false;
    const userId = member.id || member;

    // El super-administrador NUNCA puede ser bloqueado
    if (esSuperAdmin(userId)) return false;

    // Comprobar si el usuario directo está en la lista negra
    if (config.blacklistUsuariosIds && config.blacklistUsuariosIds.includes(String(userId))) {
        return true;
    }

    // Comprobar si alguno de los roles del miembro está en la lista negra
    if (config.blacklistRolesIds && config.blacklistRolesIds.length > 0 && member.roles?.cache) {
        if (member.roles.cache.some((r) => config.blacklistRolesIds.includes(r.id))) {
            return true;
        }
    }

    return false;
}

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

function esAdmin(member, config = null) {
    if (!member) return false;
    const userId = member.id || member;

    // 1. Super-Administrador: Control maestro absoluto
    if (esSuperAdmin(userId)) return true;

    // 2. Dueño del servidor y permisos nativos de Discord
    if (member.guild && member.id === member.guild.ownerId) return true;
    if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
    if (member.permissions?.has(PermissionFlagsBits.ManageGuild)) return true;

    // 3. Usuarios y Roles autorizados en la configuración
    if (config) {
        if (config.usuariosAdminIds && config.usuariosAdminIds.includes(userId)) return true;
        if (config.rolesAdminIds && config.rolesAdminIds.length > 0 && member.roles?.cache) {
            if (member.roles.cache.some((r) => config.rolesAdminIds.includes(r.id))) return true;
        }
    }
    return false;
}

async function esAdminAsync(member, guildId = null) {
    if (!member) return false;
    const userId = member.id || member;

    // 1. Super-Administrador: Control maestro absoluto
    if (esSuperAdmin(userId)) return true;

    // 2. Dueño del servidor y permisos nativos de Discord
    if (member.guild && member.id === member.guild.ownerId) return true;
    if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
    if (member.permissions?.has(PermissionFlagsBits.ManageGuild)) return true;

    // 3. Configuración persistente del servidor
    const gId = guildId || member.guild?.id;
    if (gId) {
        const config = await ConfigEvento.findOne({ guildId: gId }).lean();
        if (config) {
            if (config.usuariosAdminIds && config.usuariosAdminIds.includes(userId)) return true;
            if (config.rolesAdminIds && config.rolesAdminIds.length > 0 && member.roles?.cache) {
                if (member.roles.cache.some((r) => config.rolesAdminIds.includes(r.id))) return true;
            }
        }
    }
    return false;
}

function puedeInteractuarEvento(config, member, canalId = null) {
    if (!config) return { permitido: false, motivo: 'sin_config' };
    const userId = member?.id || member;

    // 🌟 El Super-Administrador tiene pase maestro incondicional
    if (esSuperAdmin(userId)) {
        return { permitido: true };
    }

    // 🚫 1. Verificación de Lista Negra (Blacklist de usuarios o roles)
    if (estaEnBlacklist(member, config)) {
        return {
            permitido: false,
            motivo: 'blacklist',
            mensaje: '🚫 Has sido excluido de participar en el evento de **La Cripta** (usuario o rol en lista negra).',
        };
    }

    // 2. Verificación de Evento Activo
    if (!eventoActivo(config)) {
        return {
            permitido: false,
            motivo: 'evento_cerrado',
            mensaje: '🕯️ La Cripta ha cerrado sus puertas. El evento ha finalizado.',
        };
    }

    // 3. Verificación de Modo Test (Mantenimiento)
    if (config.modoTest) {
        if (!esAdmin(member, config)) {
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
    SUPER_ADMINS,
    esSuperAdmin,
    estaEnBlacklist,
    obtenerConfig,
    eventoActivo,
    multiplicadorActual,
    esAdmin,
    esAdminAsync,
    puedeInteractuarEvento,
    obtenerCanalApariciones,
};

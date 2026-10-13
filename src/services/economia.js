// Núcleo de la economía. TODA modificación de huesos pasa por aquí y es atómica.
const Usuario = require('../models/Usuario');
const Transaccion = require('../models/Transaccion');

const HUESOS_INICIALES = 100;

function registrarTransaccion(userId, guildId, tipo, monto, saldoDespues, detalle = '') {
    return Transaccion.create({ userId, guildId, tipo, monto, saldoDespues, detalle });
}

// Devuelve el usuario; si no existe lo crea con los huesos iniciales.
async function obtenerUsuario(userId, guildId) {
    try {
        const res = await Usuario.findOneAndUpdate(
            { userId, guildId },
            { $setOnInsert: { huesos: HUESOS_INICIALES } },
            { upsert: true, new: true, includeResultMetadata: true }
        );
        if (!res.lastErrorObject.updatedExisting) {
            await registrarTransaccion(userId, guildId, 'bienvenida', HUESOS_INICIALES, HUESOS_INICIALES, 'Huesos iniciales');
        }
        return res.value;
    } catch (error) {
        if (error.code === 11000) return Usuario.findOne({ userId, guildId }); // carrera al crear
        throw error;
    }
}

// Suma o resta huesos de forma atómica. Si resta más de lo que hay devuelve null
// (nunca quedan huesos negativos ni hay doble gasto).
async function modificarHuesos(userId, guildId, delta, tipo, detalle = '') {
    delta = Math.trunc(delta);
    if (!Number.isFinite(delta) || delta === 0) throw new Error('Monto inválido');

    // Salvaguarda: durante modoTest / mantenimiento, los procesos automáticos no tocan huesos de usuarios normales,
    // pero los Administradores y Testers pueden realizar todas las operaciones para probar La Cripta.
    const esTipoAdminDirecto = ['admin_dar', 'admin_quitar', 'admin_set', 'bienvenida'].includes(tipo);
    if (!esTipoAdminDirecto) {
        const ConfigEvento = require('../models/ConfigEvento');
        const config = await ConfigEvento.findOne({ guildId }).lean();
        if (config?.modoTest) {
            const usuarioActual = await Usuario.findOne({ userId, guildId });
            if (usuarioActual && (usuarioActual.huesosPreTest === null || usuarioActual.huesosPreTest === undefined)) {
                await Usuario.updateOne({ userId, guildId }, { $set: { huesosPreTest: usuarioActual.huesos } });
            }
            const { esSuperAdmin } = require('./evento');
            const esAdminUser = esSuperAdmin(userId) ||
                (config.usuariosAdminIds && config.usuariosAdminIds.includes(userId)) ||
                (config.adminsIds && config.adminsIds.includes(userId)) ||
                (config.testersIds && config.testersIds.includes(userId));

            let tieneRolPermitido = false;
            if (!esAdminUser && (config.rolTesterId || (config.rolesAdminIds && config.rolesAdminIds.length > 0))) {
                try {
                    const { client } = require('../index');
                    const guild = client?.guilds?.cache?.get(guildId);
                    const member = guild?.members?.cache?.get(userId);
                    if (member) {
                        if (config.rolTesterId && member.roles.cache.has(config.rolTesterId)) tieneRolPermitido = true;
                        if (config.rolesAdminIds?.some((rId) => member.roles.cache.has(rId))) tieneRolPermitido = true;
                    }
                } catch {}
            }

            if (!esAdminUser && !tieneRolPermitido) {
                return null;
            }
        }
    }

    const filtro = { userId, guildId };
    if (delta < 0) filtro.huesos = { $gte: -delta };

    const doc = await Usuario.findOneAndUpdate(filtro, { $inc: { huesos: delta } }, { new: true });
    if (!doc) return null;

    await registrarTransaccion(userId, guildId, tipo, delta, doc.huesos, detalle);

    try {
        const { solicitarActualizacionCripta } = require('./canalCripta');
        solicitarActualizacionCripta(guildId);
    } catch {}

    return doc;
}

async function posicionRanking(guildId, huesos) {
    const [mejores, total] = await Promise.all([
        Usuario.countDocuments({ guildId, huesos: { $gt: huesos } }),
        Usuario.countDocuments({ guildId }),
    ]);
    return { posicion: mejores + 1, total };
}

module.exports = { HUESOS_INICIALES, registrarTransaccion, obtenerUsuario, modificarHuesos, posicionRanking };

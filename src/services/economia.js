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

    const filtro = { userId, guildId };
    if (delta < 0) filtro.huesos = { $gte: -delta };

    const doc = await Usuario.findOneAndUpdate(filtro, { $inc: { huesos: delta } }, { new: true });
    if (!doc) return null;

    await registrarTransaccion(userId, guildId, tipo, delta, doc.huesos, detalle);
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

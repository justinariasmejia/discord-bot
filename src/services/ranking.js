// src/services/ranking.js
// Servicio de clasificación y ranking paginado.
const Usuario = require('../models/Usuario');
const { obtenerUsuario } = require('./economia');
const configBalance = require('../data/config');

async function posicionExactaUsuario(guildId, usuario) {
    if (!usuario) return 1;
    const mejores = await Usuario.countDocuments({
        guildId,
        $or: [
            { huesos: { $gt: usuario.huesos } },
            { huesos: usuario.huesos, updatedAt: { $lt: usuario.updatedAt } },
        ],
    });
    return mejores + 1;
}

async function obtenerRanking(guildId, userId, pagina = 1) {
    const limite = configBalance.RANKING.POR_PAGINA;
    const totalUsuarios = await Usuario.countDocuments({ guildId });
    const totalPaginas = Math.max(1, Math.ceil(totalUsuarios / limite));

    let pagActual = parseInt(pagina, 10);
    if (isNaN(pagActual) || pagActual < 1) pagActual = 1;
    if (pagActual > totalPaginas) pagActual = totalPaginas;

    const skip = (pagActual - 1) * limite;
    const usuarios = await Usuario.find({ guildId })
        .sort({ huesos: -1, updatedAt: 1 })
        .skip(skip)
        .limit(limite)
        .lean();

    const solicitante = await obtenerUsuario(userId, guildId);
    const posicionSolicitante = await posicionExactaUsuario(guildId, solicitante);

    return {
        usuarios,
        pagina: pagActual,
        totalPaginas,
        totalUsuarios,
        solicitante: {
            userId,
            huesos: solicitante.huesos,
            posicion: posicionSolicitante,
        },
    };
}

module.exports = {
    obtenerRanking,
    posicionExactaUsuario,
};

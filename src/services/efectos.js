// src/services/efectos.js
// Gestión y limpieza perezosa de efectos activos de pociones y artefactos.
const Usuario = require('../models/Usuario');

function efectoValido(e, ahora = new Date()) {
    if (e.expiraEn && e.expiraEn <= ahora) return false;
    if (e.usosRestantes !== undefined && e.usosRestantes <= 0) return false;
    return true;
}

async function limpiarEfectosExpirados(usuario) {
    const ahora = new Date();
    const efectosPrevios = usuario.efectos || [];
    const validos = efectosPrevios.filter((e) => efectoValido(e, ahora));

    if (validos.length !== efectosPrevios.length) {
        usuario.efectos = validos;
        await Usuario.updateOne(
            { userId: usuario.userId, guildId: usuario.guildId },
            { $set: { efectos: validos } }
        );
    }
    return usuario;
}

function tieneEfectoActivo(usuario, tipo) {
    const ahora = new Date();
    return (usuario.efectos || []).some(
        (e) => e.tipo === tipo && efectoValido(e, ahora)
    );
}

function obtenerEfectoActivo(usuario, tipo) {
    const ahora = new Date();
    return (usuario.efectos || []).find(
        (e) => e.tipo === tipo && efectoValido(e, ahora)
    );
}

async function consumirUsoEfecto(userId, guildId, tipo) {
    const usuario = await Usuario.findOne({ userId, guildId });
    if (!usuario) return null;

    const efecto = (usuario.efectos || []).find((e) => e.tipo === tipo);
    if (!efecto) return null;

    if (efecto.usosRestantes !== undefined) {
        efecto.usosRestantes -= 1;
        const ahora = new Date();
        usuario.efectos = usuario.efectos.filter((e) => efectoValido(e, ahora));
        await Usuario.updateOne(
            { userId, guildId },
            { $set: { efectos: usuario.efectos } }
        );
    }

    return efecto;
}

module.exports = {
    limpiarEfectosExpirados,
    tieneEfectoActivo,
    obtenerEfectoActivo,
    consumirUsoEfecto,
};

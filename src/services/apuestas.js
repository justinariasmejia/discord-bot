// src/services/apuestas.js
// Lógica de negocio y resolución de juegos de apuestas con consumo de pociones.
const Usuario = require('../models/Usuario');
const { obtenerUsuario, modificarHuesos } = require('./economia');
const { obtenerConfig, eventoActivo } = require('./evento');
const { conBloqueo } = require('../utils/locks');
const config = require('../data/config');

const cooldownsApuesta = new Map();

function verificarCooldown(userId) {
    const ahora = Date.now();
    const ultimo = cooldownsApuesta.get(userId);
    if (ultimo && ahora - ultimo < config.APUESTAS.COOLDOWN_MS) {
        return {
            enCooldown: true,
            restanteMs: config.APUESTAS.COOLDOWN_MS - (ahora - ultimo),
        };
    }
    cooldownsApuesta.set(userId, ahora);
    if (cooldownsApuesta.size > 2000) {
        const limite = ahora - config.APUESTAS.COOLDOWN_MS;
        for (const [id, ts] of cooldownsApuesta.entries()) {
            if (ts < limite) cooldownsApuesta.delete(id);
        }
    }
    return { enCooldown: false };
}

function validarApuesta(usuario, monto) {
    if (typeof monto === 'string') {
        const str = monto.trim().toLowerCase();
        if (str === 'todo' || str === 'all' || str === 'max') {
            monto = Math.min(usuario.huesos, config.APUESTAS.MAXIMA_ABSOLUTA || 5000);
        } else if (str === 'mitad' || str === 'half') {
            monto = Math.floor(usuario.huesos / 2);
        }
    }

    monto = Math.trunc(Number(monto));
    if (!Number.isInteger(monto) || isNaN(monto) || monto <= 0) {
        return { valida: false, motivo: 'El monto ingresado debe ser un número entero positivo.' };
    }

    if (monto < config.APUESTAS.MINIMA) {
        return {
            valida: false,
            motivo: `La apuesta mínima permitida es de **${config.APUESTAS.MINIMA}** huesos.`,
        };
    }

    if (usuario.huesos < monto) {
        return {
            valida: false,
            motivo: `No tienes suficientes huesos. Tu saldo actual es de **${usuario.huesos}** huesos.`,
        };
    }

    const maxAbsoluto = config.APUESTAS.MAXIMA_ABSOLUTA || 5000;
    if (monto > maxAbsoluto) {
        return {
            valida: false,
            motivo: `Tu apuesta excede el límite máximo permitido de **${maxAbsoluto}** huesos.`,
        };
    }

    return { valida: true, monto };
}

function calcularProbabilidad(probBase) {
    return probBase || 0.48;
}

// ── 1. Cara o Cruz ──
async function apostarCaraCruz(userId, guildId, monto, eleccion) {
    const confEvento = await obtenerConfig(guildId);
    if (!eventoActivo(confEvento)) return { ok: false, motivo: 'evento_cerrado' };

    const cd = verificarCooldown(userId);
    if (cd.enCooldown) return { ok: false, motivo: 'cooldown', restanteMs: cd.restanteMs };

    const bloqueo = await conBloqueo(`${guildId}:${userId}`, async () => {
        const usuario = await obtenerUsuario(userId, guildId);
        const val = validarApuesta(usuario, monto);
        if (!val.valida) return { ok: false, motivo: 'invalido', detalle: val.motivo };

        monto = val.monto;
        const deducido = await modificarHuesos(userId, guildId, -monto, 'apuesta', 'Apuesta Cara o Cruz');
        if (!deducido) return { ok: false, motivo: 'saldo_insuficiente' };

        const prob = calcularProbabilidad(config.APUESTAS.CARA_CRUZ.PROB_VICTORIA_BASE);

        const gana = Math.random() < prob;
        const eleccionNormalizada = (eleccion || 'cara').toLowerCase().includes('cruz') ? 'cruz' : 'cara';
        const resultadoLado = gana ? eleccionNormalizada : (eleccionNormalizada === 'cara' ? 'cruz' : 'cara');

        let saldoFinal = deducido.huesos;
        let premio = 0;

        if (gana) {
            premio = Math.round(monto * config.APUESTAS.CARA_CRUZ.MULTIPLICADOR_PAGO);
            const pagado = await modificarHuesos(userId, guildId, premio, 'apuesta', 'Victoria Cara o Cruz');
            saldoFinal = pagado.huesos;
            await Usuario.updateOne(
                { userId, guildId },
                { $inc: { 'estadisticas.apostado': monto, 'estadisticas.ganado': premio - monto } }
            );
        } else {
            await Usuario.updateOne(
                { userId, guildId },
                { $inc: { 'estadisticas.apostado': monto, 'estadisticas.perdido': monto } }
            );
        }

        return {
            ok: true,
            juego: 'cara_cruz',
            gana,
            eleccion: eleccionNormalizada,
            resultadoLado,
            monto,
            premio,
            saldoFinal,
        };
    });

    if (bloqueo.ocupado) return { ok: false, motivo: 'ocupado', detalle: 'Se está procesando otra acción.' };
    return bloqueo.resultado;
}

// ── 2. Dados Malditos ──
async function apostarDados(userId, guildId, monto, tipoTier, valorExtra) {
    const confEvento = await obtenerConfig(guildId);
    if (!eventoActivo(confEvento)) return { ok: false, motivo: 'evento_cerrado' };

    const cd = verificarCooldown(userId);
    if (cd.enCooldown) return { ok: false, motivo: 'cooldown', restanteMs: cd.restanteMs };

    const bloqueo = await conBloqueo(`${guildId}:${userId}`, async () => {
        const usuario = await obtenerUsuario(userId, guildId);
        const val = validarApuesta(usuario, monto);
        if (!val.valida) return { ok: false, motivo: 'invalido', detalle: val.motivo };

        monto = val.monto;
        const deducido = await modificarHuesos(userId, guildId, -monto, 'apuesta', 'Apuesta Dados Malditos');
        if (!deducido) return { ok: false, motivo: 'saldo_insuficiente' };

        const dado1 = Math.floor(Math.random() * 6) + 1;
        const dado2 = Math.floor(Math.random() * 6) + 1;
        const suma = dado1 + dado2;

        let gana = false;
        let mult = 0;

        if (tipoTier === 'bajo') {
            if (suma >= 2 && suma <= 6) {
                gana = true;
                mult = config.APUESTAS.DADOS.PAGO_BAJO_ALTO;
            }
        } else if (tipoTier === 'alto') {
            if (suma >= 8 && suma <= 12) {
                gana = true;
                mult = config.APUESTAS.DADOS.PAGO_BAJO_ALTO;
            }
        } else if (tipoTier === 'rango2') {
            const numInicio = parseInt(valorExtra, 10);
            if (suma === numInicio || suma === numInicio + 1) {
                gana = true;
                mult = config.APUESTAS.DADOS.PAGO_RANGO_DOS;
            }
        } else if (tipoTier === 'exacto') {
            const numExacto = parseInt(valorExtra, 10);
            if (suma === numExacto) {
                gana = true;
                mult = config.APUESTAS.DADOS.PAGO_EXACTO;
            }
        }

        let saldoFinal = deducido.huesos;
        let premio = 0;

        if (gana) {
            premio = Math.round(monto * mult);
            const pagado = await modificarHuesos(userId, guildId, premio, 'apuesta', 'Victoria Dados Malditos');
            saldoFinal = pagado.huesos;
            await Usuario.updateOne(
                { userId, guildId },
                { $inc: { 'estadisticas.apostado': monto, 'estadisticas.ganado': premio - monto } }
            );
        } else {
            await Usuario.updateOne(
                { userId, guildId },
                { $inc: { 'estadisticas.apostado': monto, 'estadisticas.perdido': monto } }
            );
        }

        return {
            ok: true,
            juego: 'dados',
            gana,
            dado1,
            dado2,
            suma,
            tipoTier,
            valorExtra,
            monto,
            premio,
            saldoFinal,
        };
    });

    if (bloqueo.ocupado) return { ok: false, motivo: 'ocupado', detalle: 'Se está procesando otra acción.' };
    return bloqueo.resultado;
}

// ── 3. Ruleta de la Calabaza ──
async function apostarRuleta(userId, guildId, monto, colorElegido) {
    const confEvento = await obtenerConfig(guildId);
    if (!eventoActivo(confEvento)) return { ok: false, motivo: 'evento_cerrado' };

    const cd = verificarCooldown(userId);
    if (cd.enCooldown) return { ok: false, motivo: 'cooldown', restanteMs: cd.restanteMs };

    const bloqueo = await conBloqueo(`${guildId}:${userId}`, async () => {
        const usuario = await obtenerUsuario(userId, guildId);
        const val = validarApuesta(usuario, monto);
        if (!val.valida) return { ok: false, motivo: 'invalido', detalle: val.motivo };

        monto = val.monto;
        const deducido = await modificarHuesos(userId, guildId, -monto, 'apuesta', 'Apuesta Ruleta');
        if (!deducido) return { ok: false, motivo: 'saldo_insuficiente' };

        const numero = Math.floor(Math.random() * config.APUESTAS.RULETA.TOTAL_CASILLAS);
        let colorResultado = 'verde';
        if (numero >= 1 && numero <= 18) colorResultado = 'rojo';
        else if (numero >= 19 && numero <= 36) colorResultado = 'negro';

        const gana = colorElegido === colorResultado;
        let mult = 0;
        if (gana) {
            mult = colorResultado === 'verde' ? config.APUESTAS.RULETA.PAGO_VERDE : config.APUESTAS.RULETA.PAGO_COLOR;
        }

        let saldoFinal = deducido.huesos;
        let premio = 0;

        if (gana) {
            premio = Math.round(monto * mult);
            const pagado = await modificarHuesos(userId, guildId, premio, 'apuesta', 'Victoria Ruleta');
            saldoFinal = pagado.huesos;
            await Usuario.updateOne(
                { userId, guildId },
                { $inc: { 'estadisticas.apostado': monto, 'estadisticas.ganado': premio - monto } }
            );
        } else {
            await Usuario.updateOne(
                { userId, guildId },
                { $inc: { 'estadisticas.apostado': monto, 'estadisticas.perdido': monto } }
            );
        }

        return {
            ok: true,
            juego: 'ruleta',
            gana,
            numero,
            colorResultado,
            colorElegido,
            monto,
            premio,
            saldoFinal,
        };
    });

    if (bloqueo.ocupado) return { ok: false, motivo: 'ocupado', detalle: 'Se está procesando otra acción.' };
    return bloqueo.resultado;
}

// ── 4. Tragamonedas de Halloween ──
function obtenerSimboloTragamonedas() {
    const simbolos = config.APUESTAS.TRAGAMONEDAS.SIMBOLOS;
    const pesos = config.APUESTAS.TRAGAMONEDAS.PESOS;
    const totalPesos = pesos.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalPesos;
    for (let i = 0; i < simbolos.length; i++) {
        if (r < pesos[i]) return simbolos[i];
        r -= pesos[i];
    }
    return simbolos[simbolos.length - 1];
}

async function apostarTragamonedas(userId, guildId, monto) {
    const confEvento = await obtenerConfig(guildId);
    if (!eventoActivo(confEvento)) return { ok: false, motivo: 'evento_cerrado' };

    const cd = verificarCooldown(userId);
    if (cd.enCooldown) return { ok: false, motivo: 'cooldown', restanteMs: cd.restanteMs };

    const bloqueo = await conBloqueo(`${guildId}:${userId}`, async () => {
        const usuario = await obtenerUsuario(userId, guildId);
        const val = validarApuesta(usuario, monto);
        if (!val.valida) return { ok: false, motivo: 'invalido', detalle: val.motivo };

        monto = val.monto;
        const deducido = await modificarHuesos(userId, guildId, -monto, 'apuesta', 'Apuesta Tragamonedas');
        if (!deducido) return { ok: false, motivo: 'saldo_insuficiente' };

        const s1 = obtenerSimboloTragamonedas();
        const s2 = obtenerSimboloTragamonedas();
        const s3 = obtenerSimboloTragamonedas();

        let mult = 0;
        let combinacion = 'Ninguna';

        if (s1 === s2 && s2 === s3) {
            mult = config.APUESTAS.TRAGAMONEDAS.PAGOS_TRIOS[s1] || 2.0;
            combinacion = `Trío de ${s1}`;
        } else if ([s1, s2, s3].filter((x) => x === '🦴').length === 2) {
            mult = config.APUESTAS.TRAGAMONEDAS.PAGO_DOS_HUESOS;
            combinacion = 'Dos Huesos';
        } else if (s1 === s2 || s2 === s3 || s1 === s3) {
            mult = config.APUESTAS.TRAGAMONEDAS.PAGO_DOS_IGUALES;
            combinacion = 'Par de símbolos';
        }

        const gana = mult > 0;
        let saldoFinal = deducido.huesos;
        let premio = 0;

        if (gana) {
            premio = Math.round(monto * mult);
            const pagado = await modificarHuesos(userId, guildId, premio, 'apuesta', `Victoria Tragamonedas (${combinacion})`);
            saldoFinal = pagado.huesos;
            await Usuario.updateOne(
                { userId, guildId },
                { $inc: { 'estadisticas.apostado': monto, 'estadisticas.ganado': premio - monto } }
            );
        } else {
            await Usuario.updateOne(
                { userId, guildId },
                { $inc: { 'estadisticas.apostado': monto, 'estadisticas.perdido': monto } }
            );
        }

        return {
            ok: true,
            juego: 'tragamonedas',
            gana,
            carretes: [s1, s2, s3],
            combinacion,
            mult,
            monto,
            premio,
            saldoFinal,
        };
    });

    if (bloqueo.ocupado) return { ok: false, motivo: 'ocupado', detalle: 'Se está procesando otra acción.' };
    return bloqueo.resultado;
}

module.exports = {
    validarApuesta,
    calcularProbabilidad,
    apostarCaraCruz,
    apostarDados,
    apostarRuleta,
    apostarTragamonedas,
};

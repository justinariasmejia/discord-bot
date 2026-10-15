// src/services/apuestas.js
// Lógica de negocio y resolución de juegos de apuestas con prevención de abuso y auditoría.
const Usuario = require('../models/Usuario');
const config = require('../data/config');
const { obtenerUsuario, modificarHuesos } = require('./economia');
const { obtenerConfig, eventoActivo, esAdminOTester } = require('./evento');
const { conBloqueo } = require('../utils/locks');
const { sancionarUsuario } = require('./sanciones');

/**
 * Registra una apuesta en la ventana horaria del usuario y aplica control de abuso.
 * @param {object} usuario
 * @param {string} userId
 * @param {string} guildId
 * @returns {Promise<{ ok: boolean, motivo?: string, maxHora?: number }>}
 */
async function registrarApuestaHora(usuario, userId, guildId) {
    if (!config.APUESTAS?.ENABLE_ANTI_FRAUDE) return { ok: true };
    const ahora = Date.now();
    const ventanaMs = 60 * 60 * 1000;
    const inicioVentana = usuario.apuestasHoraInicio ? new Date(usuario.apuestasHoraInicio).getTime() : 0;

    if (!inicioVentana || ahora - inicioVentana >= ventanaMs) {
        await Usuario.updateOne(
            { userId, guildId },
            { $set: { apuestasCountHora: 1, apuestasHoraInicio: new Date() } }
        );
        usuario.apuestasCountHora = 1;
        usuario.apuestasHoraInicio = new Date();
        return { ok: true };
    }

    const nuevoConteo = (usuario.apuestasCountHora || 0) + 1;
    await Usuario.updateOne(
        { userId, guildId },
        { $set: { apuestasCountHora: nuevoConteo } }
    );
    usuario.apuestasCountHora = nuevoConteo;

    const maxHora = config.APUESTAS?.MAX_APUESTAS_PER_HORA || 30;
    if (nuevoConteo > maxHora) {
        await Usuario.updateOne({ userId, guildId }, { $inc: { sospechas: 1 } });
        const usrActualizado = await Usuario.findOne({ userId, guildId });
        const sospechasActuales = usrActualizado?.sospechas || 1;
        const umbral = config.APUESTAS.SUSPICION_THRESHOLD || 3;

        // Emitir log de movimiento sospechoso a logs administrativos y canal de sanciones
        try {
            const { logSospecha } = require('./logger');
            await logSospecha(guildId, userId, {
                tipo: 'Exceso de Apuestas por Hora',
                detalle: `El usuario intentó realizar su apuesta número **${nuevoConteo}** en 1 hora (límite permitido: ${maxHora}). Sospechas acumuladas: **${sospechasActuales}/${umbral}**.`,
                nivel: sospechasActuales >= umbral ? 'critico' : 'advertencia',
                campos: [
                    { name: '📊 Apuestas en la última hora', value: `${nuevoConteo} / ${maxHora}`, inline: true },
                    { name: '⚠️ Nivel de Alerta', value: `${sospechasActuales} de ${umbral}`, inline: true },
                ],
            });
        } catch {}

        if (sospechasActuales >= umbral) {
            await sancionarUsuario(userId, guildId, 'Exceso reiterado de apuestas por hora (posible automatización o bot)');
        }
        return { ok: false, motivo: 'exceso_apuestas_hora', maxHora };
    }
    return { ok: true };
}

/**
 * Valida estado de sanciones, límites horarios y saldo antes de procesar una apuesta.
 */
async function procesarApuestaPrevia(usuario, userId, guildId, monto) {
    const ahora = Date.now();
    if (usuario.silencioApuestasHasta && ahora < new Date(usuario.silencioApuestasHasta).getTime()) {
        return { valida: false, motivo: 'silenciado', expira: usuario.silencioApuestasHasta };
    }
    if (usuario.bloqueoApuestasHasta && ahora < new Date(usuario.bloqueoApuestasHasta).getTime()) {
        return { valida: false, motivo: 'bloqueado', expira: usuario.bloqueoApuestasHasta };
    }

    const registro = await registrarApuestaHora(usuario, userId, guildId);
    if (!registro.ok) {
        return { valida: false, motivo: registro.motivo, maxHora: registro.maxHora };
    }

    const val = validarApuesta(usuario, monto);
    if (!val.valida) {
        return { valida: false, motivo: 'invalido', detalle: val.motivo };
    }

    return { valida: true, monto: val.monto };
}

// ── Cooldown Inteligente Progresivo y Sistema de Fatiga Anti-Spam ──
// Registra tiros seguidos para escalar el tiempo de enfriamiento:
// • 1 a 4 tiros: 25 segundos base
// • 5 a 9 tiros: 45 segundos + aviso de fatiga
// • 10 a 14 tiros: 90 segundos (1.5m) + alerta de sobrecalentamiento
// • 15 tiros: BLOQUEO POR FATIGA DE 2 HORAS
// • 15 minutos sin jugar resetea la racha a cero.
const estadosApuestas = new Map(); // userId -> { ultimoTiro, tirosSeguidos, cooldownActualMs, bloqueoHasta }

// Limpieza periódica de estados inactivos para prevenir acumulación en memoria
setInterval(() => {
    const ahora = Date.now();
    for (const [uid, est] of estadosApuestas.entries()) {
        const expirado = (ahora - est.ultimoTiro > 2 * 60 * 60 * 1000) && (!est.bloqueoHasta || ahora >= est.bloqueoHasta);
        if (expirado) estadosApuestas.delete(uid);
    }
}, 30 * 60 * 1000).unref();

function consultarCooldown(userId) {
    const ahora = Date.now();
    const estado = estadosApuestas.get(userId);
    if (!estado) return { enCooldown: false, tirosSeguidos: 0 };

    // Si tiene un bloqueo mayor por fatiga (2 horas)
    if (estado.bloqueoHasta && ahora < estado.bloqueoHasta) {
        return {
            enCooldown: true,
            restanteMs: estado.bloqueoHasta - ahora,
            tirosSeguidos: estado.tirosSeguidos,
            esBloqueoHoras: true,
        };
    }

    const tiempoPasado = ahora - estado.ultimoTiro;
    if (tiempoPasado < estado.cooldownActualMs) {
        return {
            enCooldown: true,
            restanteMs: estado.cooldownActualMs - tiempoPasado,
            tirosSeguidos: estado.tirosSeguidos,
            esBloqueoHoras: Boolean(estado.bloqueoHasta && ahora < estado.bloqueoHasta),
        };
    }

    return { enCooldown: false, tirosSeguidos: estado.tirosSeguidos };
}

async function sincronizarYConsultarCooldown(userId, guildId) {
    const ahora = Date.now();
    let estado = estadosApuestas.get(userId);

    // Chequeo prioritario de silencio por maldición de Oogie Boogie
    if (guildId) {
        const usuario = await obtenerUsuario(userId, guildId).catch(() => null);
        if (usuario && usuario.silencioApuestasHasta && ahora < usuario.silencioApuestasHasta.getTime()) {
            return {
                enCooldown: true,
                restanteMs: usuario.silencioApuestasHasta.getTime() - ahora,
                tirosSeguidos: 0,
                esSilencioOogie: true,
            };
        }

        // Si no está en memoria, consultar si tenía bloqueo por fatiga en la base de datos
        if (!estado && usuario && usuario.bloqueoApuestasHasta && ahora < usuario.bloqueoApuestasHasta.getTime()) {
            estado = {
                ultimoTiro: usuario.ultimoTiroApuesta ? usuario.ultimoTiroApuesta.getTime() : ahora,
                tirosSeguidos: usuario.rachaApuestas || 15,
                cooldownActualMs: usuario.bloqueoApuestasHasta.getTime() - ahora,
                bloqueoHasta: usuario.bloqueoApuestasHasta.getTime(),
            };
            estadosApuestas.set(userId, estado);
            return {
                enCooldown: true,
                restanteMs: estado.bloqueoHasta - ahora,
                tirosSeguidos: estado.tirosSeguidos,
                esBloqueoHoras: true,
            };
        }
    }

    return consultarCooldown(userId);
}

function verificarCooldown(userId, tipoJuego = 'general') {
    const ahora = Date.now();
    let estado = estadosApuestas.get(userId);

    const baseMs = config.APUESTAS?.COOLDOWN_BASE_MS || 25000;
    const fatiga = config.APUESTAS?.FATIGA || {
        NIVEL1_TIROS: 5,
        COOLDOWN_NIVEL1_MS: 45000,
        NIVEL2_TIROS: 10,
        COOLDOWN_NIVEL2_MS: 90000,
        LIMITE_BLOQUEO_TIROS: 15,
        DURACION_BLOQUEO_MS: 7200000,
        TIEMPO_RESET_RACHA_MS: 900000,
    };

    if (estado) {
        // Si estaba en bloqueo de horas
        if (estado.bloqueoHasta && ahora < estado.bloqueoHasta) {
            return {
                enCooldown: true,
                restanteMs: estado.bloqueoHasta - ahora,
                tirosSeguidos: estado.tirosSeguidos,
                esBloqueoHoras: true,
            };
        }

        const tiempoPasado = ahora - estado.ultimoTiro;

        // Si todavía está en enfriamiento
        if (tiempoPasado < estado.cooldownActualMs) {
            return {
                enCooldown: true,
                restanteMs: estado.cooldownActualMs - tiempoPasado,
                tirosSeguidos: estado.tirosSeguidos,
                esBloqueoHoras: false,
            };
        }

        // Si descansó más del tiempo de reset (15 min), reiniciar racha
        if (tiempoPasado > fatiga.TIEMPO_RESET_RACHA_MS) {
            estado.tirosSeguidos = 1;
            estado.bloqueoHasta = null;
        } else {
            estado.tirosSeguidos += 1;
        }
    } else {
        estado = {
            ultimoTiro: 0,
            tirosSeguidos: 1,
            cooldownActualMs: baseMs,
            bloqueoHasta: null,
        };
        estadosApuestas.set(userId, estado);
    }

    // Calcular próximo cooldown según el número de tiros alcanzado
    estado.ultimoTiro = ahora;

    if (estado.tirosSeguidos >= fatiga.LIMITE_BLOQUEO_TIROS) {
        estado.cooldownActualMs = fatiga.DURACION_BLOQUEO_MS;
        estado.bloqueoHasta = ahora + fatiga.DURACION_BLOQUEO_MS;
    } else if (estado.tirosSeguidos >= fatiga.NIVEL2_TIROS) {
        estado.cooldownActualMs = fatiga.COOLDOWN_NIVEL2_MS;
        estado.bloqueoHasta = null;
    } else if (estado.tirosSeguidos >= fatiga.NIVEL1_TIROS) {
        estado.cooldownActualMs = fatiga.COOLDOWN_NIVEL1_MS;
        estado.bloqueoHasta = null;
    } else {
        estado.cooldownActualMs = baseMs;
        estado.bloqueoHasta = null;
    }

    // Persistir estado de fatiga en la base de datos
    Usuario.updateOne(
        { userId },
        {
            $set: {
                rachaApuestas: estado.tirosSeguidos,
                ultimoTiroApuesta: new Date(ahora),
                bloqueoApuestasHasta: estado.bloqueoHasta ? new Date(estado.bloqueoHasta) : null,
            }
        }
    ).catch(() => null);

    // Limpieza periódica de memoria
    if (estadosApuestas.size > 2000) {
        const limite = ahora - 300000;
        for (const [id, est] of estadosApuestas.entries()) {
            if (!est.bloqueoHasta && est.ultimoTiro < limite) estadosApuestas.delete(id);
        }
    }

    return {
        enCooldown: false,
        tirosSeguidos: estado.tirosSeguidos,
        cooldownActualMs: estado.cooldownActualMs,
        bloqueoHasta: estado.bloqueoHasta,
        esBloqueoHoras: Boolean(estado.bloqueoHasta),
    };
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
    if (!eventoActivo(confEvento) || (confEvento.modoTest && !esAdminOTester(userId, confEvento))) return { ok: false, motivo: 'evento_cerrado' };

    const cd = verificarCooldown(userId, 'cara_cruz');
    if (cd.enCooldown) return { ok: false, motivo: 'cooldown', restanteMs: cd.restanteMs };

    const bloqueo = await conBloqueo(`${guildId}:${userId}`, async () => {
        const usuario = await obtenerUsuario(userId, guildId);
        const val = await procesarApuestaPrevia(usuario, userId, guildId, monto);
        if (!val.valida) {
            return { ok: false, motivo: val.motivo, detalle: val.detalle, expira: val.expira, maxHora: val.maxHora };
        }

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

    const cd = verificarCooldown(userId, 'dados');
    if (cd.enCooldown) return { ok: false, motivo: 'cooldown', restanteMs: cd.restanteMs };

    const bloqueo = await conBloqueo(`${guildId}:${userId}`, async () => {
        const usuario = await obtenerUsuario(userId, guildId);
        const val = await procesarApuestaPrevia(usuario, userId, guildId, monto);
        if (!val.valida) {
            return { ok: false, motivo: val.motivo, detalle: val.detalle, expira: val.expira, maxHora: val.maxHora };
        }

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

    const cd = verificarCooldown(userId, 'ruleta');
    if (cd.enCooldown) return { ok: false, motivo: 'cooldown', restanteMs: cd.restanteMs };

    const bloqueo = await conBloqueo(`${guildId}:${userId}`, async () => {
        const usuario = await obtenerUsuario(userId, guildId);
        const val = await procesarApuestaPrevia(usuario, userId, guildId, monto);
        if (!val.valida) {
            return { ok: false, motivo: val.motivo, detalle: val.detalle, expira: val.expira, maxHora: val.maxHora };
        }

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
    if (!eventoActivo(confEvento) || (confEvento.modoTest && !esAdminOTester(userId, confEvento))) return { ok: false, motivo: 'evento_cerrado' };

    const cd = verificarCooldown(userId, 'tragamonedas');
    if (cd.enCooldown) return { ok: false, motivo: 'cooldown', restanteMs: cd.restanteMs };

    const bloqueo = await conBloqueo(`${guildId}:${userId}`, async () => {
        const usuario = await obtenerUsuario(userId, guildId);
        const val = await procesarApuestaPrevia(usuario, userId, guildId, monto);
        if (!val.valida) {
            return { ok: false, motivo: val.motivo, detalle: val.detalle, expira: val.expira, maxHora: val.maxHora };
        }

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
    verificarCooldown,
    consultarCooldown,
    sincronizarYConsultarCooldown,
    validarApuesta,
    calcularProbabilidad,
    apostarCaraCruz,
    apostarDados,
    apostarRuleta,
    apostarTragamonedas,
};

// src/services/cazar.js
// Servicio de cacería en la Cripta de los Huesos con soporte para ítems y maldiciones.
const Usuario = require('../models/Usuario');
const { obtenerUsuario, registrarTransaccion, modificarHuesos } = require('./economia');
const { obtenerConfig, eventoActivo, multiplicadorActual } = require('./evento');
const { conBloqueo } = require('../utils/locks');
const { generarBotinCaza } = require('../data/loot');
const {
    tieneEfectoActivo,
    consumirUsoEfecto,
    limpiarEfectosExpirados,
} = require('./efectos');
const configBalance = require('../data/config');

async function cazar(userId, guildId) {
    const config = await obtenerConfig(guildId);
    if (!eventoActivo(config)) {
        return { ok: false, motivo: 'evento_cerrado' };
    }

    const bloqueo = await conBloqueo(`${guildId}:${userId}`, async () => {
        let usuario = await obtenerUsuario(userId, guildId);
        usuario = await limpiarEfectosExpirados(usuario);

        const ahora = Date.now();
        const ultimo = usuario.ultimoCazar ? usuario.ultimoCazar.getTime() : null;

        if (ultimo && ahora - ultimo < configBalance.CAZAR.COOLDOWN_MS) {
            return {
                ok: false,
                motivo: 'cooldown',
                proximo: ultimo + configBalance.CAZAR.COOLDOWN_MS,
            };
        }

        // Efecto Linterna: si está activa, mejora la probabilidad de hallar algo valioso
        const tieneLinterna = tieneEfectoActivo(usuario, 'linterna');
        let botin = generarBotinCaza();
        if (tieneLinterna && (botin.tipo === 'nada' || botin.tipo === 'emboscada')) {
            // La linterna disipa las sombras y da una segunda oportunidad
            botin = generarBotinCaza();
        }

        // Efecto Doble o Nada
        const tieneDobleONada = tieneEfectoActivo(usuario, 'doble_o_nada');
        let detalleDobleONada = null;

        // Maldición suave aleatoria
        let detalleMaldicion = null;
        if (configBalance.MALDICIONES_SUAVES.ACTIVADAS && Math.random() < configBalance.MALDICIONES_SUAVES.PROBABILIDAD) {
            const pct = Math.random() * (configBalance.MALDICIONES_SUAVES.PERDIDA_MAX_PCT - configBalance.MALDICIONES_SUAVES.PERDIDA_MIN_PCT) + configBalance.MALDICIONES_SUAVES.PERDIDA_MIN_PCT;
            const perdidaM = Math.max(1, Math.floor(usuario.huesos * pct));
            if (perdidaM > 0 && usuario.huesos > perdidaM) {
                await modificarHuesos(userId, guildId, -perdidaM, 'maldicion', 'Susurro de la Cripta');
                detalleMaldicion = {
                    perdida: perdidaM,
                    texto: `👻 Un escalofrío recorre tu nuca... Un susurro maldito se llevó **${perdidaM}** huesos.`,
                };
            }
        }

        // ── Caso A: Ganancia de huesos (Común o Raro) ──
        if (botin.tipo === 'hueso_comun' || botin.tipo === 'hueso_raro') {
            const multiplicador = multiplicadorActual(config);
            let premio = Math.round(botin.huesosBase * multiplicador);

            if (tieneDobleONada) {
                await consumirUsoEfecto(userId, guildId, 'doble_o_nada');
                const exitoDoble = Math.random() < 0.5;
                if (exitoDoble) {
                    premio *= 2;
                    detalleDobleONada = '⚡ **¡Doble o Nada ÉPICO!** Tu botín de huesos se ha duplicado.';
                } else {
                    premio = 0;
                    detalleDobleONada = '⚡ **Doble o Nada fallido:** La oscuridad absorbió todo el botín.';
                }
            }

            const actualizado = await Usuario.findOneAndUpdate(
                { userId, guildId, ultimoCazar: usuario.ultimoCazar ?? null },
                {
                    $set: { ultimoCazar: new Date(ahora) },
                    $inc: { huesos: premio, 'estadisticas.cazados': 1 },
                },
                { new: true }
            );

            if (!actualizado) return { ok: false, motivo: 'conflicto' };

            if (premio > 0) {
                await registrarTransaccion(
                    userId,
                    guildId,
                    'cazar',
                    premio,
                    actualizado.huesos,
                    `${botin.titulo} (x${multiplicador})`
                );
            }

            return {
                ok: true,
                tipo: botin.tipo,
                titulo: botin.titulo,
                descripcion: botin.descripcion,
                premio,
                multiplicador,
                detalleDobleONada,
                detalleMaldicion,
                tieneLinterna,
                usuario: actualizado,
            };
        }

        // ── Caso B: Drop de ítem ──
        if (botin.tipo === 'item') {
            const item = botin.item;
            const tieneItem = (usuario.inventario || []).some((i) => i.itemId === item.id);

            let actualizado;
            if (tieneItem) {
                actualizado = await Usuario.findOneAndUpdate(
                    {
                        userId,
                        guildId,
                        ultimoCazar: usuario.ultimoCazar ?? null,
                        'inventario.itemId': item.id,
                    },
                    {
                        $set: { ultimoCazar: new Date(ahora) },
                        $inc: { 'inventario.$.cantidad': 1, 'estadisticas.cazados': 1 },
                    },
                    { new: true }
                );
            } else {
                actualizado = await Usuario.findOneAndUpdate(
                    { userId, guildId, ultimoCazar: usuario.ultimoCazar ?? null },
                    {
                        $set: { ultimoCazar: new Date(ahora) },
                        $push: { inventario: { itemId: item.id, cantidad: 1 } },
                        $inc: { 'estadisticas.cazados': 1 },
                    },
                    { new: true }
                );
            }

            if (!actualizado) return { ok: false, motivo: 'conflicto' };

            await registrarTransaccion(
                userId,
                guildId,
                'cazar',
                0,
                actualizado.huesos,
                `Obtuvo ítem: ${item.nombre}`
            );

            return {
                ok: true,
                tipo: 'item',
                titulo: botin.titulo,
                descripcion: botin.descripcion,
                item,
                detalleMaldicion,
                tieneLinterna,
                usuario: actualizado,
            };
        }

        // ── Caso C: Emboscada de monstruo ──
        if (botin.tipo === 'emboscada') {
            let perdida = Math.floor(usuario.huesos * configBalance.CAZAR.EMBOSCADA_PORCENTAJE);
            if (usuario.huesos > 0 && perdida < 1) perdida = 1;
            if (perdida > configBalance.CAZAR.EMBOSCADA_TOPE_MAX) perdida = configBalance.CAZAR.EMBOSCADA_TOPE_MAX;
            if (perdida > usuario.huesos) perdida = usuario.huesos;

            const filtro = {
                userId,
                guildId,
                ultimoCazar: usuario.ultimoCazar ?? null,
            };
            if (perdida > 0) {
                filtro.huesos = { $gte: perdida };
            }

            const actualizado = await Usuario.findOneAndUpdate(
                filtro,
                {
                    $set: { ultimoCazar: new Date(ahora) },
                    $inc: { huesos: -perdida, 'estadisticas.cazados': 1 },
                },
                { new: true }
            );

            if (!actualizado) return { ok: false, motivo: 'conflicto' };

            if (perdida > 0) {
                await registrarTransaccion(
                    userId,
                    guildId,
                    'cazar',
                    -perdida,
                    actualizado.huesos,
                    'Emboscada en el cementerio'
                );
            }

            return {
                ok: true,
                tipo: 'emboscada',
                titulo: botin.titulo,
                descripcion: botin.descripcion,
                perdida,
                detalleMaldicion,
                tieneLinterna,
                usuario: actualizado,
            };
        }

        // ── Caso D: Nada ──
        const actualizado = await Usuario.findOneAndUpdate(
            { userId, guildId, ultimoCazar: usuario.ultimoCazar ?? null },
            {
                $set: { ultimoCazar: new Date(ahora) },
                $inc: { 'estadisticas.cazados': 1 },
            },
            { new: true }
        );

        if (!actualizado) return { ok: false, motivo: 'conflicto' };

        return {
            ok: true,
            tipo: 'nada',
            titulo: botin.titulo,
            descripcion: botin.descripcion,
            detalleMaldicion,
            tieneLinterna,
            usuario: actualizado,
        };
    });

    if (bloqueo.ocupado) return { ok: false, motivo: 'ocupado' };
    return bloqueo.resultado;
}

module.exports = { cazar };

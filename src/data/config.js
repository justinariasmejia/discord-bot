// src/data/config.js
// Configuración centralizada de balance del juego y parámetros de eventos.
// Permite ajustar probabilidades, tiempos y recompensas sin tocar la lógica.

module.exports = {
    // ─── Economía Base ───
    ECONOMIA: {
        HUESOS_INICIALES: 100,
    },

    // ─── Cazar (Fase 2) ───
    CAZAR: {
        COOLDOWN_MS: 60 * 60 * 1000, // 1 hora de enfriamiento entre cacerías
        HUESOS_COMUN_MIN: 15,        // Huesos mínimos por hallazgo común
        HUESOS_COMUN_MAX: 40,        // Huesos máximos por hallazgo común
        HUESOS_RARO_MIN: 60,         // Huesos mínimos por hallazgo raro
        HUESOS_RARO_MAX: 130,        // Huesos máximos por hallazgo raro
        EMBOSCADA_PORCENTAJE: 0.05,  // Pierde el 5% de sus huesos actuales en emboscada
        EMBOSCADA_TOPE_MAX: 50,      // Máxima cantidad de huesos que puede perder en emboscada
        DELAY_ANIMACION_MS: 1200,    // Retardo (~1.2s) entre pasos de animación de suspenso
    },

    // ─── Ranking (Fase 2) ───
    RANKING: {
        POR_PAGINA: 10,              // Cantidad de usuarios por página de la tabla de clasificación
    },

    // ─── Salón de la Fama (Fase 2) ───
    SALON_FAMA: {
        INTERVALO_ACTUALIZACION_MS: 5 * 60 * 1000, // Actualización automática cada 5 minutos
        TOP_CANTIDAD: 5,                            // Muestra a los mejores 5 participantes
    },

    // ─── Apuestas y Minijuegos (Fase 3) ───
    APUESTAS: {
        MINIMA: 10,
        MAXIMA_ABSOLUTA: 5000,
        MAXIMO_PORCENTAJE: 0.50,      // Máximo el 50% del saldo actual
        COOLDOWN_MS: 5000,            // 5 segundos entre apuestas por usuario
        DELAY_ANIMACION_MS: 1100,     // Retardo entre frames de animación de apuestas

        // Cara o Cruz
        CARA_CRUZ: {
            PROB_VICTORIA_BASE: 0.48, // 48% de victoria base
            MULTIPLICADOR_PAGO: 2.0,
        },

        // Dados Malditos (2 dados de 6 caras, suma de 2 a 12)
        DADOS: {
            PAGO_BAJO_ALTO: 1.9,
            PAGO_RANGO_DOS: 2.8,
            PAGO_EXACTO: 5.5,
        },

        // Ruleta de la Calabaza (37 casillas)
        RULETA: {
            TOTAL_CASILLAS: 37,
            PAGO_COLOR: 2.0,
            PAGO_VERDE: 14.0,
        },

        // Tragamonedas de Halloween (3 carretes)
        TRAGAMONEDAS: {
            SIMBOLOS: ['🎃', '👻', '💀', '🦴', '🕷️'],
            PESOS: [8, 14, 20, 26, 32],
            PAGOS_TRIOS: {
                '🎃': 15.0,
                '👻': 8.0,
                '💀': 5.0,
                '🦴': 3.0,
                '🕷️': 2.0,
            },
            PAGO_DOS_HUESOS: 1.5,
            PAGO_DOS_IGUALES: 1.2,
        },

        // Ruleta Grupal en canal público
        RULETA_GRUPAL: {
            DURACION_SEGUNDOS: 30,
            CORTE_CASA: 0.05,
            MINIMO_JUGADORES: 2,
        },
    },

    // ─── Duelos (Fase 3) ───
    DUELOS: {
        TIMEOUT_ACEPTAR_MS: 60000,    // 60 segundos para aceptar o declinar
        CORTE_CASA: 0.05,             // 5% para la casa del pozo total
        DELAY_MIN_MS: 2000,           // Retardo mínimo para la señal de disparo (2s)
        DELAY_MAX_MS: 5000,           // Retardo máximo para la señal de disparo (5s)
    },

    // ─── Robos (Fase 4) ───
    ROBAR: {
        COOLDOWN_MS: 2 * 60 * 60 * 1000, // 2 horas de enfriamiento entre robos
        MINIMO_HUESOS_VICTIMA: 50,       // La víctima debe tener al menos 50 huesos
        PROB_MIN: 0.25,                  // Probabilidad mínima de éxito (25%)
        PROB_MAX: 0.65,                  // Probabilidad máxima de éxito (65%)
        ROBO_MIN_PCT: 0.05,              // Roba entre 5% y 15% de los huesos de la víctima
        ROBO_MAX_PCT: 0.15,
        MULTA_FALLO_MIN_PCT: 0.05,       // Multa al ladrón si falla: 5% a 10% de sus huesos
        MULTA_FALLO_MAX_PCT: 0.10,
        MULTA_MINIMA: 10,
    },

    // ─── Limosna del Fantasma (Fase 4) ───
    LIMOSNA: {
        LIMITE_HUESOS: 30,               // Solo accesible si el usuario tiene menos de 30 huesos
        COOLDOWN_MS: 24 * 60 * 60 * 1000,// 24 horas de enfriamiento
        CANTIDAD: 40,                    // Recibe 40 huesos de socorro
    },

    // ─── Maldiciones Suaves (Fase 4) ───
    MALDICIONES_SUAVES: {
        ACTIVADAS: true,                 // Activador global de maldiciones aleatorias
        PROBABILIDAD: 0.06,              // 6% de probabilidad tras cazar
        PERDIDA_MIN_PCT: 0.01,           // Pierde entre 1% y 3% de sus huesos
        PERDIDA_MAX_PCT: 0.03,
    },
};

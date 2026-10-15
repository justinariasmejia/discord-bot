// src/data/config.js
// Configuración centralizada de balance del juego y parámetros de eventos.
// Permite ajustar probabilidades, tiempos y recompensas sin tocar la lógica.

module.exports = {
    // ─── Economía Base ───
    ECONOMIA: {
        HUESOS_INICIALES: 100,
    },

    // ─── Actividad de la Comunidad (Chat y Voz) ───
    ACTIVIDAD: {
        CHAT: {
            COOLDOWN_MS: 60 * 1000,      // 1 minuto de cooldown por usuario
            HUESOS_MIN: 2,               // 2 a 5 huesos por mensaje válido
            HUESOS_MAX: 5,
            LONGITUD_MINIMA: 4,          // Caracteres mínimos para evitar spam
        },
        VOZ: {
            INTERVALO_MS: 2.5 * 60 * 1000, // Chequeo cada 2.5 minutos
            HUESOS_POR_INTERVALO: 3,       // ~72 huesos por hora de charla activa
            MINIMO_MIEMBROS: 2,            // Mínimo 2 miembros activos sin mutear
        },
    },

    // ─── Cazar (Simplificado) ───
    CAZAR: {
        COOLDOWN_MS: 60 * 60 * 1000, // 1 hora de enfriamiento entre cacerías
        HUESOS_COMUN_MIN: 25,        // Huesos comunes
        HUESOS_COMUN_MAX: 55,
        HUESOS_RARO_MIN: 80,         // Cráneo Dorado
        HUESOS_RARO_MAX: 180,
        DELAY_ANIMACION_MS: 1200,    // Retardo (~1.2s) entre pasos de animación
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
        COOLDOWN_BASE_MS: 25000,      // 25 segundos base para cualquier apuesta individual
        COOLDOWN_MS: 25000,           // Cooldown inicial general (25s)
        DELAY_ANIMACION_MS: 1100,     // Retardo entre frames de animación de apuestas
        FATIGA: {
            NIVEL1_TIROS: 5,           // A partir de 5 tiros seguidos -> 45s cooldown
            COOLDOWN_NIVEL1_MS: 45000,
            NIVEL2_TIROS: 10,          // A partir de 10 tiros seguidos -> 90s cooldown
            COOLDOWN_NIVEL2_MS: 90000,
            LIMITE_BLOQUEO_TIROS: 15,  // A los 15 tiros seguidos -> Bloqueo obligatorio de 2 horas
            DURACION_BLOQUEO_MS: 2 * 60 * 60 * 1000, // 2 horas (7200s) de descanso obligatorio
            TIEMPO_RESET_RACHA_MS: 15 * 60 * 1000,   // 15 minutos sin apostar resetea la racha
        },

        // Cara o Cruz
        CARA_CRUZ: {
            PROB_VICTORIA_BASE: 0.48, // 48% de victoria base
            MULTIPLICADOR_PAGO: 2.0,
        },

        // ---- Anti‑fraude / sospechas ----
        ENABLE_ANTI_FRAUDE: true,                // Activar detección de comportamiento sospechoso
        SUSPICION_THRESHOLD: 3,                  // Nº de apuestas sospechosas antes de sancionar
        SANCTION_FACTOR: 0.15,                   // Pérdida del 15 % de huesos al sancionar
        SANCTION_DURATION_MS: 30 * 60 * 1000,    // 30 min de restricción (mute/bloqueo)
        MAX_APUESTAS_PER_HORA: 20,               // Límite de apuestas por usuario por hora

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
            DURACION_SEGUNDOS: 60,              // 1 minuto de espera para que la gente participe
            DURACION_RESULTADO_SEGUNDOS: 60,    // 1 minuto de resultado visible antes de auto-eliminarse
            COOLDOWN_SEGUNDOS: 60,              // 1 minuto de cooldown tras finalizar antes de poder iniciar otra
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
        APUESTA_MAXIMA: 1000,         // Apuesta máxima por jugador para evitar desangrado masivo
        COOLDOWN_GLOBAL_MS: 45 * 1000, // Cooldown global de 45s entre duelos para un mismo usuario
        // ---- Anti‑colusión ----
        MAX_DUELS_PER_DAY: 5,                     // Límite de duelos por usuario al día
        COOLDOWN_SAME_OPPONENT_MS: 30 * 60 * 1000, // 30 min entre duelos contra el mismo adversario
        SANCTION_FACTOR: 0.20,                    // Pérdida del 20 % de huesos al detectar colusión
        SANCTION_DURATION_MS: 2 * 60 * 60 * 1000, // 2 h de sanción (bloqueo total de duelos y apuestas)
        ENABLE_ANTI_COLLUSION: true,               // Activar restricciones anti‑colusión
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

    // ─── Oogie Boogie: El Estafador de la Cripta ───
    OOGIE_BOOGIE: {
        HABILITADO: true,
        PROBABILIDAD_CICLO: 0.15,            // 15% de probabilidad por ciclo de scheduler (10 min)
        COOLDOWN_GLOBAL_MS: 45 * 60 * 1000,  // Máximo 1 aparición cada 45 minutos por servidor
        MAX_VICTIMAS: 2,                     // 1 a 2 víctimas por aparición
        TOP_CANDIDATOS: 10,                  // Universo del ranking evaluado para el focus
        PORCENTAJE_APUESTA: 0.18,            // 18% del saldo actual de la víctima como apuesta forzada
        PENALIZACION_HUIR_PCT: 0.08,         // 8% de pérdida total por huir (cobardía)
        PENALIZACION_IGNORAR_PCT: 0.12,      // 12% de pérdida total por no responder en el tiempo límite
        TIEMPO_RESPUESTA_MS: 90 * 1000,      // 90 segundos para responder
        SILENCIO_HUIR_MS: 30 * 60 * 1000,    // 30 min sin apostar ni duelos tras huir
        SILENCIO_IGNORAR_MS: 45 * 60 * 1000, // 45 min sin apostar ni duelos tras ignorar
        MULTIPLICADOR_GANANCIA: 1.45,        // Si el cazador vence a las trampas: recupera apuesta + 45% neto
        GIF_APARICION_URL: 'attachment://oogie.gif', // GIF local permanente empaquetado como archivo adjunto
    },

    // ─── Seguridad y Anti‑Fraude (Nivel Alto) ───
    SEGURIDAD: {
        GLOBAL_RISK_LEVEL: 'ALTA',                     // Nivel de riesgo global (ALTA, MEDIA, BAJA)
        DETECTION_SENSITIVITY: 0.9,                    // 0‑1, mayor sensibilidad = más detección
        SANCTION_MULTIPLIER: 0.25,                     // % de huesos perdidos en sanciones fuertes
        BAN_DURATION_MS: 24 * 60 * 60 * 1000,          // 24 h de prohibición por reincidencia
        LOGGING_ENABLED: true,                         // Registrar todas las actividades sospechosas
        NOTIFY_ADMIN: true,                            // Notificar al admin del servidor
        MAX_ALERTS_PER_HOUR: 10,                       // Límite de alertas antes de throttling
    },
};


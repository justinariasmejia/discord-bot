// src/events/voiceStateUpdate.js
// Desconexión automática limpia cuando el bot se queda solo en el canal de voz (TTS o Música).

const { desactivarTTS, obtenerEstadoTTS } = require('../services/tts');
const { desconectar, obtenerCola } = require('../services/musica');

module.exports = {
    name: 'voiceStateUpdate',

    async ejecutar(oldState, newState, client) {
        try {
            const guild = oldState.guild || newState.guild;
            if (!guild) return;

            const guildId = guild.id;
            const botId = client.user.id;

            // 1. Manejo para lector TTS
            const estadoTTS = obtenerEstadoTTS(guildId);
            if (estadoTTS.activo) {
                const canalVoz = guild.channels.cache.get(estadoTTS.canalVozId);
                if (canalVoz) {
                    // Contar miembros humanos (no bots) en el canal
                    const humanos = canalVoz.members.filter((m) => !m.user.bot);
                    if (humanos.size === 0) {
                        desactivarTTS(guildId, 'canal de voz quedó sin usuarios');
                    }
                } else {
                    // Si el canal ya no existe o el bot fue desconectado
                    desactivarTTS(guildId, 'canal no encontrado');
                }
            }

            // 2. Manejo para reproductor de música
            const cola = obtenerCola(guildId);
            if (cola && cola.canalVozId) {
                const canalVozMusica = guild.channels.cache.get(cola.canalVozId);
                if (canalVozMusica) {
                    const humanos = canalVozMusica.members.filter((m) => !m.user.bot);
                    if (humanos.size === 0) {
                        // Iniciar timeout de 2 minutos antes de desconectar música por abandono
                        if (!cola.timeoutVacio) {
                            cola.timeoutVacio = setTimeout(() => {
                                const c = obtenerCola(guildId);
                                if (c) {
                                    const ch = guild.channels.cache.get(c.canalVozId);
                                    if (ch && ch.members.filter((m) => !m.user.bot).size === 0) {
                                        desconectar(guildId);
                                    }
                                }
                            }, 2 * 60 * 1000);
                        }
                    } else if (cola.timeoutVacio) {
                        clearTimeout(cola.timeoutVacio);
                        cola.timeoutVacio = null;
                    }
                }
            }
        } catch (e) {
            console.error('Error en voiceStateUpdate:', e?.message || e);
        }
    },
};

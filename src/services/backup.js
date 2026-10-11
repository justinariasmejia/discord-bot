// src/services/backup.js
// Servicio de respaldos periódicos (cada 1h) y manuales para la base de datos de La Cripta.
const fs = require('fs');
const path = require('path');
const Usuario = require('../models/Usuario');
const ConfigEvento = require('../models/ConfigEvento');
const Transaccion = require('../models/Transaccion');
const EventoAleatorio = require('../models/EventoAleatorio');
const Duelo = require('../models/Duelo');
const RondaGrupal = require('../models/RondaGrupal');
const Cumpleanos = require('../models/Cumpleanos');

const RUTA_BACKUPS = path.join(__dirname, '..', '..', 'backups');
const MAX_BACKUPS_CONSERVADOS = 48; // Guarda hasta 48 respaldos (2 días completos de backups horarios)

function asegurarCarpetaBackups() {
    if (!fs.existsSync(RUTA_BACKUPS)) {
        fs.mkdirSync(RUTA_BACKUPS, { recursive: true });
    }
}

/**
 * Genera un archivo de respaldo con el estado íntegro de la base de datos.
 */
async function crearBackup(guildId = null, motivo = 'manual') {
    asegurarCarpetaBackups();

    const timestamp = Date.now();
    const fechaLegible = new Date(timestamp).toISOString().replace(/[:.]/g, '-');
    const nombreArchivo = `backup-${fechaLegible}-${motivo}.json`;
    const rutaArchivo = path.join(RUTA_BACKUPS, nombreArchivo);

    const filtro = guildId ? { guildId } : {};

    const [usuarios, configs, transacciones, eventos, duelos, rondas, cumpleanos] = await Promise.all([
        Usuario.find(filtro).lean(),
        ConfigEvento.find(filtro).lean(),
        Transaccion.find(filtro).lean(),
        EventoAleatorio.find(filtro).lean(),
        Duelo.find(filtro).lean(),
        RondaGrupal.find(filtro).lean(),
        Cumpleanos.find(filtro).lean(),
    ]);

    const payload = {
        metadata: {
            timestamp,
            fecha: new Date(timestamp).toISOString(),
            motivo,
            guildId: guildId || 'global',
            totalUsuarios: usuarios.length,
            totalTransacciones: transacciones.length,
        },
        colecciones: {
            usuarios,
            configs,
            transacciones,
            eventos,
            duelos,
            rondas,
            cumpleanos,
        },
    };

    const jsonString = JSON.stringify(payload, null, 2);
    fs.writeFileSync(rutaArchivo, jsonString, 'utf-8');

    const tamanoBytes = fs.statSync(rutaArchivo).size;
    const tamanoKb = (tamanoBytes / 1024).toFixed(2);

    // Rotación de backups antiguos para proteger el espacio en disco
    rotarBackupsAntiguos();

    return {
        ok: true,
        nombreArchivo,
        rutaArchivo,
        tamanoKb,
        totalUsuarios: usuarios.length,
        totalTransacciones: transacciones.length,
        fecha: new Date(timestamp),
    };
}

function rotarBackupsAntiguos() {
    try {
        asegurarCarpetaBackups();
        const archivos = fs.readdirSync(RUTA_BACKUPS)
            .filter((f) => f.startsWith('backup-') && f.endsWith('.json'))
            .map((f) => ({
                nombre: f,
                ruta: path.join(RUTA_BACKUPS, f),
                tiempo: fs.statSync(path.join(RUTA_BACKUPS, f)).mtimeMs,
            }))
            .sort((a, b) => b.tiempo - a.tiempo);

        if (archivos.length > MAX_BACKUPS_CONSERVADOS) {
            const sobrantes = archivos.slice(MAX_BACKUPS_CONSERVADOS);
            for (const f of sobrantes) {
                fs.unlinkSync(f.ruta);
            }
        }
    } catch (err) {
        console.error('⚠️ Error rotando backups antiguos:', err?.message || err);
    }
}

/**
 * Inicia el cron de respaldos automáticos cada 1 hora.
 */
function iniciarServicioBackups(client) {
    const INTERVALO_MS = 60 * 60 * 1000; // 1 hora exacta

    setInterval(async () => {
        try {
            const res = await crearBackup(null, 'auto_1h');
            console.log(`💾 [Backup 1h] Respaldo automático generado: ${res.nombreArchivo} (${res.tamanoKb} KB, ${res.totalUsuarios} cazadores).`);

            // Notificar a los canales de auditoría de los servidores configurados
            for (const guild of client.guilds.cache.values()) {
                const conf = await ConfigEvento.findOne({ guildId: guild.id });
                if (conf && conf.canalLogsId) {
                    const canalLogs = guild.channels.cache.get(conf.canalLogsId);
                    if (canalLogs && canalLogs.isTextBased()) {
                        const { base, COLORES } = require('../utils/embeds');
                        const embed = base(
                            '💾 Respaldo Automático de Base de Datos (1 Hora)',
                            `Se ha generado con éxito el respaldo horario del servidor.\n\n` +
                            `• **Archivo:** \`${res.nombreArchivo}\`\n` +
                            `• **Cazadores respaldados:** \`${res.totalUsuarios}\`\n` +
                            `• **Transacciones archivadas:** \`${res.totalTransacciones}\`\n` +
                            `• **Tamaño:** \`${res.tamanoKb} KB\``,
                            COLORES.morado
                        );
                        canalLogs.send({ embeds: [embed] }).catch(() => null);
                    }
                }
            }
        } catch (err) {
            console.error('❌ Error en el servicio de backups automáticos:', err);
        }
    }, INTERVALO_MS);

    console.log('💾 Servicio de Respaldos Automáticos iniciado (intervalo: cada 1 hora).');
}

module.exports = {
    crearBackup,
    iniciarServicioBackups,
};

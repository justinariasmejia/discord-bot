// Evita que un mismo usuario ejecute dos acciones con huesos a la vez
// (doble clic, spam de botones). Se combina con operaciones atómicas en la DB.
const bloqueados = new Set();

async function conBloqueo(clave, fn) {
    if (bloqueados.has(clave)) return { ocupado: true };
    bloqueados.add(clave);
    try {
        return { ocupado: false, resultado: await fn() };
    } finally {
        bloqueados.delete(clave);
    }
}

module.exports = { conBloqueo };

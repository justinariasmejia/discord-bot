// Carga automática de comandos, interacciones y eventos.
const fs = require('fs');
const path = require('path');

const archivosJs = (carpeta) =>
    fs.readdirSync(path.join(__dirname, carpeta)).filter((f) => f.endsWith('.js'));

function cargarComandos(client) {
    for (const archivo of archivosJs('commands')) {
        const comando = require(`./commands/${archivo}`);
        client.commands.set(comando.data.name, comando);
    }
    console.log(`📦 Comandos cargados: ${client.commands.size}`);
}

// Cada archivo de /interactions exporta { prefijo, ejecutar(interaction, partes) }.
// El customId tiene la forma  prefijo:accion:duenoId:extra
function cargarInteracciones(client) {
    for (const archivo of archivosJs('interactions')) {
        const handler = require(`./interactions/${archivo}`);
        client.interacciones.set(handler.prefijo, handler);
    }
    console.log(`🖱️ Handlers de interacción cargados: ${client.interacciones.size}`);
}

function cargarEventos(client) {
    for (const archivo of archivosJs('events')) {
        const evento = require(`./events/${archivo}`);
        const fn = (...args) => evento.ejecutar(...args, client);
        if (evento.once) client.once(evento.name, fn);
        else client.on(evento.name, fn);
    }
}

module.exports = { cargarComandos, cargarInteracciones, cargarEventos };

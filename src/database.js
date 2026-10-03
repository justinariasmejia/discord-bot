// Conexión a MongoDB Atlas. Los datos viven en la nube, no en el servidor del bot,
// así que sobreviven a cualquier deploy o reinicio.
const mongoose = require('mongoose');

async function conectarDB(intentos = 5) {
    mongoose.connection.on('disconnected', () => console.warn('⚠️ MongoDB desconectado, reintentando...'));
    mongoose.connection.on('reconnected', () => console.log('✅ MongoDB reconectado'));
    mongoose.connection.on('error', (e) => console.error('❌ Error de MongoDB:', e.message));

    for (let i = 1; i <= intentos; i++) {
        try {
            await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
            console.log('🗄️ Conectado a MongoDB');
            return;
        } catch (error) {
            console.error(`❌ Conexión a MongoDB fallida (${i}/${intentos}): ${error.message}`);
            if (i === intentos) {
                console.error('Revisa MONGODB_URI y que la IP del hosting esté permitida en Atlas (Network Access).');
                process.exit(1);
            }
            await new Promise((r) => setTimeout(r, 5000));
        }
    }
}

module.exports = { conectarDB };

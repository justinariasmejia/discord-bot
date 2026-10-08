# 🎃 La Cripta de los Huesos — Bot de Evento de Halloween

Bot de evento completo para Discord desarrollado con **discord.js v14**, **MongoDB Atlas** y **Mongoose 8**.
Toda la economía, inventarios, transacciones y estados de juego se gestionan de forma atómica y persistente en MongoDB con control estricto de concurrencia y prevención de duplicidad por clics.

---

## 🚀 Despliegue y Configuración

### 1. Base de Datos (MongoDB Atlas)
1. Entra a [MongoDB Atlas](https://www.mongodb.com/atlas) y crea tu cuenta gratuita.
2. Crea un cluster gratuito (M0).
3. **Database Access** → Crea un usuario con credenciales de lectura y escritura.
4. **Network Access** → Agrega `0.0.0.0/0` (permite el acceso desde cualquier IP del hosting).
5. **Connect → Drivers** → Copia tu connection string `mongodb+srv://.../cripta?retryWrites=true`.

### 2. Variables de Entorno (`.env`)
Configura las siguientes variables en tu archivo `.env` local o en el panel de tu hosting:
```env
DISCORD_TOKEN=tu_token_de_bot_aqui
CLIENT_ID=tu_application_id_aqui
MONGODB_URI=mongodb+srv://usuario:clave@cluster.mongodb.net/cripta?retryWrites=true
EVENTO_CIERRE=2026-10-31T23:59:59-04:00
```
> **Nota de Seguridad:** El archivo `.env` está en `.gitignore` y nunca debe subirse al repositorio.

### 3. Comandos de Inicialización
```bash
npm install
npm run deploy   # Registra los comandos slash globales (/admin, /cripta, /duelo, /say)
npm start        # Inicia el bot
```

---

## 📜 Arquitectura y Mecánicas del Evento

### 🕯️ 1. Hub Principal (`/cripta`) y Guía (`/ayuda`)
- **`/cripta`**: Hub interactivo privado (ephemeral) con navegación fluida y limpia de solo 6 botones:
  - 🏹 **Cazar**: Cacería en el cementerio cada 1 hora.
  - 🎁 **Diario**: Bono diario con bono de racha acumulable (hasta 7 días).
  - 🎰 **Apostar**: Acceso directo a Cara o Cruz y Tragamonedas de Halloween.
  - 🏆 **Ranking**: Paginado interactivo de las posiciones del servidor.
  - 👤 **Mi Perfil**: Resumen de saldo, puesto en el top y estadísticas.
  - ❓ **¿Cómo Jugar?**: Guía rápida accesible en 1 clic.
- **`/ayuda`**: Comando slash con la explicación completa del evento (con opción opcional de compartir públicamente en el canal).

### 💬 2. Recompensas por Actividad en la Comunidad
- **💬 Mensajes de Texto:** Cada mensaje enviado en canales de chat válidos otorga entre **2 y 5 huesos** automáticamente (con cooldown anti-spam de 60 segundos por usuario).
- **🎙️ Salas de Voz (VC):** El bot recompensa a los miembros que pasan tiempo charlando en canales de voz activos (mínimo 2 personas en la sala y sin estar ensordecidos), otorgando **6 huesos** cada 2.5 minutos.

### 🏹 3. Cacería Espectral y Ranking
- **🏹 Cacería Directa**: Cooldown de 1 hora. Siempre otorga botín de huesos sin mecánicas molestas (Huesos Comunes, Calabazas Encantadas o Cráneos Dorados Ancestrales).
- **🏆 Ranking Dinámico Paginado**: Paginación con botones interactivos y medallas conmemorativas (🥇, 🥈, 🥉).
- **🏛️ Salón de la Fama en Vivo**: Embed persistente auto-actualizable cada 5 minutos en el canal configurado.

### 🎰 4. Apuestas y Duelos PvP
- **🪙 Cara o Cruz**: Apuesta rápida x2.0 con 50% de probabilidad.
- **🎰 Tragamonedas de Halloween**: 3 carretes malditos con símbolos temáticos (🎃 👻 💀 🦴 🕷️) y multiplicadores de hasta x15.0.
- **👥 Ruleta Grupal Pública**: Ronda comunitaria de 30 segundos en el canal público.
- **⚔️ Duelos PvP (`/duelo <usuario>`):** Desafío directo de reflejos entre dos miembros apostando sus propios huesos.

### 🎃 5. Eventos Aleatorios de Halloween en el Chat
- **👻 Fantasma Fugaz**: Aparece durante 60 segundos; el primer cazador en pulsar el botón lo captura y recibe huesos (50 a 150 🦴).
- **🦴 Aparición de Huesos**: Pila de huesos antiguos en el cementerio; cualquiera puede pulsar el botón para recogerlos libremente (150 a 350 🦴).
- **🎃 Trivia del Terror**: Banco de 45 preguntas temáticas de terror y Halloween con 4 opciones. El primer acierto gana 100 huesos.
- **🌕 Eclipse Espectral**: Noche de luna carmesí donde todas las ganancias se multiplican por x2 durante 30 minutos.

### 🛡️ 6. Administración, Pruebas y Cierre
- `/admin modo_test <activar: true/false> [canal_test: #canal]`: **Modo de pruebas y aislamiento.** Bloquea el evento para usuarios normales (mostrando aviso de mantenimiento) y restringe las apariciones/pruebas al canal secreto configurado. La música y otras funciones del bot continúan funcionando al 100% para todos.
- `/admin evento <tipo>`: Dispara inmediatamente un evento (fantasma, trivia, huesos, eclipse_2x) en el canal de eventos o en el canal de pruebas si el modo test está activo.
- `/admin dar_huesos / quitar_huesos`: Ajustes manuales.
- `/admin canal_eventos / canal_salon_fama`: Configuración de canales.
- `/admin multiplicador`: Bonos globales temporales.
- `/admin ver_config`: Consulta el estado actual de los canales y si el Modo Test está activo.
- `/admin cerrar_evento`: Proclama al podio de ganadores final del Top 3.

---

## 🔒 Control de Concurrencia y Seguridad
1. **Mutaciones Atómicas**: Operaciones financieras ejecutadas con operadores atómicos de MongoDB (`$inc`, `$set`, `findOneAndUpdate`).
2. **Candados en Memoria (`conBloqueo`)**: Bloqueo instantáneo por usuario (`guildId:userId`) para impedir spam de botones o ataques de doble gasto.
3. **Reembolsos Automáticos**: Al reiniciar el bot, las rondas grupales y los duelos no resueltos devuelven el 100% de los huesos a los jugadores.
4. **Validaciones de Entrada**: Parsing riguroso de números (`Math.trunc`), verificación de fondos previos y límites porcentuales en apuestas.

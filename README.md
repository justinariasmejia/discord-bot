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

## 📜 Arquitectura y Fases Implementadas

### 🕯️ Fase 1: Núcleo y Hub Principal
- **`/cripta`**: Hub interactivo privado (ephemeral) con navegación fluida mediante edición de mensajes.
- **🎁 Recompensa Diaria**: Recompensa diaria con racha (hasta 7 días consecutivos con bono acumulativo) y cooldown de 20 horas.
- **👤 Perfil del Cazador**: Resumen del jugador, saldo actual de huesos, estadísticas completas de apuestas/cacerías y posición en el ranking global.
- **📢 `/say`**: Envío de comunicados embebidos al canal mediante ventana modal (requiere permisos de gestionar mensajes).

### 🏹 Fase 2: Cacería, Ranking y Salón de la Fama
- **🏹 Cacería Espectral**:
  - Cooldown de 1 hora verificado atómicamente en la base de datos.
  - Animación de suspenso en 2 pasos de edición (~1.2s cada uno) antes de revelar el resultado.
  - Tabla de botín ponderada (`src/data/loot.js`): Huesos Comunes, Cráneo Dorado Ancestral, Drop de Ítems raros, Emboscada de Monstruo (-5% con tope seguro) o Tumba Vacía.
- **🏆 Ranking Dinámico Paginado**:
  - Paginación interactiva (10 cazadores por página) con botones `◀ Anterior` y `Siguiente ▶`.
  - Medallas conmemorativas para el podio (🥇, 🥈, 🥉).
  - Muestra siempre el puesto exacto y saldo del usuario que ejecuta la consulta.
- **🏛️ Salón de la Fama en Vivo**:
  - Embed persistente auto-reparable que se refresca automáticamente cada 5 minutos en el canal configurado.
  - Muestra el Top 10 en tiempo real y el total de cazadores del servidor.

### 🎰 Fase 3: El Antro de las Ánimas (Casino y Apuestas)
- **🪙 Cara o Cruz**: Apuesta rápida x2.0 con selección interactiva por modal.
- **🎲 Dados Malditos**: Suma de 2 dados (2 al 12). Modos: Bajo (2-6, x1.9), Alto (8-12, x1.9) o Número Exacto (x5.5).
- **🎡 Ruleta de la Calabaza**: 37 casillas numeradas. Apuestas a Rojo (x2.0), Negro (x2.0) o Verde Calabaza (x14.0).
- **🎰 Tragamonedas de Halloween**: 3 carretes con símbolos espectrales (🎃 👻 💀 🦴 🕷️) y multiplicadores de hasta x15.0.
- **🔁 Botón de Apuesta Rápida**: Permite repetir la apuesta anterior con un solo clic.
- **👥 Ruleta Grupal Pública**:
  - Ronda comunitaria en el canal público con cuenta regresiva interactiva de 30 segundos.
  - Múltiples jugadores se unen colocando sus huesos a través de modales.
  - El pozo acumulado se reparte proporcionalmente entre los ganadores con ventaja matemática de la casa.
- **⚔️ Duelos PvP (`/duelo`)**:
  - Desafío directo de huesos entre dos usuarios con ventana de aceptación de 60 segundos.
  - Minijuego de reflejos con botón señuelo que penaliza falsos clics.
  - Reembolso automático seguro de apuestas y duelos pendientes tras reinicios del bot.

### 🛒 Fase 4: Bazar, Mochila, Hechizos y Robos
- **🛒 Tienda de la Cripta**:
  - Compra atómica con opciones de cantidad (x1, x3, x5).
  - Ítems disponibles:
    - 🧪 **Poción de Suerte**: +10% de probabilidad de victoria en tus próximas 3 apuestas.
    - ⚡ **Doble o Nada**: Tu próxima cacería duplica sus ganancias o las reduce a cero.
    - 🧿 **Amuleto de Protección**: Protege tus huesos contra 1 intento de robo (repele al ladrón).
    - 🗝️ **Llave del Cofre**: Abre los Cofres Malditos espontáneos que emergen en el servidor.
    - 🏮 **Linterna Espectral**: Reduce un 25% el tiempo de espera de tus cacerías durante 2 horas.
- **🎒 Mochila Espectral**:
  - Visualización de objetos en posesión y encantamientos activos (temporales o por uso).
  - Menú de activación directa de consumibles.
- **🕵️ Callejón de las Sombras (Robos)**:
  - Asaltos entre cazadores con cooldown de 2 horas.
  - Bloqueo de concurrencia dual para evitar carreras entre ladrón y víctima.
  - Probabilidad de éxito calculada según el ratio de riqueza (25% a 65%).
  - Éxito: roba entre 5% y 15% de los huesos de la víctima (alerta pública anónima).
  - Fallo: el ladrón es descubierto y paga una multa a la víctima (alerta pública revelando al ladrón).
  - Inmunidad total si la víctima posee un **Amuleto de Protección**.
- **🤲 Limosna del Fantasma**:
  - Subsidio de emergencia diario (40 huesos) para cazadores con menos de 30 huesos.

### 🌕 Fase 5: Eventos Aleatorios, Administración y Cierre
- **🎃 Eventos Espontáneos en Canal Público**:
  - **👻 Fantasma Fugaz**: Aparece durante 60 segundos; el primer cazador en pulsar el botón lo atrapa y recibe entre 50 y 150 huesos.
  - **🎃 Trivia del Terror**: Banco de 45 preguntas temáticas con 4 opciones. El primer acierto gana 100 huesos.
  - **🗝️ Cofre Maldito**: Arcón que emerge durante 2 minutos. Requiere una Llave del Cofre en el inventario; otorga 300 a 800 huesos más un artefacto sorpresa.
  - **🌕 Eclipse Espectral**: Noche de luna carmesí donde todas las recompensas se multiplican por x2 durante 30 minutos.
- **🛡️ Panel de Administración (`/admin`)**:
  - `/admin dar_huesos <usuario> <cantidad>`: Otorga huesos manualmente.
  - `/admin quitar_huesos <usuario> <cantidad>`: Descuenta huesos.
  - `/admin evento <tipo>`: Dispara inmediatamente un evento (fantasma, trivia, cofre, eclipse_2x).
  - `/admin canal_eventos <canal>`: Establece el canal donde ocurren las apariciones comunitarias.
  - `/admin canal_salon_fama <canal>`: Configura el canal para el Salón de la Fama.
  - `/admin multiplicador <factor> [minutos]`: Aplica un multiplicador global temporal.
  - `/admin transacciones [usuario]`: Consulta las últimas 15 transacciones económicas.
  - `/admin cerrar_evento`: Fuerza el cierre inmediato y proclama los ganadores.
  - `/admin reset_economia`: Reinicio total con panel de confirmación de seguridad irreversible.
- **🕯️ Cierre Automático y Salón de la Fama Final**:
  - Detección precisa de la fecha límite (`fechaCierre`).
  - Clausura inmediata e idempotente de todas las apuestas y cacerías.
  - Cálculo del podio final (Top 3) con persistencia en la colección `Ganadores`.
  - Proclamación solemne con embed conmemorativo en los canales públicos.

---

## 🔒 Control de Concurrencia y Seguridad
1. **Mutaciones Atómicas**: Operaciones financieras ejecutadas con operadores atómicos de MongoDB (`$inc`, `$set`, `findOneAndUpdate`).
2. **Candados en Memoria (`conBloqueo`)**: Bloqueo instantáneo por usuario (`guildId:userId`) para impedir spam de botones o ataques de doble gasto.
3. **Reembolsos Automáticos**: Al reiniciar el bot, las rondas grupales y los duelos no resueltos devuelven el 100% de los huesos a los jugadores.
4. **Validaciones de Entrada**: Parsing riguroso de números (`Math.trunc`), verificación de fondos previos y límites porcentuales en apuestas.

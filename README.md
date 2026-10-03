# 🎃 La Cripta de los Huesos — Bot de Evento de Halloween

Bot de evento para Discord (discord.js v14 + MongoDB Atlas + Mongoose 8).
Toda la economía y estado del juego se gestiona de forma atómica y persistente en MongoDB.

---

## 🚀 Despliegue y Configuración

### 1. Base de Datos (MongoDB Atlas)
1. Entra a [MongoDB Atlas](https://www.mongodb.com/atlas) y crea tu cuenta gratuita.
2. Crea un cluster gratuito (M0).
3. **Database Access** → Crea un usuario con credenciales de lectura y escritura.
4. **Network Access** → Agrega `0.0.0.0/0` (permitir acceso desde cualquier IP de tu hosting).
5. **Connect → Drivers** → Copia tu connection string `mongodb+srv://...` y agrega la base: `.../cripta?retryWrites=true`.

### 2. Variables de Entorno (`.env`)
Configura las siguientes variables en tu archivo `.env` local o en el panel de tu hosting:
```env
DISCORD_TOKEN=tu_token_aqui
CLIENT_ID=tu_client_id_aqui
MONGODB_URI=mongodb+srv://.../cripta?retryWrites=true
GUILD_ID=opcional_id_del_servidor_de_pruebas
EVENTO_CIERRE=2026-10-31T23:59:59-04:00
```
> **Nota:** El archivo `.env` está en `.gitignore` y **nunca** debe subirse al repositorio.

### 3. Instalación y Ejecución
```bash
npm install
npm run deploy   # Registra los slash commands (/cripta, /duelo, /say)
npm start        # Inicia el bot
```
*(Si defines `GUILD_ID` en el `.env`, los slash commands se registran al instante en tu servidor de pruebas).*

---

## 📜 Funcionalidades Implementadas

### Fase 1: Núcleo y Hub Principal
- `/cripta`: Hub interactivo privado (ephemeral) con navegación por edición de mensajes.
- **Diario (🎁)**: Recompensa diaria con racha (hasta 7 días con bono creciente) y cooldown de 20 horas.
- **Perfil (👤)**: Resumen del jugador, saldo de huesos, estadísticas de cacerías/diarios/apuestas y posición global.
- `/say`: Envío de mensajes al canal mediante ventana modal (requiere permiso de gestionar mensajes).

### Fase 2: Cacería, Ranking y Salón de la Fama
- **🏹 Cazar**:
  - Cooldown de 1 hora por usuario verificado atómicamente en base de datos.
  - Animación de suspenso en 2 pasos de edición (~1.2s cada uno) previa a la revelación del botín.
  - Tabla de botín ponderada (`src/data/loot.js`):
    - **Huesos Comunes**: recompensa estándar con multiplicador de evento.
    - **Cráneo Dorado Ancestral**: gran recompensa de huesos con multiplicador.
    - **Drop de Ítems**: artefactos añadidos al inventario (`amuleto`, `pocion_suerte`, `linterna`, `doble_o_nada`, `llave_cofre`).
    - **Emboscada de Monstruo**: pérdida del 5% de huesos (con tope máximo configurable; nunca baja de 0).
    - **Tumba Vacía**: sin recompensa.
- **🏆 Ranking**:
  - Tabla de clasificación con 10 usuarios por página navegable mediante botones `◀` y `▶`.
  - Medallas para los 3 primeros lugares (🥇, 🥈, 🥉).
  - Muestra siempre el puesto exacto y saldo del usuario solicitante, sin importar la página en la que esté.
- **🏛️ Salón de la Fama en Vivo**:
  - Canal público configurable (`ConfigEvento.canalSalonFamaId`).
  - Mantiene un único mensaje fijo (`ConfigEvento.mensajeSalonFamaId`) mostrando el top 5 en vivo y cuenta regresiva al cierre del evento.
  - Tarea periódica cada 5 minutos que auto-recrea el mensaje si es eliminado.

### Fase 3: Apuestas, Minijuegos y Duelos
- **🎰 Antro de las Ánimas (Apuestas en `/cripta`)**:
  - Límite global: Apuesta mínima 10 huesos, máxima = min(50% saldo, 5000 huesos). Cooldown de 5s entre apuestas.
  - Deducción atómica previa del saldo antes de revelar el resultado.
  - Hook de modificadores en `src/services/apuestas.js` (preparado para Poción de Suerte de la Fase 4).
  - Botón **"Apostar de nuevo 🔁"** que permite repetir la misma jugada con un clic.
  - **Juegos Disponibles**:
    1. **🪙 Cara o Cruz**: 48% de probabilidad de ganar, paga **x2.0**.
    2. **🎲 Dados Malditos**: Suma de 2 dados (2-12). Modal para elegir tier: Bajo (2-6) o Alto (8-12) a **x1.9**, Rango de 2 a **x2.8**, o Exacto a **x5.5**. Animación de dados rodando.
    3. **🎡 Ruleta de la Calabaza**: 37 casillas. Rojo o Negro pagan **x2.0**, Verde Calabaza (0) paga **x14.0**. Animación de giro.
    4. **🎰 Tragamonedas de Halloween**: 3 carretes con `🎃`, `👻`, `💀`, `🦴`, `🕷️`. Trío de calabazas paga **x15.0**, fantasmas **x8.0**, cráneos **x5.0**, dos huesos **x1.5**, par de símbolos **x1.2**. Animación de parada progresiva.
    5. **👥 Ruleta Grupal (Pública)**: Inicia una ronda comunitaria de 30 segundos en el canal de texto con botón abierto a todos. Los usuarios apuestan vía modal y la probabilidad de ganar es proporcional a su apuesta. Al terminar, el ganador se lleva el pozo (menos 5% de comisión de la casa). Si participan menos de 2 personas, se reembolsan los huesos automáticamente.
- **⚔️ /duelo @usuario**:
  - Desafío directo de reflejos entre dos jugadores en un canal público.
  - Abre modal para definir la apuesta de huesos (mínimo 10).
  - Envía invitación pública con 60s para aceptar o declinar.
  - Al aceptar, bloquea atómicamente la apuesta de ambos participantes.
  - **Minijuego de reacción**: Cuenta regresiva con botón señuelo ("No dispares todavía"). Quien toque el señuelo comete tiro en falso y pierde por descalificación inmediata. Tras 2-5 segundos aleatorios aparece el botón `"💥 ¡¡DISPARA YA!!"`. El primer clic válido se lleva el pozo (menos 5% de corte de la casa).
  - **Recuperación contra caídas**: Colecciones `Duelo` y `RondaGrupal` en MongoDB. En caso de reinicio del bot, cualquier duelo o ruleta activa reembolsa automáticamente los fondos a los jugadores al conectar.

---

## 🗂️ Estructura del Proyecto
```
index.js              # Punto de entrada y conexión
deploy-commands.js    # Registrador de slash commands
src/
  commands/           # Slash commands (/cripta, /duelo, /say)
  events/             # Manejadores de eventos (ready, interactionCreate)
  interactions/       # Handlers (cripta.js, apuesta.js, duelo.js, ruleta_grupal.js, say.js)
  models/             # Esquemas Mongoose (Usuario, Transaccion, ConfigEvento, Ganadores, Duelo, RondaGrupal)
  services/           # Lógica de negocio (economia, diario, cazar, ranking, salonFama, apuestas, duelos, ruletaGrupal, evento)
  data/               # Configuración central (config.js), botín (loot.js), catálogo de ítems (items.js)
  utils/              # Utilidades (embeds, paneles, locks)
```

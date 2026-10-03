// src/data/trivia.js
// Banco de preguntas de trivia temática de terror, mitología y Halloween.
const PREGUNTAS_TRIVIA = [
    {
        id: 1,
        pregunta: "¿De qué festival celta ancestral proviene la celebración moderna de Halloween?",
        opciones: ["Samhain", "Beltane", "Yule", "Lughnasadh"],
        correcta: 0,
        explicacion: "Samhain era la fiesta pagana con la que los antiguos celtas despedían el verano y daban la bienvenida al año nuevo celta."
    },
    {
        id: 2,
        pregunta: "¿En qué novela de 1897 apareció por primera vez el famoso Conde Drácula?",
        opciones: ["Frankenstein", "Carmilla", "Drácula de Bram Stoker", "El Vampiro de Polidori"],
        correcta: 2,
        explicacion: "Bram Stoker publicó su inmortal novela epistolar 'Drácula' en mayo de 1897."
    },
    {
        id: 3,
        pregunta: "¿Qué vegetal se vaciaba originalmente en Irlanda antes de popularizarse las calabazas en Halloween?",
        opciones: ["La patata", "El nabo", "La remolacha", "La cebolla"],
        correcta: 1,
        explicacion: "Originalmente en Irlanda y Escocia se tallaban nabos y remolachas para crear las linternas de Jack."
    },
    {
        id: 4,
        pregunta: "¿Cómo se llama el demonio de los sueños que acecha en la saga cinematográfica 'Pesadilla en Elm Street'?",
        opciones: ["Jason Voorhees", "Freddy Krueger", "Michael Myers", "Pinhead"],
        correcta: 1,
        explicacion: "Freddy Krueger, creado por Wes Craven en 1984, asesina a sus víctimas dentro de sus propios sueños."
    },
    {
        id: 5,
        pregunta: "¿Qué objeto o mineral tradicionalmente hiere y destruye a un Hombre Lobo según el folclore?",
        opciones: ["El oro puro", "La madera de fresno", "La plata", "El hierro frío"],
        correcta: 2,
        explicacion: "Las balas y armas forjadas con plata son la debilidad legendaria y letal de los licántropos."
    },
    {
        id: 6,
        pregunta: "¿Quién escribió la célebre obra de terror gótico 'El cuervo' (The Raven)?",
        opciones: ["H.P. Lovecraft", "Edgar Allan Poe", "Mary Shelley", "Stephen King"],
        correcta: 1,
        explicacion: "Edgar Allan Poe publicó su célebre poema narrativo 'El cuervo' en enero de 1845."
    },
    {
        id: 7,
        pregunta: "¿Cuál es el nombre del muñeco poseído en la clásica película de terror 'Child's Play' (1988)?",
        opciones: ["Annabelle", "Chucky", "Billy", "Slappy"],
        correcta: 1,
        explicacion: "Chucky es poseído por el asesino en serie Charles Lee Ray mediante un ritual vudú."
    },
    {
        id: 8,
        pregunta: "¿En qué estado de EE.UU. tuvieron lugar los infames juicios por brujería de 1692?",
        opciones: ["Massachusetts", "Pennsylvania", "Virginia", "Nueva York"],
        correcta: 0,
        explicacion: "Los juicios por brujería ocurrieron en el pueblo de Salem, en la colonia de Massachusetts."
    },
    {
        id: 9,
        pregunta: "¿Qué deidad cósmica primordial descansa durmiendo en la ciudad sumergida de R'lyeh?",
        opciones: ["Azathoth", "Cthulhu", "Nyarlathotep", "Shub-Niggurath"],
        correcta: 1,
        explicacion: "Cthulhu, creado por H.P. Lovecraft en 1928, sueña en las profundidades de la sumergida R'lyeh."
    },
    {
        id: 10,
        pregunta: "¿Cuál es la máscara que utiliza el asesino Michael Myers en la película 'Halloween' (1978)?",
        opciones: ["Una máscara de payaso", "La cara de William Shatner modificada", "Una calavera mexicana", "Una máscara de hockey"],
        correcta: 1,
        explicacion: "El equipo de producción compró una máscara del Capitán Kirk (William Shatner de Star Trek) por 2 dólares y la pintó de blanco."
    },
    {
        id: 11,
        pregunta: "¿Qué famoso hotel sirve como tétrico escenario en la obra 'El Resplandor' de Stephen King?",
        opciones: ["Hotel Bates", "Hotel Overlook", "Hotel Cortez", "Hotel Dolphin"],
        correcta: 1,
        explicacion: "El Hotel Overlook, aislado en las montañas de Colorado durante el invierno, enloquece a Jack Torrance."
    },
    {
        id: 12,
        pregunta: "¿Cuál es el nombre del barquero del inframundo en la mitología griega que transporta las almas por el río Aqueronte?",
        opciones: ["Caronte", "Cerbero", "Hades", "Tánatos"],
        correcta: 0,
        explicacion: "Caronte exige una moneda (óbolo) colocada en la boca del difunto para cruzar las almas al Hades."
    },
    {
        id: 13,
        pregunta: "¿Qué famosa escritora concibió el monstruo de Frankenstein durante un lluvioso verano en Suiza?",
        opciones: ["Jane Austen", "Mary Shelley", "Virginia Woolf", "Emily Brontë"],
        correcta: 1,
        explicacion: "Mary Shelley ideó la historia en Villa Diodati a sus 18 años, durante el 'Año sin verano' de 1816."
    },
    {
        id: 14,
        pregunta: "¿Qué significa literalmente la palabra 'Halloween'?",
        opciones: ["Noche de Espíritus", "Víspera de Todos los Santos", "Cosecha de Sombras", "Día de los Muertos"],
        correcta: 1,
        explicacion: "Halloween es una contracción de 'All Hallows' Eve', que significa Víspera de Todos los Santos."
    },
    {
        id: 15,
        pregunta: "¿Qué criatura mitológica chupadora de sangre habita según leyendas en Puerto Rico y Latinoamérica?",
        opciones: ["El Chupacabras", "El Silbón", "La Pisadeira", "El Cadejo"],
        correcta: 0,
        explicacion: "El Chupacabras se popularizó en la década de 1990 por supuestamente atacar ganado en zonas rurales."
    },
    {
        id: 16,
        pregunta: "¿Cuál es la frase tradicional que dicen los niños al pedir dulces de puerta en puerta?",
        opciones: ["Caramelo o Muerte", "Truco o Trato (Dulce o Truco)", "Calabaza o Hueso", "Magia o Susto"],
        correcta: 1,
        explicacion: "'Trick or Treat', traducido al español como Truco o Trato o Dulce o Travesura."
    },
    {
        id: 17,
        pregunta: "¿Qué animal negro de ojos brillantes se asocia tradicionalmente como familiar de las brujas?",
        opciones: ["El perro negro", "El gato negro", "El cuervo", "El murciélago"],
        correcta: 1,
        explicacion: "Los gatos negros eran considerados en la Edad Media como espías o transformaciones de las brujas."
    },
    {
        id: 18,
        pregunta: "¿En qué clásico del cine de terror aparece la aterradora niña poseída Regan MacNeil?",
        opciones: ["La Profecía", "El Exorcista", "Poltergeist", "La Semilla del Diablo"],
        correcta: 1,
        explicacion: "En 'El Exorcista' (1973), dirigida por William Friedkin basada en la novela de William Peter Blatty."
    },
    {
        id: 19,
        pregunta: "¿Qué monstruo legendario es vulnerable a la luz del sol, al ajo y a una estaca en el corazón?",
        opciones: ["El Vampiro", "La Momia", "El Ghoul", "El Espectro"],
        correcta: 0,
        explicacion: "El vampiro del folclore europeo es destruido por estacas de madera y repele el ajo y la luz solar."
    },
    {
        id: 20,
        pregunta: "¿Cómo se llama el pueblo ficticio de Maine donde transcurren muchas obras de Stephen King, entre ellas 'It'?",
        opciones: ["Silent Hill", "Derry", "Arkham", "Raccoon City"],
        correcta: 1,
        explicacion: "Derry (Maine) es el hogar maldito de Pennywise el payaso bailarín y escenario de múltiples relatos de King."
    },
    {
        id: 21,
        pregunta: "¿Cuál es el nombre del perro guardián de tres cabezas que vigila las puertas del inframundo griego?",
        opciones: ["Ortro", "Cerbero", "Hidra", "Quimera"],
        correcta: 1,
        explicacion: "Cerbero impide que los vivos entren al reino de los muertos y que las almas escapen."
    },
    {
        id: 22,
        pregunta: "¿En qué país se celebra el colorido y tradicional 'Día de los Muertos' el 1 y 2 de noviembre?",
        opciones: ["España", "México", "Colombia", "Argentina"],
        correcta: 1,
        explicacion: "El Día de los Muertos es una de las tradiciones más icónicas de México, reconocida como Patrimonio por la UNESCO."
    },
    {
        id: 23,
        pregunta: "¿Qué arma icónica blande Jason Voorhees en la serie de películas 'Viernes 13'?",
        opciones: ["Una motosierra", "Un machete", "Un hacha de leñador", "Un cuchillo de carnicero"],
        correcta: 1,
        explicacion: "Jason Voorhees es famoso por su máscara de hockey y su implacable machete oxidado."
    },
    {
        id: 24,
        pregunta: "¿Cómo se llama el pueblo maldito envuelto en niebla del famoso videojuego de terror psicológico de Konami?",
        opciones: ["Raccoon City", "Silent Hill", "Dunwich", "Innsmouth"],
        correcta: 1,
        explicacion: "Silent Hill es la siniestra localidad envuelta en niebla donde las pesadillas toman forma física."
    },
    {
        id: 25,
        pregunta: "¿Qué planta mítica con raíces antropomórficas supuestamente grita letalmente cuando es desenterrada?",
        opciones: ["El Acónito", "La Mandrágora", "La Belladona", "El Beleño"],
        correcta: 1,
        explicacion: "La mandrágora tiene una raíz que se asemeja a una figura humana y según el mito su grito enloquece o mata a quien lo oye."
    },
    {
        id: 26,
        pregunta: "¿Cuál es el nombre del muñeco de ventrílocuo que representa a Jigsaw en la franquicia 'Saw'?",
        opciones: ["Billy", "Slappy", "Otto", "Annabelle"],
        correcta: 0,
        explicacion: "Billy the Puppet es el muñeco que John Kramer utiliza para comunicarse en vídeo con sus víctimas."
    },
    {
        id: 27,
        pregunta: "¿Qué famoso conde rumano del siglo XV inspiró la leyenda del Conde Drácula?",
        opciones: ["Iván el Terrible", "Vlad Tepes (El Empalador)", "Isabel Báthory", "Gilles de Rais"],
        correcta: 1,
        explicacion: "Vlad III de Valaquia, conocido como Vlad el Empalador o Vlad Drácula por su ferocidad en la guerra."
    },
    {
        id: 28,
        pregunta: "¿Cuál es la película muda alemana de 1922 considerada la primera gran obra del cine de vampiros?",
        opciones: ["El Gabinete del Dr. Caligari", "Nosferatu", "Metrópolis", "Fausto"],
        correcta: 1,
        explicacion: "Nosferatu, eine Symphonie des Grauens, dirigida por F.W. Murnau y protagonizada por Max Schreck."
    },
    {
        id: 29,
        pregunta: "¿Qué flor naranja tradicional adorna los altares de muertos en México para guiar a los difuntos?",
        opciones: ["Cempasúchil", "Crisantemo", "Dalia", "Azucena"],
        correcta: 0,
        explicacion: "La flor de Cempasúchil guía con su brillante color y aroma el camino de las ánimas hacia sus ofrendas."
    },
    {
        id: 30,
        pregunta: "¿Qué espíritu del folclore irlandés emite un desgarrador lamento augurando la muerte inminente de alguien?",
        opciones: ["Leprechaun", "Banshee", "Dullahan", "Púca"],
        correcta: 1,
        explicacion: "La Banshee ('mujer del túmulo') llora y aúlla en la noche presagiando la muerte de un miembro de la familia."
    },
    {
        id: 31,
        pregunta: "¿Qué asesino del cine de terror utiliza una motosierra y viste piel humana en Texas?",
        opciones: ["Leatherface", "Ghostface", "Pinhead", "Candyman"],
        correcta: 0,
        explicacion: "Leatherface ('Cara de Cuero') de la clásica masacre de Texas ('The Texas Chain Saw Massacre', 1974)."
    },
    {
        id: 32,
        pregunta: "¿Qué tablero con letras y números se emplea popularmente en sesiones espiritistas para contactar a los muertos?",
        opciones: ["Tablero Ouija", "Tarot de Marsella", "Péndulo de Foucault", "Runas Nórdicas"],
        correcta: 0,
        explicacion: "La tabla Ouija fue patentada a finales del siglo XIX como un juego y luego adoptada por el espiritismo."
    },
    {
        id: 33,
        pregunta: "¿En qué relato de Lovecraft aparece una misteriosa ciudad costera cuyos habitantes se transforman en criaturas marinas?",
        opciones: ["La llamada de Cthulhu", "La sombra sobre Innsmouth", "El color que cayó del cielo", "El horror de Dunwich"],
        correcta: 1,
        explicacion: "En 'The Shadow over Innsmouth' (1931), los habitantes pactan con los Profundos y sufren la temida mutación."
    },
    {
        id: 34,
        pregunta: "¿Cómo se llama la espeluznante monja demoníaca del universo cinematográfico de 'El Conjuro'?",
        opciones: ["Pazuzu", "Valak", "Annabelle", "Baphomet"],
        correcta: 1,
        explicacion: "Valak, el Marqués de las Serpientes, adopta la forma de una monja profana para atormentar a los Warren."
    },
    {
        id: 35,
        pregunta: "¿Qué condesa húngara del siglo XVI es legendaria por supuestamente bañarse en la sangre de doncellas?",
        opciones: ["María Antonieta", "Isabel Báthory", "Lucrecia Borgia", "Catalina de Médici"],
        correcta: 1,
        explicacion: "Isabel Báthory, apodada 'La Condesa Sangrienta', es una de las mayores asesinas en serie de la historia."
    },
    {
        id: 36,
        pregunta: "¿Cuál es el nombre del jinete sin cabeza que aterroriza la aldea en el relato de Washington Irving?",
        opciones: ["El Jinete de Sleepy Hollow", "El Jinete del Apocalipsis", "El Caballero Verde", "El Verdugo de Salem"],
        correcta: 0,
        explicacion: "En 'La leyenda de Sleepy Hollow' (1820), el jinete sin cabeza persigue a Ichabod Crane arrojándole una calabaza ardiente."
    },
    {
        id: 37,
        pregunta: "¿Qué entidad cósmica con forma de payaso habita las cloacas alimentándose del miedo en 'It'?",
        opciones: ["Bob Gray / Pennywise", "Art el Payaso", "El Guasón", "Twisty"],
        correcta: 0,
        explicacion: "La criatura toma con frecuencia la forma de Pennywise el payaso bailarín para atraer a los niños."
    },
    {
        id: 38,
        pregunta: "¿Qué película de 1999 popularizó masivamente el formato de falso documental ('metraje encontrado' o found footage)?",
        opciones: ["Paranormal Activity", "El proyecto de la bruja de Blair", "Rec", "Cloverfield"],
        correcta: 1,
        explicacion: "'The Blair Witch Project' recaudó más de 240 millones de dólares con un presupuesto minúsculo y una campaña viral revolucionaria."
    },
    {
        id: 39,
        pregunta: "¿Qué criatura mitológica egipcia tiene cuerpo de león y cabeza humana custodiando monumentos sagrados?",
        opciones: ["Anubis", "La Esfinge", "El Grifo", "Ammyt"],
        correcta: 1,
        explicacion: "La Gran Esfinge de Guiza custodiaba las pirámides y en la mitología retaba a los viajeros con acertijos mortales."
    },
    {
        id: 40,
        pregunta: "¿Qué objeto mágico le da vida al muñeco de nieve o al Gólem en las leyendas judías?",
        opciones: ["Una gema encantada", "Una palabra sagrada escrita en la frente (Emet)", "Un elixir de alquimista", "Un conjuro en latín"],
        correcta: 1,
        explicacion: "El rabino Loew de Praga dio vida al Gólem escribiendo 'Emet' (Verdad en hebreo) en su frente de barro."
    },
    {
        id: 41,
        pregunta: "¿Cómo se llama el monstruo con cabeza de toro encerrado en el laberinto de Creta?",
        opciones: ["Centauro", "Minotauro", "Sátiro", "Gorgona"],
        correcta: 1,
        explicacion: "El Minotauro devoraba tributos humanos en el laberinto construido por Dédalo hasta ser vencido por Teseo."
    },
    {
        id: 42,
        pregunta: "¿Qué monstruo de la mitología nórdica es un calamar gigante capaz de arrastrar barcos enteros al abismo?",
        opciones: ["Jörmungandr", "Kraken", "Fenrir", "Níðhöggr"],
        correcta: 1,
        explicacion: "El Kraken acechaba las costas de Noruega e Islandia destruyendo cualquier navío a su paso."
    },
    {
        id: 43,
        pregunta: "¿Qué personaje ficticio creado por Bram Stoker es el archienemigo cazador de vampiros del Conde Drácula?",
        opciones: ["Solomon Kane", "Abraham Van Helsing", "John Constantine", "Gabriel Belmont"],
        correcta: 1,
        explicacion: "El profesor Abraham Van Helsing es el sabio y médico holandés que lidera la cacería contra Drácula."
    },
    {
        id: 44,
        pregunta: "¿En qué festividad anglosajona los niños solían pedir 'a soul cake' (un pastel de alma) para los difuntos?",
        opciones: ["All Souls' Day (Día de los Fieles Difuntos)", "Noche de San Juan", "Epifanía", "Pascua"],
        correcta: 0,
        explicacion: "El 'souling' consistía en rezar por las almas del purgatorio a cambio de pasteles de alma, precursor del truco o trato."
    },
    {
        id: 45,
        pregunta: "¿Qué demonio bíblico es conocido como 'El Señor de las Moscas'?",
        opciones: ["Belcebú", "Lucifer", "Mammon", "Leviatán"],
        correcta: 0,
        explicacion: "Belcebú (del hebreo Ba'al Zvuv) se traduce literalmente como el Señor de las Moscas."
    }
];

module.exports = { PREGUNTAS_TRIVIA };

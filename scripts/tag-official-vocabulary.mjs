import { readFile, writeFile } from "node:fs/promises";

const vocabularyUrl = new URL("../assets/vocabulary-official-v1.json", import.meta.url);
const metadataUrl = new URL("../assets/vocabulary-official-v1.meta.json", import.meta.url);
const vocabulary = JSON.parse(await readFile(vocabularyUrl, "utf8"));
const metadata = JSON.parse(await readFile(metadataUrl, "utf8"));

function normalized(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

function isBareWord(value) {
  return /^[a-záéíóúüñ]+$/i.test(value);
}

function isVerbo(entry) {
  return entry.partOfSpeech === "verb"
    && isBareWord(entry.spanish)
    && /(ar|er|ir)$/i.test(normalized(entry.spanish));
}

function isVerboFalso(entry) {
  return entry.partOfSpeech === "noun"
    && isBareWord(entry.lemma)
    && entry.lemma.length > 3
    && /(ar|er|ir)$/i.test(normalized(entry.lemma));
}

const rules = [
  ["place:geography", /argentina|bogota|buenos aires|colombia|costa rica|cuba|ecuador|espana|estados unidos|lima|madrid|mexico|panama|peru|puerto rico|republica dominicana|san jose|san juan|san salvador|santo domingo|venezuela|washington|flag|bandera/],
  ["communication:greeting", /hello|goodbye|good morning|good afternoon|good evening|good night|see you|pleased to meet|thank|thanks|you.re welcome|pardon|excuse me|greetings|how are you|what.s new|what.s happening|how is it going|sorry|forgive me|hola|adios|hasta|buenos dias|buenas tardes|buenas noches|mucho gusto|de nada|lo siento/],
  ["communication:classroom", /how do you say|what does .* mean|don.t understand|don.t know|question|more slowly|pagina|significa|entiendo|pregunta|por favor/],
  ["communication:media", /telephone|cell phone|e-mail|email|newspaper|magazine|radio|television|video|message|conversation|photograph|photo|correo electronico|periodico|revista|celular/],
  ["education:supplies", /notebook|eraser|calculator|desk|pencil|book|backpack|blackboard|pen|chalk|paper|wastebasket|dictionary|cuaderno|borrador|calculadora|lapiz|mochila|pizarra|pluma|tiza/],
  ["education:subject", /art|science|geography|history|math|mathematics|biology|business administration|computer science|accounting|economics|physics|humanities|foreign language|literature|journalism|psychology|chemistry|sociology|environmental science|bellas artes/],
  ["education:school", /student|teacher|school|high school|class|lesson|test|exam|schedule|homework|subject|university|college|course|semester|trimester|major|faculty|laboratory|library|classmate|dormitory|study|learn|teach|explain|practice|estudiante|profesor|escuela|instituto|clase|universidad/],
  ["people:family", /grandfather|grandmother|grandparent|father|mother|cousin|family|brother|sister|husband|wife|spouse|twin|stepmother|stepfather|son|daughter|children|grandson|granddaughter|boyfriend|girlfriend|daughter-in-law|parent|relative|nephew|niece|father-in-law|mother-in-law|uncle|aunt|son-in-law|familia|padre|madre|hermano|hijo|abuelo|pariente/],
  ["people:profession", /teacher|driver|artist|doctor|physician|engineer|journalist|programmer|player|travel agent|bellhop|employee|customs inspector|salesperson|clerk|waiter|waitress|owner|messenger|profesor|conductor|empleado|camarero|vendedor/],
  ["people:nationality", /nationality|argentine|canadian|chinese|costa rican|cuban|ecuadorian|spanish|from the u\.s\.|french|german|english|italian|japanese|mexican|north american|puerto rican|russian|caribbean|jewish|islamic/],
  ["people:identity", /girl|boy|man|woman|young person|person|people|name|last name|age|marital status|chica|chico|hombre|mujer|persona|gente|nombre|apellido/],
  ["people:relationship", /friend|neighbor|couple|partner|friendship|love|married|divorced|single|widow|widower|wedding|marriage|date|engaged|break up|invite|guest|together/],
  ["description:color", /\bblue\b|\byellow\b|\bwhite\b|\bblack\b|\bred\b|\bgreen\b|\borange\b|\bgray\b|\bbrown\b|\bpurple\b|\bpink\b|\bcolor\b|azul|amarillo|blanco|negro|rojo|verde|anaranjado|gris|marron|morado|rosado/],
  ["description:physical", /tall|short \(in height\)|thin|slender|fat|good-looking|brunet|red-haired|small|blond|young|old|pretty|ugly|alto|bajo|delgado|gordo|guapo|moreno|pelirrojo|rubio|viejo/],
  ["description:personality", /unpleasant|intelligent|nice|likeable|silly|foolish|hard-working|friendly|funny|crazy|simpatico|antipatico|inteligente|trabajador|tonto|amable|gracioso|loco/],
  ["emotion:feeling", /happy|joyful|embarrassed|confused|content|angry|in love|nervous|worried|sad|bored|boring|tired|good mood|bad mood|happiness|hate|surprise|feel|enojado|feliz|triste|cansado|preocupado|avergonzado|alegria/],
  ["time:calendar", /yesterday|tomorrow|today|day|week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday|what is the date|season|last night|day before yesterday|birthday|anniversary|christmas|holiday|ayer|manana|semana|mes|ano|fecha/],
  ["time:sequence", /now|right now|before|after|afterwards|then|later|finally|ago|last year|last week|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|ahora|antes|despues|luego|ultimo/],
  ["time:frequency", /always|never|once|twice|every|still|yet|already|siempre|nunca|jamas|todavia|cada/],
  ["place:geography", /country|capital city|city|downtown|countryside|community|sea|landscape|beach|mountain|country square|plaza|pais|capital|centro|campo|mar|playa/],
  ["place:building", /church|museum|park|stadium|gymnasium|movie theater|restaurant|cafe|store|market|mall|hotel|hostel|guesthouse|airport|station|iglesia|museo|parque|estadio|gimnasio|restaurante|hotel|mercado/],
  ["home:furniture", /bed|chair|table|door|window|mirror|sink|toilet|shower|bathroom|floor|elevator|key|cama|silla|mesa|puerta|ventana|espejo|lavabo|inodoro/],
  ["home:housing", /house|home|roommate|landlord|landlady|room|double room|single room|rooftop|residence|dormitory|casa|habitacion|azotea/],
  ["body:part", /hand|hair|face|teeth|body|mano|pelo|cara|dientes/],
  ["body:hygiene", /bathe|bath|shave|brush|shampoo|shaving cream|soap|wash|makeup|toothpaste|comb|dry oneself|towel|shower|get dressed|put on|take off|try on|hygiene|afeitar|banar|cepillar|champu|jabon|lavar|maquill|peinar|secar|vestir/],
  ["body:routine", /go to bed|wake up|go to sleep|get up|daily routine|morning|afternoon|evening|night|acostar|despertar|dormir|levantar|rutina/],
  ["body:health", /doctor|physician|choke|heimlich|death|die|health|hospital|medicine|sick|pain|morir|muerte|ahogar/],
  ["leisure:sport", /sport|basketball|baseball|cycling|soccer|football|golf|hockey|ski|swim|swimming|tennis|volleyball|team|player|game|match|ball|gymnasium|pool|scuba|skate|skateboard|surf|climb mountain|ride a bicycle|sunbathe|baloncesto|beisbol|futbol|tenis|voleibol/],
  ["leisure:arts", /art|music|dance|to sing|drawing|draw|movie|film|museum|percussion instrument|listen.*music|arte|musica|bailar|cantar|dibujo|pelicula/],
  ["leisure:activity", /pastime|hobby|free time|camp|fish|take photos|watch movies|video game|play cards|have fun|party|musical chairs|relax|pasatiempo|ratos libres|acampar|pescar|fiesta/],
  ["travel:transport", /bus|driver|passenger|suitcase|map|tourist|rowboat|platform|travel|arrive|return|airport|travel agency|luggage|bus station|train station|subway station|car|plane|boat|motorcycle|taxi|arrival|departure|round-trip|passport|traveler|autobus|maleta|viajar|aeropuerto|equipaje|pasaporte/],
  ["travel:lodging", /reservation|bellhop|double room|single room|hostel|hotel|guesthouse|guest|vacation|reservacion|hostal|hotel|huesped|vacaciones/],
  ["shopping:clothing", /coat|blouse|purse|bag|boot|sock|shirt|t-shirt|jacket|belt|tie|skirt|glasses|gloves|raincoat|jeans|stockings|pants|shorts|shoes|dressing room|clothing|underwear|sandals|hat|sweater|size \(in clothes\)|suit|bathing suit|dress|sneakers|scarf|slippers|abrigo|blusa|bota|camisa|chaqueta|cinturon|corbata|falda|guantes|pantalones|ropa|sandalias|sombrero|sueter|vestido/],
  ["shopping:money", /cheap|expensive|cash register|exchange|cost|discount|money|cash|bargain|spend|pay|price|lend|sale|credit card|rich|poor|barato|caro|costar|descuento|dinero|ganga|gastar|pagar|precio|rebaja/],
  ["shopping:store", /department store|shopping mall|customer|clerk|market|stall|shop|store|salesperson|buy|sell|almacen|centro comercial|cliente|dependiente|mercado|tienda|vendedor|comprar|vender/],
  ["food:fruit", /banana|fruit|lemon|apple|orange|peach|pear|grape|banana|fruta|limon|manzana|naranja|melocoton|pera|uva/],
  ["food:vegetable", /olive|garlic|pea|onion|mushroom|asparagus|bean|lettuce|corn|potato|tomato|carrot|vegetable|aceituna|ajo|arveja|cebolla|champinon|esparrago|frijol|lechuga|maiz|patata|tomate|zanahoria|verdura/],
  ["food:meat-seafood", /tuna|steak|anchovy|calamari|shrimp|meat|beef|pork|lobster|shellfish|turkey|fish|chicken|sausage|salmon|atun|bistec|calamar|camaron|carne|langosta|marisco|pavo|pescado|pollo|salchicha|salmon/],
  ["food:drink", /water|drink|coffee|beer|juice|milk|soft drink|soda|tea|wine|champagne|agua|bebida|cafe|cerveza|jugo|leche|refresco|vino|champan/],
  ["food:meal", /breakfast|lunch|dinner|meal|snack|desayuno|almuerzo|cena|comida|merendar/],
  ["food:restaurant", /waiter|waitress|restaurant|menu|serve|order \(food\)|appetizer|smoking section|camarero|restaurante|menu|servir|entremeses|pedido/],
  ["food:ingredient", /oil|rice|sugar|cereal|egg|butter|margarine|mayonnaise|pepper|cheese|salt|vinegar|yogurt|aceite|arroz|azucar|cereal|huevo|mantequilla|mayonesa|pimienta|queso|sal|vinagre|yogur/],
  ["food:dish", /aioli|salad|croquette|gazpacho|hamburger|bread|dish|soup|omelet|sandwich|cake|pie|custard|ice cream|cookie|candy|sweets|alioli|ensalada|croqueta|gazpacho|hamburguesa|pan|plato|sopa|tortilla|sandwich|pastel|flan|helado|galleta|dulces/],
  ["nature:environment", /climate change|wind energy|pond|landscape|countryside|sea|beach|mountain|star|environment|cambio climatico|energia eolica|estanque|paisaje|campo|mar|playa|montana|estrella/],
  ["nature:animal", /horse|spider|animal|caballo|arana/],
  ["technology:computing", /computer|computer science|computer programmer|internet|website|program|video game|computadora|computacion|programador|videojuego/],
  ["work:workplace", /work|employee|business|administration|accounting|office|customer|salesperson|trabajar|empleado|empresa|cliente|vendedor/],
  ["life:event", /adolescence|anniversary|wedding|birthday|holiday|stages of life|youth|maturity|death|birth|childhood|old age|retire|graduate|celebrate|adolescencia|aniversario|boda|cumpleanos|juventud|madurez|muerte|nacimiento|ninez|vejez|jubilar|graduar|celebrar/],
  ["space:location", /right of|left of|next to|over there|\bthere\b|\bhere\b|near|in front of|behind|on top of|between|among|far from|below|under|in; on|on; over|derecha|izquierda|al lado|alla|alli|aqui|cerca|delante|detras|encima|entre|lejos|debajo/],
  ["action:movement", /to walk|to run|to arrive|to return|to come|to go|to leave|to follow|to continue|to carry|to bring|to drive|to stay|to remain|to sit down|caminar|correr|llegar|regresar|volver|venir|salir|seguir|llevar|traer|conducir|quedar|sentar/],
  ["action:cognition", /to understand|to believe|to decide|to find|to think|to remember|to suppose|to know|to prefer|to want|to seem|comprender|creer|decidir|encontrar|entender|pensar|recordar|suponer|saber|preferir|querer|parecer/],
  ["action:communication", /to say|to tell|to write|to read|to show|to hear|to repeat|to translate|to send|to receive|to call|decir|contar|escribir|leer|mostrar|oir|repetir|traducir|enviar|recibir|llamar/],
  ["description:quality", /good|bad|difficult|easy|important|interesting|fun|best|favorite|full|closed|open|wrong|clean|dirty|safe|sure|short \(in length\)|long|elegant|beautiful|new|custom-made|orderly|disorderly|same|next|bueno|malo|dificil|facil|importante|interesante|divertido|mejor|favorito|lleno|cerrado|abierto|equivocado|limpio|sucio|seguro|corto|largo|elegante|hermoso|nuevo|medida|ordenado|igual|proximo/],
  ["number:comparison", /more than|fewer than|less than|as much|as many|better|worse|best|worst|mas de|menos de|tanto|tantos|mejor|peor/],
  ["food:quality", /sweet|delicious|tasty|taste \(like\)|to taste|dulce|delicioso|sabroso|saber a|probar/],
  ["people:relationship", /kiss|divorce|separated|get along|laugh|smile|beso|divorcio|separado|llevarse bien|reir|sonreir/],
  ["people:identity", /\bmr\b|\bmrs\b|\bsir\b|ma.am|senor|senora|senorita|child|nino/],
  ["time:calendar", /clock|watch|reloj|alarm|alarm clock|alarma|despertador/],
  ["food:dish", /shish kebab|brocheta|dessert|postre/],
  ["food:meat-seafood", /ham|jamon/],
  ["leisure:sport", /push-ups|fan|flexiones|aficionado/],
  ["language:vocabulary", /word|palabra|number|numero/],
  ["body:routine", /to rest|descansar/],
  ["body:perception", /to look|to watch|to see|mirar|ver/],
  ["travel:activity", /take a trip|hacer un viaje|visit monuments|visitar monumentos/],
  ["place:infrastructure", /bridge|puente/],
  ["emotion:feeling", /to worry|preocuparse|to bore|aburrir|to miss|extranar/],
  ["nature:plant", /flower|flores/],
  ["life:event", /to be born|nacer/],
  ["shopping:gift", /gift|regalo|regalar/],
  ["number:comparison", /mas.*que|menos.*que|tan.*como/],
];

// These are deliberately raw stems: unlike short English fragments such as "art" or "sing",
// they are distinctive enough to usefully catch Spanish inflectional and reflexive variants.
const stemRules = [
  ["education:school", /estudi|aprend|ensen|explic/],
  ["body:hygiene", /afeit|cepill|duch|lavars|maquill|pein|secars|vestirs/],
  ["body:routine", /acost|despert|dormirs|levant/],
  ["emotion:feeling", /avergonz|confund|enamor|enoj|preocup/],
  ["people:relationship", /casars|divorci|separars|sonreir|reirs/],
  ["travel:transport", /viaj/],
  ["travel:lodging", /reserv|vacacion/],
  ["shopping:money", /gast|pag/],
  ["shopping:store", /compr|regate|vend/],
];

const curatedSemanticGroups = [
  ["education:subject", ["las ciencias", "las materias", "las lenguas extranjeras"]],
  ["education:school", ["la cafeteria", "la libreria", "el proyecto"]],
  ["people:family", [
    "los abuelos", "el/la hermanastro/a", "el/la hijastro/a", "los padres",
    "los parientes", "el/la mayor", "el/la menor", "el/la recien casado/a",
  ]],
  ["language:general", ["la cosa", "el problema", "el lugar"]],
  ["communication:media", ["el diario"]],
  ["leisure:sport", ["el casco", "el contragolpe", "el esqui (acuatico)", "escalar montanas", "practicar deportes"]],
  ["leisure:activity", ["la entrada", "el globo"]],
  ["shopping:money", ["la cartera"]],
  ["action:support", ["la ayuda"]],
  ["home:condition", ["el desorden"]],
  ["food:vegetable", ["las aceitunas", "las arvejas", "los frijoles", "las verduras"]],
  ["language:copula", [
    "ella es", "ellas son", "ellos son", "el es", "nosotras somos", "nosotros somos", "tu eres", "usted es",
    "yo soy", "ustedes son", "eras", "ser", "estar", "tener", "deber", "poder", "faltar",
  ]],
  ["action:movement", ["vais", "vamos", "pasear", "tirar"]],
  ["language:discourse", [
    "de todas partes", "porque", "tambien", "de repente", "cuando", "desde hace",
    "por eso", "tampoco", "como", "solo",
  ]],
  ["action:communication", [
    "contestar", "conversar", "hablar", "compartir", "describir", "gritar",
    "recomendar", "preguntar", "llamarse",
  ]],
  ["emotion:preference", [
    "desear", "esperar", "gustar", "necesitar", "fascinar", "molestar",
  ]],
  ["action:process", [
    "preparar", "terminar", "cerrar", "comenzar", "conseguir", "empezar", "hacer",
    "poner", "usar", "escoger", "cambiar de",
  ]],
  ["food:meal", ["tomando", "comer"]],
  ["life:event", ["ganar"]],
  ["travel:activity", ["hacer las maletas"]],
  ["time:sequence", ["acabar de"]],
  ["action:support", ["ayudar", "dar", "ofrecer"]],
  ["people:identity", ["llamarse"]],
  ["emotion:feeling", ["el amor"]],
  ["communication:introduction", ["me llamo..."]],
  ["education:school", ["asistir a", "la campana", "sonar"]],
  ["home:housing", ["vivir"]],
  ["language:possessive", ["mi", "su"]],
];

const phraseSemanticGroups = [
  ["communication:salutation", ["hola.", "buenos dias.", "buenas tardes.", "buenas noches."]],
  ["communication:farewell", [
    "adios.", "chau.", "hasta la vista.", "hasta luego.", "hasta manana.",
    "hasta pronto.", "nos vemos.", "saludos a...",
  ]],
  ["communication:courtesy", [
    "con permiso.", "de nada.", "(muchas) gracias.", "lo siento.", "no hay de que.",
    "perdon.", "disculpa", "por favor.",
  ]],
  ["communication:introduction", [
    "encantado/a.", "el gusto es mio.", "igualmente.", "me llamo...", "mucho gusto.",
    "soy de...", "este/esta es...", "le presento a...", "te presento a...",
  ]],
  ["communication:wellbeing", ["(muy) bien, gracias.", "no muy bien.", "regular."]],
  ["communication:reaction", ["¡que guay!", "vale"]],
  ["language:function", ["conmigo", "contigo"]],
];

const curatedSemanticTags = new Map();
for (const [tag, forms] of curatedSemanticGroups) {
  for (const form of forms) {
    const key = normalized(form);
    const tags = curatedSemanticTags.get(key) ?? [];
    tags.push(tag);
    curatedSemanticTags.set(key, tags);
  }
}

const phraseSemanticTags = new Map(
  phraseSemanticGroups.flatMap(([tag, forms]) => forms.map((form) => [normalized(form), tag])),
);

const categorySemanticTags = new Map([
  ["el cuerpo", "body:part"],
  ["la salud", "body:health"],
  ["verbos", "action:process"],
  ["adverbios", "language:adverb"],
  ["la tecnología", "technology:device"],
  ["la computadora", "technology:computing"],
  ["el carro", "travel:car"],
  ["verbos y adjetivos", "technology:device"],
  ["otras palabras y expresiones", "language:discourse"],
  ["la vivienda", "home:housing"],
  ["los cuartos y otros lugares", "home:room"],
  ["los muebles y otras cosas", "home:furniture"],
  ["los electrodomésticos", "home:appliance"],
  ["la mesa", "food:dining"],
  ["los quehaceres domésticos", "home:chores"],
  ["verbos y expresiones verbales", "communication:influence"],
  ["la naturaleza", "nature:landscape"],
  ["los animales", "nature:animal"],
  ["el medio ambiente", "nature:environment"],
  ["las emociones", "emotion:feeling"],
  ["las dudas y certezas", "action:cognition"],
  ["conjunciones", "language:conjunction"],
  ["el bienestar", "body:wellness"],
  ["en el gimnasio", "leisure:fitness"],
  ["la nutrición", "food:nutrition"],
  ["los medios de comunicación / las noticias", "communication:media"],
  ["la política", "society:politics"],
  ["las profesiones", "people:profession"],
  ["la entrevista", "work:job-search"],
  ["el mundo del trabajo", "work:workplace"],
  ["las bellas artes", "leisure:arts"],
  ["los artistas", "people:artist"],
  ["el cine y la televisión", "communication:entertainment"],
  ["la artesanía", "leisure:crafts"],
  ["en la ciudad", "place:city"],
  ["en el campo", "place:rural"],
  ["cómo llegar", "travel:directions"],
].map(([category, tag]) => [normalized(category), tag]));

const lexicalFamilyGroups = {
  arrival: ["llegar", "llegada"],
  breakfast: ["desayunar", "desayuno"],
  conversation: ["conversar", "conversación"],
  dinner: ["cenar", "cena"],
  divorce: ["divorciarse", "divorcio", "divorciado"],
  drawing: ["dibujar", "dibujo"],
  fun: ["divertirse", "diversión"],
  help: ["ayudar", "ayuda"],
  invitation: ["invitar", "invitado"],
  lunch: ["almorzar", "almuerzo"],
  marriage: ["casarse", "casado", "recién casado"],
  play: ["jugar", "jugador"],
  request: ["pedir", "pedido"],
  sale: ["vender", "vendedor"],
  surprise: ["sorprender", "sorpresa"],
  travel: ["viajar", "viajero"],
  work: ["trabajar", "trabajador"],
  birth: ["nacer", "nacimiento"],
  death: ["morir", "muerte"],
  departure: ["salir", "salida"],
  gift: ["regalar", "regalo"],
  fishing: ["pescar", "pescado"],
  study: ["estudiar", "estudiante"],
  swimming: ["nadar", "natación"],
};

const lexicalFamilyByLemma = new Map(
  Object.entries(lexicalFamilyGroups).flatMap(([family, lemmas]) => (
    lemmas.map((lemma) => [normalized(lemma), family])
  )),
);

function addTag(tags, tag) {
  const [broad] = tag.split(":");
  tags.add(broad);
  tags.add(tag);
}

function matchesRule(pattern, searchable) {
  const boundedPattern = new RegExp(
    `(?:^|\\b)(?:${pattern.source})(?:\\b|$)`,
    pattern.flags,
  );
  return boundedPattern.test(searchable);
}

function removeNarrowTag(tags, tag) {
  tags.delete(tag);
  const [broad] = tag.split(":");
  if (![...tags].some((candidate) => candidate.startsWith(`${broad}:`))) tags.delete(broad);
}

let taggedCount = 0;
let verboCount = 0;
let verboFalsoCount = 0;
let lexicalFamilyEntryCount = 0;

for (const entry of vocabulary) {
  const searchable = normalized([
    entry.spanish,
    entry.english,
    entry.lemma,
    ...(entry.senses ?? []),
  ].join(" "));
  const tags = new Set();

  if (entry.partOfSpeech === "number") addTag(tags, "number:cardinal");
  if (/^\d+$/.test(entry.english)) addTag(tags, "number:cardinal");
  if (entry.partOfSpeech === "proper noun") addTag(tags, "place:geography");
  if (entry.partOfSpeech === "question") addTag(tags, "communication:question");

  for (const [tag, pattern] of rules) {
    if (matchesRule(pattern, searchable)) addTag(tags, tag);
  }
  for (const [tag, pattern] of stemRules) {
    if (pattern.test(searchable)) addTag(tags, tag);
  }
  for (const curatedTag of curatedSemanticTags.get(normalized(entry.spanish)) ?? []) {
    addTag(tags, curatedTag);
  }
  const categoryTag = categorySemanticTags.get(normalized(entry.category));
  if (categoryTag) {
    if (normalized(entry.category) === "verbos" && entry.chapter === 10) {
      addTag(tags, "body:health");
    } else if (normalized(entry.category) === "verbos" && entry.chapter === 13) {
      addTag(tags, "nature:environment");
    } else if (normalized(entry.category) === "verbos") {
      addTag(tags, "action:process");
    } else {
      addTag(tags, categoryTag);
    }
  }
  const phraseSemanticTag = phraseSemanticTags.get(normalized(entry.spanish));
  if (phraseSemanticTag) {
    removeNarrowTag(tags, "communication:greeting");
    removeNarrowTag(tags, "communication:social");
    addTag(tags, phraseSemanticTag);
  }

  if (["el esquí (acuático)", "marrón, café"].includes(entry.spanish)) {
    removeNarrowTag(tags, "food:drink");
  }

  if (tags.size === 0 && entry.partOfSpeech === "phrase") {
    addTag(tags, "communication:social");
  }
  if (tags.size === 0 && ["preposition", "pronoun"].includes(entry.partOfSpeech)) {
    addTag(tags, "language:function");
  }
  if (tags.size === 0 && entry.partOfSpeech === "adjective") {
    addTag(tags, "description:quality");
  }

  entry.semanticTags = [...tags].sort();
  if (entry.semanticTags.length > 0) taggedCount += 1;

  const traits = new Set(entry.distractorTraits ?? []);
  traits.delete("verbo");
  traits.delete("verbo-falso");
  if (isVerbo(entry)) {
    traits.add("verbo");
    verboCount += 1;
  }
  if (isVerboFalso(entry)) {
    traits.add("verbo-falso");
    verboFalsoCount += 1;
  }
  if (traits.size > 0) entry.distractorTraits = [...traits].sort();
  else delete entry.distractorTraits;

  const lexicalFamily = lexicalFamilyByLemma.get(normalized(entry.lemma));
  if (lexicalFamily) {
    entry.lexicalFamily = lexicalFamily;
    lexicalFamilyEntryCount += 1;
  } else {
    delete entry.lexicalFamily;
  }
}

metadata.transformation.semanticTagging = {
  taxonomy: "Cervantes-inspired project taxonomy v1",
  taggedEntryCount: taggedCount,
  untaggedEntryCount: vocabulary.length - taggedCount,
  broadTagCount: new Set(vocabulary.flatMap((entry) => (
    entry.semanticTags.filter((tag) => !tag.includes(":"))
  ))).size,
  narrowTagCount: new Set(vocabulary.flatMap((entry) => (
    entry.semanticTags.filter((tag) => tag.includes(":"))
  ))).size,
};
metadata.transformation.distractorTraits = { verboCount, verboFalsoCount };
metadata.transformation.lexicalFamilies = {
  familyCount: Object.keys(lexicalFamilyGroups).length,
  taggedEntryCount: lexicalFamilyEntryCount,
};

const note =
  "First-pass semantic tags adapt the Instituto Cervantes Nociones específicas organization to this curriculum; tags are project-authored and remain subject to editorial review.";
if (!metadata.notes.includes(note)) metadata.notes.push(note);

await writeFile(vocabularyUrl, `${JSON.stringify(vocabulary, null, 2)}\n`);
await writeFile(metadataUrl, `${JSON.stringify(metadata, null, 2)}\n`);

console.log(
  `Tagged ${taggedCount}/${vocabulary.length} entries; marked ${verboCount} verbos, ${verboFalsoCount} verbos-falsos, and ${lexicalFamilyEntryCount} lexical-family entries.`,
);

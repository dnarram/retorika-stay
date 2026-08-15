import type { Guide, Locale, Place, Property, Stay } from "@/lib/schema";

/* ---------------------------------------------------------------------------
   Demo data. Two properties, to prove the app is multi-property and that
   content is not baked into the code:
     · Ronda  — full guide in all four languages.
     · Madrid — ES/EN written by the host, FR/PT machine-translated.
   Landmarks carry real coordinates; the rest are approximate, and every phone
   number is fictional except the emergency ones (112 and 061).
--------------------------------------------------------------------------- */

export type GuideRecord = {
  propertyId: string;
  locale: Locale;
  reviewed: boolean;
  content: Guide;
};

export const HOSTS = [
  {
    id: "host_belen",
    email: "belen@retorika.es",
    name: "Belén",
    /* scrypt(N=16384,r=8,p=1) of "retorika2026" — see src/lib/auth.ts */
    passwordHash:
      "6707c91ddecc4e4a99eac7cf97a4c401:2dc5c162be5eedc5dbadfcf62c4e7619586ee7050c4b2707f6f4f68a5399c600",
  },
];

export const PROPERTIES: Property[] = [
  {
    id: "prop_ronda",
    hostId: "host_belen",
    slug: "k3f9apx2",
    name: "Casa Puente Nuevo",
    city: "Ronda",
    address: "Calle Tenorio 12, 29400 Ronda, Málaga",
    lat: 36.7418,
    lng: -5.166,
    hostName: "Belén",
    hostPhone: "+34600111222",
    wifiSsid: "CasaPuente_5G",
    wifiPassword: "tajo-2026-ronda",
    wifiSecurity: "WPA",
    accessCode: "4718",
    checkinFrom: "15:00",
    checkoutUntil: "11:00",
    accessCodeUpdatedAt: null,
    contacts: [
      { kind: "emergency", phone: "112" },
      { kind: "health", phone: "+34951065100", detail: "Hospital Comarcal de la Serranía" },
      { kind: "pharmacy", phone: "+34952871234", detail: "Calle Espinel 45" },
      { kind: "taxi", phone: "+34952872316", detail: "Radio Taxi Ronda" },
      { kind: "host", phone: "+34600111222", detail: "WhatsApp 9:00–22:00" },
    ],
    hiddenSections: [],
    visitedSteps: [1, 2, 3, 4, 5, 6, 7],
    theme: { palette: "retorika", font: "moderna", radius: "suave", style: "sereno" },
    defaultLocale: "es",
    published: true,
    pin: null,
  },
  {
    id: "prop_madrid",
    hostId: "host_belen",
    slug: "m7q2ldv5",
    name: "Ático Lavapiés",
    city: "Madrid",
    address: "Calle Argumosa 20, 4.º, 28012 Madrid",
    lat: 40.4079,
    lng: -3.6996,
    hostName: "Belén",
    hostPhone: "+34600111222",
    wifiSsid: "Argumosa20_2G",
    wifiPassword: "lavapies-atico-04",
    wifiSecurity: "WPA",
    accessCode: "9042",
    checkinFrom: "16:00",
    checkoutUntil: "11:00",
    accessCodeUpdatedAt: null,
    contacts: [
      { kind: "emergency", phone: "112" },
      { kind: "health", phone: "061", detail: "Urgencias sanitarias" },
      { kind: "pharmacy", phone: "+34915390123", detail: "Calle Argumosa 5, 24 h" },
      { kind: "police", phone: "092", detail: "Policía Municipal" },
      { kind: "host", phone: "+34600111222", detail: "WhatsApp 9:00–22:00" },
      { kind: "maintenance", phone: "+34910000111", detail: "Portería del edificio" },
    ],
    hiddenSections: [],
    visitedSteps: [1, 2, 3, 4, 5, 6, 7],
    theme: { palette: "retorika", font: "moderna", radius: "suave", style: "sereno" },
    defaultLocale: "es",
    published: true,
    pin: null,
  },
];

const rondaEs: Guide = {
  welcomeTitle: "Bienvenido a Casa Puente Nuevo",
  welcomeIntro:
    "Estás a ochenta metros del Tajo, en el casco antiguo de Ronda. La casa es pequeña y antigua: los suelos crujen y las paredes son de piedra, así que se oye todo. A cambio, desde la ventana del salón se ve el puente iluminado de noche.",
  arrivalSteps: [
    "Entra por Calle Tenorio. El coche no puede pasar del arco: te dejan a 30 metros del portal.",
    "La caja de llaves es la gris, a la izquierda del portal, a la altura de la cintura.",
    "Marca el código, tira de la tapa hacia abajo y saca las dos llaves: la larga es del portal y la corta, del piso.",
    "Sube al primero. Al entrar, el interruptor general está detrás de la puerta, a mano derecha.",
  ],
  parking:
    "El casco antiguo es zona peatonal. El parking más cercano es el subterráneo de la Plaza del Socorro (7 min a pie, 16 €/día) y hay zona azul gratis desde las 20:00 y los domingos en la Alameda.",
  wifiNote:
    "La fibra llega bien al salón y al dormitorio principal. En la cocina la señal cae; si trabajas en remoto, mejor la mesa del salón.",
  house: [
    {
      title: "Agua caliente",
      body: "El termo está en el altillo del baño y tarda unos 20 minutos. Si os ducháis seguidos, dejad diez minutos entre ducha y ducha.",
    },
    {
      title: "Calefacción y aire",
      body: "El aire acondicionado del salón funciona con el mando blanco. En invierno hay dos radiadores eléctricos en el armario del pasillo.",
    },
    {
      title: "Lavadora",
      body: "Programa 3 (rápido, 30 minutos) para el uso diario. El detergente está bajo el fregadero. No la pongas después de las 22:00: el vecino de abajo trabaja de noche.",
    },
    {
      title: "Basura",
      body: "Los contenedores están al final de Calle Tenorio, junto al mirador. Orgánico en el marrón, envases en el amarillo. En Ronda se recoge de 21:00 a 23:00.",
    },
  ],
  rules: [
    { text: "Silencio de 23:00 a 8:00: las paredes son de piedra pero el patio es un altavoz.", allowed: null },
    { text: "No se puede fumar dentro. En la ventana del salón, sí.", allowed: false },
    { text: "No se pueden celebrar fiestas ni recibir visitas que no estén en la reserva.", allowed: false },
    { text: "Mascotas bienvenidas si nos lo dices antes.", allowed: true },
    { text: "Se puede usar la cocina entera, incluidos aceite, sal y café.", allowed: true },
  ],
  transport: [
    {
      title: "Desde Málaga",
      body: "Autobús directo de Avanza (1 h 50 min, 12 €) desde la estación María Zambrano. En coche, la A-397 tiene curvas: calcula dos horas si te mareas.",
    },
    {
      title: "Tren",
      body: "La estación está a 12 minutos a pie cuesta arriba. Con maletas, taxi: son 6 € y tres minutos.",
    },
    {
      title: "A pie",
      body: "Todo el casco histórico está a menos de 15 minutos. Lleva calzado con suela: el empedrado resbala cuando llueve.",
    },
  ],
  emergencyNote:
    "El hospital comarcal está a 10 minutos en coche. Para algo leve, el centro de salud de la Avenida de Málaga atiende sin cita hasta las 20:00.",
  checkoutSteps: [
    "Deja las llaves dentro de la caja y gira la rueda para bloquearla.",
    "Saca la basura al contenedor del final de la calle.",
    "Cierra las ventanas y apaga el aire: el interruptor general está detrás de la puerta.",
    "Los platos, en el lavavajillas. No hace falta que lo pongas.",
  ],
  faqs: [
    {
      q: "¿Se puede beber el agua del grifo?",
      a: "Sí, el agua de Ronda viene de la sierra y es de las mejores de la provincia.",
    },
    {
      q: "¿Dónde compro a última hora?",
      a: "El supermercado de la Calle Espinel cierra a las 21:30 y el domingo abre solo por la mañana.",
    },
    {
      q: "¿Hay ascensor?",
      a: "No. Es un primero alto, con 22 escalones y un rellano intermedio.",
    },
  ],
};

const rondaEn: Guide = {
  welcomeTitle: "Welcome to Casa Puente Nuevo",
  welcomeIntro:
    "You are eighty metres from the gorge, in Ronda's old town. The house is small and old: the floors creak and the walls are stone, so sound travels. In exchange, the living room window looks straight at the bridge, lit up at night.",
  arrivalSteps: [
    "Come in from Calle Tenorio. Cars can't pass the arch, so you'll be dropped 30 metres from the door.",
    "The key box is the grey one, on the left of the entrance, at waist height.",
    "Enter the code, pull the cover down and take both keys: the long one opens the street door, the short one the flat.",
    "Go up one floor. Once inside, the main switch is behind the door on your right.",
  ],
  parking:
    "The old town is pedestrian. The nearest car park is under Plaza del Socorro (7 min walk, €16/day). Blue-zone street parking is free after 20:00 and on Sundays.",
  wifiNote:
    "Fibre reaches the living room and main bedroom well. Signal drops in the kitchen: if you're working remotely, use the living room table.",
  house: [
    {
      title: "Hot water",
      body: "The tank is in the bathroom loft and takes about 20 minutes to heat. If you shower one after another, leave ten minutes in between.",
    },
    {
      title: "Heating and air conditioning",
      body: "The living room unit runs off the white remote. In winter there are two electric radiators in the hallway cupboard.",
    },
    {
      title: "Washing machine",
      body: "Programme 3 (quick, 30 min) is fine for everyday loads. Detergent is under the sink. Don't run it after 22:00: the neighbour below works nights.",
    },
    {
      title: "Rubbish",
      body: "Bins are at the end of Calle Tenorio, by the viewpoint. Food waste in brown, packaging in yellow. Collection in Ronda is between 21:00 and 23:00.",
    },
  ],
  rules: [
    { text: "Quiet hours from 23:00 to 8:00: the walls are stone but the courtyard carries sound.", allowed: null },
    { text: "No smoking indoors. At the living room window, fine.", allowed: false },
    { text: "No parties and no visitors who aren't on the booking.", allowed: false },
    { text: "Pets welcome if you tell us in advance.", allowed: true },
    { text: "The whole kitchen is yours, oil, salt and coffee included.", allowed: true },
  ],
  transport: [
    {
      title: "From Málaga",
      body: "Direct Avanza coach (1 h 50 min, €12) from María Zambrano station. By car the A-397 is winding: allow two hours if you get carsick.",
    },
    {
      title: "Train",
      body: "The station is a 12-minute uphill walk. With luggage, take a taxi: €6 and three minutes.",
    },
    {
      title: "On foot",
      body: "The whole historic centre is within 15 minutes. Wear grippy shoes: the cobbles get slippery in the rain.",
    },
  ],
  emergencyNote:
    "The regional hospital is 10 minutes away by car. For something minor, the health centre on Avenida de Málaga takes walk-ins until 20:00.",
  checkoutSteps: [
    "Leave the keys in the key box and spin the dial to lock it.",
    "Take the rubbish to the bins at the end of the street.",
    "Close the windows and switch off the air conditioning at the main switch behind the door.",
    "Dishes in the dishwasher. No need to run it.",
  ],
  faqs: [
    { q: "Can I drink the tap water?", a: "Yes. Ronda's water comes from the sierra and is among the best in the province." },
    {
      q: "Where can I shop late?",
      a: "The supermarket on Calle Espinel closes at 21:30 and only opens on Sunday mornings.",
    },
    { q: "Is there a lift?", a: "No. It's a high first floor: 22 steps with a landing halfway." },
  ],
};

const rondaFr: Guide = {
  welcomeTitle: "Bienvenue à Casa Puente Nuevo",
  welcomeIntro:
    "Vous êtes à quatre-vingts mètres des gorges, dans la vieille ville de Ronda. La maison est petite et ancienne : le parquet craque et les murs sont en pierre, donc tout s'entend. En échange, la fenêtre du salon donne sur le pont, illuminé la nuit.",
  arrivalSteps: [
    "Entrez par la Calle Tenorio. Les voitures ne passent pas l'arche : on vous dépose à 30 mètres de la porte.",
    "La boîte à clés est la grise, à gauche de l'entrée, à hauteur de hanche.",
    "Composez le code, tirez le couvercle vers le bas et prenez les deux clés : la longue pour la porte de la rue, la courte pour l'appartement.",
    "Montez au premier. Une fois à l'intérieur, l'interrupteur général est derrière la porte, à droite.",
  ],
  parking:
    "La vieille ville est piétonne. Le parking le plus proche est celui de la Plaza del Socorro (7 min à pied, 16 €/jour). La zone bleue est gratuite après 20 h et le dimanche.",
  wifiNote:
    "La fibre couvre bien le salon et la chambre principale. Le signal faiblit dans la cuisine : pour télétravailler, installez-vous à la table du salon.",
  house: [
    {
      title: "Eau chaude",
      body: "Le chauffe-eau est dans la soupente de la salle de bains et met environ 20 minutes. Si vous vous douchez à la suite, laissez dix minutes entre deux.",
    },
    {
      title: "Chauffage et climatisation",
      body: "La clim du salon fonctionne avec la télécommande blanche. En hiver, deux radiateurs électriques sont dans le placard du couloir.",
    },
    {
      title: "Lave-linge",
      body: "Programme 3 (rapide, 30 min) pour le quotidien. La lessive est sous l'évier. Pas de machine après 22 h : le voisin du dessous travaille de nuit.",
    },
    {
      title: "Poubelles",
      body: "Les conteneurs sont au bout de la Calle Tenorio, près du belvédère. Organique en marron, emballages en jaune. La collecte se fait entre 21 h et 23 h.",
    },
  ],
  rules: [
    { text: "Silence de 23 h à 8 h : les murs sont en pierre mais la cour résonne.", allowed: null },
    { text: "Interdit de fumer à l'intérieur. À la fenêtre du salon, c'est possible.", allowed: false },
    { text: "Ni fêtes ni visiteurs qui ne figurent pas sur la réservation.", allowed: false },
    { text: "Animaux acceptés si vous nous prévenez avant.", allowed: true },
    { text: "Toute la cuisine est à vous, huile, sel et café compris.", allowed: true },
  ],
  transport: [
    {
      title: "Depuis Málaga",
      body: "Car direct Avanza (1 h 50, 12 €) depuis la gare María Zambrano. En voiture, l'A-397 est sinueuse : comptez deux heures si vous avez le mal des transports.",
    },
    {
      title: "Train",
      body: "La gare est à 12 minutes à pied, en montée. Avec des valises, prenez un taxi : 6 € et trois minutes.",
    },
    {
      title: "À pied",
      body: "Tout le centre historique est à moins de 15 minutes. Prévoyez des semelles adhérentes : les pavés glissent sous la pluie.",
    },
  ],
  emergencyNote:
    "L'hôpital est à 10 minutes en voiture. Pour un problème léger, le centre de santé de l'Avenida de Málaga reçoit sans rendez-vous jusqu'à 20 h.",
  checkoutSteps: [
    "Laissez les clés dans la boîte et tournez la molette pour la verrouiller.",
    "Sortez les poubelles jusqu'aux conteneurs au bout de la rue.",
    "Fermez les fenêtres et coupez la clim avec l'interrupteur général, derrière la porte.",
    "La vaisselle dans le lave-vaisselle. Inutile de le lancer.",
  ],
  faqs: [
    { q: "Peut-on boire l'eau du robinet ?", a: "Oui. L'eau de Ronda vient de la sierra et compte parmi les meilleures de la province." },
    {
      q: "Où faire les courses tard ?",
      a: "Le supermarché de la Calle Espinel ferme à 21 h 30 et n'ouvre que le dimanche matin.",
    },
    { q: "Y a-t-il un ascenseur ?", a: "Non. C'est un premier étage haut : 22 marches avec un palier au milieu." },
  ],
};

const rondaPt: Guide = {
  welcomeTitle: "Bem-vindo à Casa Puente Nuevo",
  welcomeIntro:
    "Está a oitenta metros da garganta do Tajo, no centro histórico de Ronda. A casa é pequena e antiga: o soalho range e as paredes são de pedra, por isso ouve-se tudo. Em troca, da janela da sala vê-se a ponte iluminada à noite.",
  arrivalSteps: [
    "Entre pela Calle Tenorio. Os carros não passam o arco: deixam-no a 30 metros da porta.",
    "A caixa das chaves é a cinzenta, à esquerda da entrada, à altura da cintura.",
    "Marque o código, puxe a tampa para baixo e retire as duas chaves: a comprida abre o portão, a curta o apartamento.",
    "Suba ao primeiro andar. Lá dentro, o quadro geral fica atrás da porta, à direita.",
  ],
  parking:
    "O centro histórico é pedonal. O parque mais próximo é o da Plaza del Socorro (7 min a pé, 16 €/dia). A zona azul é gratuita depois das 20:00 e ao domingo.",
  wifiNote:
    "A fibra chega bem à sala e ao quarto principal. Na cozinha o sinal cai: para teletrabalho, use a mesa da sala.",
  house: [
    {
      title: "Água quente",
      body: "O termoacumulador está no sótão da casa de banho e demora cerca de 20 minutos. Se tomarem banho seguidos, deixem dez minutos de intervalo.",
    },
    {
      title: "Aquecimento e ar condicionado",
      body: "O ar da sala funciona com o comando branco. No inverno há dois radiadores elétricos no armário do corredor.",
    },
    {
      title: "Máquina de lavar",
      body: "Programa 3 (rápido, 30 min) para o dia a dia. O detergente está debaixo do lava-loiça. Não a ligue depois das 22:00: o vizinho de baixo trabalha à noite.",
    },
    {
      title: "Lixo",
      body: "Os contentores estão no fim da Calle Tenorio, junto ao miradouro. Orgânico no castanho, embalagens no amarelo. A recolha é das 21:00 às 23:00.",
    },
  ],
  rules: [
    { text: "Silêncio das 23:00 às 8:00: as paredes são de pedra, mas o pátio amplifica tudo.", allowed: null },
    { text: "Não se fuma dentro de casa. À janela da sala, sim.", allowed: false },
    { text: "Não são permitidas festas nem visitas fora da reserva.", allowed: false },
    { text: "Animais bem-vindos, avisando com antecedência.", allowed: true },
    { text: "A cozinha é toda vossa, incluindo azeite, sal e café.", allowed: true },
  ],
  transport: [
    {
      title: "Desde Málaga",
      body: "Autocarro direto da Avanza (1 h 50, 12 €) a partir da estação María Zambrano. De carro, a A-397 tem muitas curvas: conte duas horas se enjoar.",
    },
    {
      title: "Comboio",
      body: "A estação fica a 12 minutos a pé, a subir. Com malas, apanhe um táxi: 6 € e três minutos.",
    },
    {
      title: "A pé",
      body: "Todo o centro histórico fica a menos de 15 minutos. Use calçado com sola: a calçada escorrega com chuva.",
    },
  ],
  emergencyNote:
    "O hospital fica a 10 minutos de carro. Para algo ligeiro, o centro de saúde da Avenida de Málaga atende sem marcação até às 20:00.",
  checkoutSteps: [
    "Deixe as chaves dentro da caixa e rode a roda para a trancar.",
    "Leve o lixo até aos contentores no fim da rua.",
    "Feche as janelas e desligue o ar no quadro geral, atrás da porta.",
    "A loiça na máquina. Não precisa de a ligar.",
  ],
  faqs: [
    { q: "Pode beber-se a água da torneira?", a: "Sim. A água de Ronda vem da serra e é das melhores da província." },
    {
      q: "Onde comprar à última hora?",
      a: "O supermercado da Calle Espinel fecha às 21:30 e ao domingo abre só de manhã.",
    },
    { q: "Há elevador?", a: "Não. É um primeiro andar alto: 22 degraus com um patamar a meio." },
  ],
};

const madridEs: Guide = {
  welcomeTitle: "Bienvenido al Ático Lavapiés",
  welcomeIntro:
    "Cuarto piso con ascensor pequeño y una terraza de seis metros con vistas a los tejados de Lavapiés. El barrio es ruidoso y vivo: si te molesta el ruido, el dormitorio interior es el silencioso.",
  arrivalSteps: [
    "Portal azul en el número 20. El telefonillo no funciona: usa el código de la puerta.",
    "Ascensor a la derecha del portal, cabe una maleta grande o dos personas.",
    "Cuarto piso, puerta izquierda. La cerradura va dura: gira la llave dos vueltas y empuja.",
  ],
  parking:
    "Todo el barrio es SER (zona de aparcamiento regulado) y no compensa. El parking de la Plaza de Lavapiés está a 4 minutos y cuesta unos 24 €/día.",
  wifiNote: "Router en el recibidor. Si se cae, se reinicia solo en dos minutos desenchufándolo.",
  house: [
    {
      title: "Terraza",
      body: "Se puede usar hasta las 23:00. Las sillas se guardan plegadas junto a la puerta cuando hay viento.",
    },
    {
      title: "Vitrocerámica",
      body: "Es de inducción: solo funciona con las sartenes que están en el cajón de abajo.",
    },
    {
      title: "Aire acondicionado",
      body: "Solo en el salón. En agosto, baja la persiana antes de mediodía y el piso aguanta fresco hasta la noche.",
    },
    {
      title: "Basura",
      body: "Contenedores en la esquina con Calle Tribulete. El vidrio, en el iglú verde de la plaza.",
    },
  ],
  rules: [
    { text: "Silencio de 22:00 a 8:00, también en la terraza.", allowed: null },
    { text: "No se puede fumar dentro; en la terraza, sí, con cenicero.", allowed: false },
    { text: "No se admiten fiestas: el edificio tiene portera y avisa.", allowed: false },
    { text: "Se puede dejar el equipaje después del check-out avisando antes.", allowed: true },
  ],
  transport: [
    {
      title: "Desde Barajas",
      body: "Metro línea 8 hasta Nuevos Ministerios y transbordo a la 6 y luego la 3 hasta Lavapiés: 50 minutos y 5 €. En taxi, tarifa fija de 33 €.",
    },
    {
      title: "Metro",
      body: "Lavapiés (L3) a 3 minutos y Antón Martín (L1) a 7. La app oficial de Metro de Madrid funciona sin conexión.",
    },
    {
      title: "Bici",
      body: "Estación de BiciMAD en la Plaza de Lavapiés. Ojo: Madrid tiene cuestas y el barrio es de las zonas más empinadas.",
    },
  ],
  emergencyNote:
    "El Hospital Gregorio Marañón está a 10 minutos en taxi. La farmacia de Argumosa 5 abre 24 horas.",
  checkoutSteps: [
    "Deja las llaves encima de la mesa del recibidor y cierra dando un portazo suave.",
    "Saca la basura al contenedor de la esquina.",
    "Recoge las sillas de la terraza y cierra la puerta corredera con el pestillo de abajo.",
  ],
  faqs: [
    { q: "¿Hay ascensor?", a: "Sí, pero es pequeño: una maleta grande o dos personas, no las dos cosas." },
    { q: "¿Es seguro el barrio de noche?", a: "Sí, es una zona muy transitada. Como en todo el centro, cuidado con el bolso en las terrazas llenas." },
    { q: "¿Se puede hacer check-in tarde?", a: "Sí, el código de la puerta funciona a cualquier hora. Avísame si llegas después de medianoche." },
  ],
};

const madridEn: Guide = {
  welcomeTitle: "Welcome to Ático Lavapiés",
  welcomeIntro:
    "Fourth floor with a small lift and a six-metre terrace over the rooftops of Lavapiés. The neighbourhood is loud and alive: if noise bothers you, the inner bedroom is the quiet one.",
  arrivalSteps: [
    "Blue door at number 20. The intercom doesn't work, use the door code instead.",
    "Lift on the right of the entrance: one large suitcase or two people.",
    "Fourth floor, left-hand door. The lock is stiff: turn the key twice and push.",
  ],
  parking:
    "The whole area is regulated parking and isn't worth it. The car park on Plaza de Lavapiés is 4 minutes away at about €24/day.",
  wifiNote: "Router is in the hallway. If it drops, unplug it and it comes back in two minutes.",
  house: [
    { title: "Terrace", body: "Open until 23:00. Fold the chairs away by the door when it's windy." },
    { title: "Hob", body: "Induction only: it works with the pans in the bottom drawer, not with your own." },
    {
      title: "Air conditioning",
      body: "Living room only. In August, lower the blind before noon and the flat stays cool until evening.",
    },
    { title: "Rubbish", body: "Bins on the corner with Calle Tribulete. Glass goes in the green igloo on the square." },
  ],
  rules: [
    { text: "Quiet hours 22:00 to 8:00, terrace included.", allowed: null },
    { text: "No smoking indoors; on the terrace, yes, with an ashtray.", allowed: false },
    { text: "No parties: the building has a concierge and she will report it.", allowed: false },
    { text: "Luggage drop after check-out is fine if you ask in advance.", allowed: true },
  ],
  transport: [
    {
      title: "From Barajas airport",
      body: "Metro line 8 to Nuevos Ministerios, then line 6 and line 3 to Lavapiés: 50 minutes, €5. Taxis charge a €33 flat fare.",
    },
    {
      title: "Metro",
      body: "Lavapiés (L3) is 3 minutes away, Antón Martín (L1) 7. The official Metro de Madrid app works offline.",
    },
    { title: "Bike", body: "BiciMAD dock on Plaza de Lavapiés. Be warned: this is one of the steepest parts of central Madrid." },
  ],
  emergencyNote: "Gregorio Marañón hospital is 10 minutes by taxi. The pharmacy at Argumosa 5 is open 24 hours.",
  checkoutSteps: [
    "Leave the keys on the hallway table and pull the door shut gently.",
    "Take the rubbish to the bins on the corner.",
    "Fold the terrace chairs and lock the sliding door with the bottom latch.",
  ],
  faqs: [
    { q: "Is there a lift?", a: "Yes, but it's small: one large suitcase or two people, not both." },
    { q: "Is the area safe at night?", a: "Yes, it's busy at all hours. As anywhere central, keep an eye on your bag on crowded terraces." },
    { q: "Can I check in late?", a: "Yes, the door code works at any hour. Just tell me if you're arriving after midnight." },
  ],
};

/* FR and PT for the Madrid flat: produced by the assistant, not written by the
   host. The guide tells the guest they are machine translations. This is what a
   partially translated guide really looks like, so it belongs in the demo. */
const madridFr: Guide = {
  ...madridEs,
  welcomeTitle: "Bienvenue à l'Ático Lavapiés",
  welcomeIntro:
    "Quatrième étage avec un petit ascenseur et une terrasse de six mètres sur les toits de Lavapiés. Le quartier est bruyant et vivant : si le bruit vous dérange, la chambre côté cour est la plus calme.",
  arrivalSteps: [
    "Porte bleue au numéro 20. L'interphone ne marche pas : utilisez le code.",
    "Ascenseur à droite de l'entrée : une grande valise ou deux personnes.",
    "Quatrième étage, porte de gauche. La serrure est dure : deux tours de clé et poussez.",
  ],
  parking: "Tout le quartier est en stationnement réglementé. Le parking de la Plaza de Lavapiés est à 4 minutes, environ 24 €/jour.",
  wifiNote: "Le routeur est dans l'entrée. S'il coupe, débranchez-le : il repart en deux minutes.",
};

const madridPt: Guide = {
  ...madridEs,
  welcomeTitle: "Bem-vindo ao Ático Lavapiés",
  welcomeIntro:
    "Quarto andar com elevador pequeno e um terraço de seis metros sobre os telhados de Lavapiés. O bairro é barulhento e vivo: se o ruído o incomoda, o quarto interior é o silencioso.",
  arrivalSteps: [
    "Porta azul no número 20. O intercomunicador não funciona: use o código.",
    "Elevador à direita da entrada: uma mala grande ou duas pessoas.",
    "Quarto andar, porta da esquerda. A fechadura é dura: duas voltas na chave e empurre.",
  ],
  parking: "Todo o bairro é estacionamento pago. O parque da Plaza de Lavapiés fica a 4 minutos, cerca de 24 €/dia.",
  wifiNote: "O router está na entrada. Se falhar, desligue-o da corrente: recupera em dois minutos.",
};

export const GUIDES: GuideRecord[] = [
  { propertyId: "prop_ronda", locale: "es", reviewed: true, content: rondaEs },
  { propertyId: "prop_ronda", locale: "en", reviewed: true, content: rondaEn },
  { propertyId: "prop_ronda", locale: "fr", reviewed: true, content: rondaFr },
  { propertyId: "prop_ronda", locale: "pt", reviewed: true, content: rondaPt },
  { propertyId: "prop_madrid", locale: "es", reviewed: true, content: madridEs },
  { propertyId: "prop_madrid", locale: "en", reviewed: true, content: madridEn },
  { propertyId: "prop_madrid", locale: "fr", reviewed: false, content: madridFr },
  { propertyId: "prop_madrid", locale: "pt", reviewed: false, content: madridPt },
];

const note = (
  es: [string, string],
  en: [string, string],
  fr: [string, string],
  pt: [string, string],
) => ({
  es: { tagline: es[0], note: es[1] },
  en: { tagline: en[0], note: en[1] },
  fr: { tagline: fr[0], note: fr[1] },
  pt: { tagline: pt[0], note: pt[1] },
});

export const PLACES: Place[] = [
  {
    id: "pl_ronda_1",
    propertyId: "prop_ronda",
    category: "sights",
    scope: "recommendation",
    name: "Puente Nuevo",
    lat: 36.7412,
    lng: -5.166,
    price: null,
    url: null,
    phone: null,
    hours: null,
    notes: note(
      ["El motivo por el que has venido", "Ve al amanecer o después de cenar: entre las 11 y las 18 es imposible hacer una foto sin cincuenta personas dentro."],
      ["The reason you came", "Go at sunrise or after dinner: between 11:00 and 18:00 you can't take a photo without fifty people in it."],
      ["La raison de votre venue", "Allez-y au lever du soleil ou après le dîner : entre 11 h et 18 h, impossible de photographier sans cinquante personnes dedans."],
      ["A razão da sua viagem", "Vá ao amanhecer ou depois do jantar: entre as 11:00 e as 18:00 é impossível fotografar sem cinquenta pessoas."],
    ),
  },
  {
    id: "pl_ronda_2",
    propertyId: "prop_ronda",
    category: "tapas",
    scope: "recommendation",
    name: "Tragatá",
    lat: 36.7423,
    lng: -5.1653,
    price: 2,
    url: "https://www.tragata.com",
    phone: "+34952877209",
    hours: null,
    notes: note(
      ["Mi sitio favorito de Ronda", "Reserva con dos días: son cuatro mesas. Si no hay sitio, se come de pie en la barra y se come igual de bien."],
      ["My favourite place in Ronda", "Book two days ahead: there are four tables. If it's full, eat standing at the bar, it's just as good."],
      ["Mon adresse préférée à Ronda", "Réservez deux jours à l'avance : il n'y a que quatre tables. Sinon, mangez au comptoir, c'est aussi bon."],
      ["O meu sítio preferido em Ronda", "Reserve com dois dias: são quatro mesas. Se estiver cheio, coma ao balcão, é igualmente bom."],
    ),
  },
  {
    id: "pl_ronda_3",
    propertyId: "prop_ronda",
    category: "restaurant",
    scope: "recommendation",
    name: "Restaurante Pedro Romero",
    lat: 36.7434,
    lng: -5.1666,
    price: 3,
    url: null,
    phone: "+34952871110",
    hours: null,
    notes: note(
      ["Cocina clásica de la serranía", "Aquí es donde se pide el rabo de toro. Las paredes están llenas de fotos de toreros; a algunos huéspedes les incomoda y prefiero avisar."],
      ["Classic mountain cooking", "This is where you order oxtail. The walls are covered in bullfighting photos; some guests find that uncomfortable, so I'd rather say it upfront."],
      ["Cuisine classique de la serranía", "C'est ici qu'on commande la queue de taureau. Les murs sont couverts de photos de corrida ; cela met certains mal à l'aise, autant le dire."],
      ["Cozinha clássica da serra", "É aqui que se pede rabo de touro. As paredes estão cheias de fotos de tauromaquia; alguns hóspedes não gostam, por isso aviso."],
    ),
  },
  {
    id: "pl_ronda_4",
    propertyId: "prop_ronda",
    category: "sights",
    scope: "recommendation",
    name: "Plaza de toros de la Real Maestranza",
    lat: 36.7437,
    lng: -5.1669,
    price: 1,
    url: null,
    phone: null,
    hours: null,
    notes: note(
      ["Visita de museo, sin corridas", "Se visita como museo casi todo el año. La audioguía está en cuatro idiomas y dura 45 minutos."],
      ["A museum visit, no bullfights", "It works as a museum almost all year. The audio guide comes in four languages and lasts 45 minutes."],
      ["Une visite de musée, sans corrida", "Elle se visite comme un musée presque toute l'année. L'audioguide existe en quatre langues, 45 minutes."],
      ["Visita de museu, sem touradas", "Visita-se como museu quase todo o ano. O audioguia tem quatro idiomas e dura 45 minutos."],
    ),
  },
  {
    id: "pl_ronda_5",
    propertyId: "prop_ronda",
    category: "outdoors",
    scope: "recommendation",
    name: "Alameda del Tajo",
    lat: 36.7444,
    lng: -5.1678,
    price: null,
    url: null,
    phone: null,
    hours: null,
    notes: note(
      ["Sombra y el mejor mirador", "Los balcones del fondo dan al vacío. Con niños, ojo: las barandillas son bajas."],
      ["Shade and the best viewpoint", "The balconies at the far end hang over the drop. With children, mind the low railings."],
      ["De l'ombre et le meilleur panorama", "Les balcons du fond surplombent le vide. Avec des enfants, attention : les garde-corps sont bas."],
      ["Sombra e o melhor miradouro", "As varandas ao fundo dão para o vazio. Com crianças, atenção: as grades são baixas."],
    ),
  },
  {
    id: "pl_ronda_6",
    propertyId: "prop_ronda",
    category: "sights",
    scope: "recommendation",
    name: "Baños árabes",
    lat: 36.7393,
    lng: -5.1636,
    price: 1,
    url: null,
    phone: null,
    hours: null,
    notes: note(
      ["Los mejor conservados de España", "Están abajo del todo: se baja bien y se sube fatal. Guárdalo para primera hora."],
      ["The best preserved in Spain", "They're right at the bottom of the hill: easy down, brutal back up. Save them for early morning."],
      ["Les mieux conservés d'Espagne", "Ils sont tout en bas : la descente est facile, la remontée beaucoup moins. À faire tôt le matin."],
      ["Os mais bem conservados de Espanha", "Ficam no ponto mais baixo: descer é fácil, subir nem por isso. Guarde para a primeira hora."],
    ),
  },
  {
    id: "pl_ronda_7",
    propertyId: "prop_ronda",
    category: "shopping",
    scope: "recommendation",
    name: "Supermercado de Calle Espinel",
    lat: 36.7462,
    lng: -5.1638,
    price: null,
    url: null,
    phone: null,
    hours: null,
    notes: note(
      ["Para la compra del día", "Cierra a las 21:30 y el domingo solo abre por la mañana. En la calle peatonal hay fruterías mejores y más baratas."],
      ["For everyday shopping", "Closes at 21:30, Sunday mornings only. The greengrocers on the pedestrian street are better and cheaper."],
      ["Pour les courses du jour", "Ferme à 21 h 30, ouvert seulement le dimanche matin. Les primeurs de la rue piétonne sont meilleurs et moins chers."],
      ["Para as compras do dia", "Fecha às 21:30 e ao domingo só de manhã. As frutarias da rua pedonal são melhores e mais baratas."],
    ),
  },
  {
    id: "pl_ronda_er1",
    propertyId: "prop_ronda",
    scope: "emergency",
    category: "services",
    name: "Hospital Comarcal de la Serranía",
    lat: 36.7368,
    lng: -5.1585,
    price: null,
    url: null,
    phone: "+34951065100",
    hours: "24/7",
    notes: note(
      ["Urgencias 24 h", "El hospital de referencia de la comarca. En taxi son unos 10 minutos."],
      ["A&E, open 24h", "The regional hospital. About ten minutes by taxi."],
      ["Urgences 24 h", "L'hôpital de la région. Environ dix minutes en taxi."],
      ["Urgências 24 h", "O hospital da região. Cerca de dez minutos de táxi."],
    ),
  },
  {
    id: "pl_ronda_er2",
    propertyId: "prop_ronda",
    scope: "emergency",
    category: "services",
    name: "Farmacia Calle Espinel",
    lat: 36.7459,
    lng: -5.1641,
    price: null,
    url: null,
    phone: "+34952871234",
    hours: "Mo-Sa 09:30-21:30",
    notes: note(
      ["La farmacia más cercana", "Fuera de horario, la de guardia se anuncia en la puerta."],
      ["The nearest pharmacy", "Out of hours, the duty pharmacy is posted on the door."],
      ["La pharmacie la plus proche", "En dehors des heures, la pharmacie de garde est affichée sur la porte."],
      ["A farmácia mais próxima", "Fora de horas, a farmácia de serviço está afixada na porta."],
    ),
  },
  {
    id: "pl_madrid_1",
    propertyId: "prop_madrid",
    category: "shopping",
    scope: "recommendation",
    name: "Mercado de Antón Martín",
    lat: 40.4127,
    lng: -3.6997,
    price: 2,
    url: null,
    phone: null,
    hours: null,
    notes: note(
      ["Mercado de barrio, no de turistas", "Mitad puestos de toda la vida, mitad sitios para comer. El de arriba a la izquierda hace el mejor ceviche del barrio."],
      ["A neighbourhood market, not a tourist one", "Half traditional stalls, half places to eat. The one upstairs on the left does the best ceviche around."],
      ["Un marché de quartier, pas touristique", "Moitié étals traditionnels, moitié restauration. Celui du haut à gauche fait le meilleur ceviche du quartier."],
      ["Mercado de bairro, não de turistas", "Metade bancas tradicionais, metade sítios para comer. O de cima à esquerda faz o melhor ceviche da zona."],
    ),
  },
  {
    id: "pl_madrid_2",
    propertyId: "prop_madrid",
    category: "sights",
    scope: "recommendation",
    name: "Museo Reina Sofía",
    lat: 40.408,
    lng: -3.6944,
    price: 2,
    url: null,
    phone: null,
    hours: null,
    notes: note(
      ["El Guernica está aquí", "Entrada gratis de lunes a sábado de 19:00 a 21:00 y el domingo por la tarde. La cola se forma media hora antes."],
      ["The Guernica is here", "Free entry Monday to Saturday 19:00–21:00 and Sunday afternoons. The queue starts half an hour before."],
      ["Le Guernica est ici", "Entrée gratuite du lundi au samedi de 19 h à 21 h et le dimanche après-midi. La file commence une demi-heure avant."],
      ["O Guernica está aqui", "Entrada gratuita de segunda a sábado das 19:00 às 21:00 e ao domingo à tarde. A fila começa meia hora antes."],
    ),
  },
  {
    id: "pl_madrid_3",
    propertyId: "prop_madrid",
    category: "restaurant",
    scope: "recommendation",
    name: "Taberna Antonio Sánchez",
    lat: 40.4098,
    lng: -3.702,
    price: 2,
    url: null,
    phone: null,
    hours: null,
    notes: note(
      ["Taberna de 1830", "No ha cambiado nada en cien años y eso incluye la carta. Pide los callos si te atreves y, si no, la tortilla."],
      ["A tavern from 1830", "Nothing has changed in a hundred years, menu included. Order the tripe if you dare, the omelette if you don't."],
      ["Une taverne de 1830", "Rien n'a changé en cent ans, la carte comprise. Prenez les tripes si vous osez, sinon la tortilla."],
      ["Taberna de 1830", "Nada mudou em cem anos, incluindo a ementa. Peça as tripas se tiver coragem, senão a tortilha."],
    ),
  },
  {
    id: "pl_madrid_4",
    propertyId: "prop_madrid",
    category: "outdoors",
    scope: "recommendation",
    name: "Parque del Retiro",
    lat: 40.4153,
    lng: -3.6844,
    price: null,
    url: null,
    phone: null,
    hours: null,
    notes: note(
      ["Quince minutos cuesta arriba", "Entra por la Puerta de Atocha y sube hasta el Palacio de Cristal. Los domingos por la mañana hay tambores junto al estanque."],
      ["Fifteen minutes uphill", "Enter by Puerta de Atocha and walk up to the Palacio de Cristal. Sunday mornings there are drummers by the lake."],
      ["Quinze minutes de montée", "Entrez par la Puerta de Atocha et montez jusqu'au Palacio de Cristal. Le dimanche matin, des percussions près du bassin."],
      ["Quinze minutos a subir", "Entre pela Puerta de Atocha e suba até ao Palacio de Cristal. Ao domingo de manhã há tambores junto ao lago."],
    ),
  },
  {
    id: "pl_madrid_5",
    propertyId: "prop_madrid",
    category: "cafe",
    scope: "recommendation",
    name: "Pum Pum Café",
    lat: 40.4076,
    lng: -3.702,
    price: 2,
    url: null,
    phone: null,
    hours: null,
    notes: note(
      ["Desayuno de verdad", "Abre a las 9:00 entre semana. Es pequeño y a las 11 no hay sitio los fines de semana."],
      ["A proper breakfast", "Opens at 9:00 on weekdays. It's small and by 11:00 at weekends there's no room."],
      ["Un vrai petit-déjeuner", "Ouvre à 9 h en semaine. C'est petit et à 11 h le week-end, plus une place."],
      ["Pequeno-almoço a sério", "Abre às 9:00 durante a semana. É pequeno e ao fim de semana às 11:00 já não há lugar."],
    ),
  },
  {
    id: "pl_madrid_6",
    propertyId: "prop_madrid",
    category: "nightlife",
    scope: "recommendation",
    name: "Cine Doré (Filmoteca Española)",
    lat: 40.4122,
    lng: -3.6989,
    price: 1,
    url: null,
    phone: null,
    hours: null,
    notes: note(
      ["Cine clásico a 3 €", "Versión original con subtítulos en español. Las entradas se compran en taquilla el mismo día."],
      ["Classic cinema for €3", "Original version with Spanish subtitles. Tickets are sold at the box office on the day."],
      ["Cinéma classique à 3 €", "Version originale sous-titrée en espagnol. Billets en caisse le jour même."],
      ["Cinema clássico a 3 €", "Versão original com legendas em espanhol. Os bilhetes vendem-se na bilheteira no próprio dia."],
    ),
  },
  {
    id: "pl_madrid_7",
    propertyId: "prop_madrid",
    category: "services",
    scope: "recommendation",
    name: "Farmacia Argumosa 24 h",
    lat: 40.4077,
    lng: -3.6991,
    price: null,
    url: null,
    phone: "+34915390123",
    hours: null,
    notes: note(
      ["Abierta toda la noche", "A ochenta metros del portal. Tienen intérprete de inglés por teléfono si lo necesitas."],
      ["Open all night", "Eighty metres from the front door. They can get an English interpreter on the phone if you need one."],
      ["Ouverte toute la nuit", "À quatre-vingts mètres de l'immeuble. Un interprète anglais est joignable par téléphone si besoin."],
      ["Aberta toda a noite", "A oitenta metros do prédio. Têm intérprete de inglês por telefone, se precisar."],
    ),
  },
];

/* ---------------------------------------------------------------------------
   Demo bookings, with dates RELATIVE TO THE DAY THE SEED RUNS. If a reviewer
   opens this in September the demo still makes sense: one booking in progress,
   one that has not started yet, and one already finished, showing the memories
   mode with access cut off.
--------------------------------------------------------------------------- */
const shift = (days: number): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const STAYS: Stay[] = [
  {
    id: "stay_ronda_actual",
    propertyId: "prop_ronda",
    slug: "r7d3ka92",
    guestName: "Claire",
    arrival: shift(-2),
    departure: shift(3),
    accessCodeOverride: null,
    pin: null,
    revoked: false,
    openedAt: null,
  },
  {
    id: "stay_ronda_proxima",
    propertyId: "prop_ronda",
    slug: "r5xw81nq",
    guestName: "Tomás",
    arrival: shift(9),
    departure: shift(13),
    accessCodeOverride: null,
    /* PIN-protected booking: shows that the PIN is set per guest. */
    pin: "2610",
    revoked: false,
    openedAt: null,
  },
  {
    id: "stay_madrid_pasada",
    propertyId: "prop_madrid",
    slug: "mv8ktp41",
    guestName: "Ana",
    arrival: shift(-9),
    departure: shift(-4),
    accessCodeOverride: null,
    pin: null,
    revoked: false,
    openedAt: null,
  },
];

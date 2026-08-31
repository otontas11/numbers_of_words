export type TravelLocation = {
  id: string;
  name: string;
  emoji: string;
  background: string;
  levelCount: number;
  startLevel: number;
  kind: 'destination' | 'challenge';
};

export type TravelCountry = {
  id: string;
  country: string;
  flag: string;
  primaryRouteId: string;
  levelCount: 20;
  locations: TravelLocation[];
  challenge: TravelLocation;
  /** Eski ekranlarla uyumluluk için yalnızca üç gerçek destinasyon. */
  cities: TravelLocation[];
  background: string;
  rewardLandmark: string;
  worldIndex: number;
};

export type TravelLeg = {
  label: string;
  distance: string;
};

export type TravelRoute = {
  id: string;
  name: string;
  shortName: string;
  emoji: string;
  order: number;
  difficulty: number;
  countryIds: string[];
  nextRouteIds: string[];
  background: string;
  theme: string;
  legs: TravelLeg[];
};

export type TravelDestination = {
  globalLevel: number;
  cycleLevel: number;
  masterTour: number;
  route: TravelRoute;
  routeIndex: number;
  routeCountryIndex: number;
  country: TravelCountry;
  countryIndex: number;
  countryLevel: number;
  location: TravelLocation;
  locationIndex: number;
  locationLevel: number;
  countryChallenge: boolean;
  worldTourFinal: boolean;
};

export type TravelLevelCompletion = {
  locationCompleted: boolean;
  countryCompleted: boolean;
  worldTourCompleted: boolean;
  nextDestination: TravelDestination;
};

type CountrySeed = readonly [
  id: string,
  country: string,
  flag: string,
  locations: readonly [string, string, string],
  rewardLandmark?: string,
];

type RouteSeed = {
  id: string;
  name: string;
  shortName: string;
  emoji: string;
  theme: string;
  background: string;
  countries: readonly CountrySeed[];
  modes: readonly string[];
};

const CDN = 'https://dragon-cdn.storycolor-cdn.workers.dev/word-journey/v2/';

const ROUTE_ART = {
  mediterranean: `${CDN}turkey.jpg`,
  westernMediterranean: `${CDN}morocco.jpg`,
  centralEurope: `${CDN}tecvid/bosnia-herzegovina.jpg`,
  northernLights: `${CDN}bukhara.jpg`,
  caucasus: `${CDN}tecvid/bosnia-herzegovina.jpg`,
  desert: `${CDN}tecvid/jordan.jpg`,
  silkRoad: `${CDN}samarkand.jpg`,
  himalayas: `${CDN}tecvid/iran.jpg`,
  southeastAsia: `${CDN}tecvid/malaysia.jpg`,
  farEast: `${CDN}tecvid/malaysia.jpg`,
  nileAfrica: `${CDN}egypt.jpg`,
  africaAdventure: `${CDN}morocco.jpg`,
  americas: `${CDN}andalusia.jpg`,
  pacificFinal: `${CDN}samarkand.jpg`,
} as const;

const COUNTRY_ART: Record<string, string> = {
  turkey: `${CDN}turkey.jpg`,
  'bosnia-herzegovina': `${CDN}tecvid/bosnia-herzegovina.jpg`,
  morocco: `${CDN}morocco.jpg`,
  jordan: `${CDN}tecvid/jordan.jpg`,
  iran: `${CDN}tecvid/iran.jpg`,
  turkmenistan: `${CDN}tecvid/malaysia.jpg`,
  uzbekistan: `${CDN}tecvid/uzbekistan.jpg`,
  oman: `${CDN}tecvid/oman.jpg`,
  egypt: `${CDN}egypt.jpg`,
  malaysia: `${CDN}tecvid/malaysia.jpg`,
};

const ROUTE_SEEDS: readonly RouteSeed[] = [
  {
    id: 'mediterranean-gateway',
    name: "Akdeniz'in Kapısı",
    shortName: 'Akdeniz',
    emoji: '🌊',
    theme: 'Turkuaz denizler, Akdeniz kasabaları ve gün batımı',
    background: ROUTE_ART.mediterranean,
    modes: ['✈️/⛴️', '🚗 Araba', '🚗 Araba', '🚗 Araba', '🚆 Tren', '🚆 Tren', '⛴️ Gemi'],
    countries: [
      ['turkey', 'Türkiye', '🇹🇷', ['İstanbul', 'Kapadokya', 'Pamukkale'], 'Ayasofya'],
      ['greece', 'Yunanistan', '🇬🇷', ['Atina', 'Santorini', 'Selanik'], 'Akropolis'],
      ['albania', 'Arnavutluk', '🇦🇱', ['Tiran', 'Berat', 'Gjirokastër'], 'Berat'],
      ['montenegro', 'Karadağ', '🇲🇪', ['Kotor', 'Budva', 'Cetinje'], 'Kotor'],
      ['croatia', 'Hırvatistan', '🇭🇷', ['Dubrovnik', 'Split', 'Zagreb'], 'Dubrovnik'],
      ['slovenia', 'Slovenya', '🇸🇮', ['Ljubljana', 'Bled', 'Piran'], 'Bled Gölü'],
      ['italy', 'İtalya', '🇮🇹', ['Roma', 'Venedik', 'Floransa'], 'Colosseum'],
      ['malta', 'Malta', '🇲🇹', ['Valletta', 'Mdina', 'Marsaxlokk'], 'Valletta'],
    ],
  },
  {
    id: 'western-mediterranean-atlantic',
    name: 'Batı Akdeniz & Atlantik',
    shortName: 'Batı Akdeniz',
    emoji: '⛵',
    theme: 'Kuzey Afrika kıyılarından Atlantik şehirlerine deniz yolculuğu',
    background: ROUTE_ART.westernMediterranean,
    modes: ['🚗 Araba', '🚗 Araba', '⛴️ Gemi', '🚆 Tren', '🚆 Tren', '🚆 Tren'],
    countries: [
      ['tunisia', 'Tunus', '🇹🇳', ['Tunus', 'Sidi Bou Said', 'Kayrevan'], 'Sidi Bou Said'],
      ['algeria', 'Cezayir', '🇩🇿', ['Cezayir', 'Konstantin', 'Ghardaia'], 'Sahra'],
      ['morocco', 'Fas', '🇲🇦', ['Marakeş', 'Fes', 'Şafşavan'], 'Şafşavan'],
      ['spain', 'İspanya', '🇪🇸', ['Barselona', 'Sevilla', 'Granada'], 'Sagrada Família'],
      ['portugal', 'Portekiz', '🇵🇹', ['Lizbon', 'Porto', 'Sintra'], 'Sintra'],
      ['france', 'Fransa', '🇫🇷', ['Paris', 'Nice', 'Strasbourg'], 'Eyfel Kulesi'],
      ['united-kingdom', 'Birleşik Krallık', '🇬🇧', ['Londra', 'Edinburgh', 'York'], 'Big Ben'],
    ],
  },
  {
    id: 'heart-of-europe',
    name: "Avrupa'nın Kalbi",
    shortName: 'Orta Avrupa',
    emoji: '🚆',
    theme: 'Tarihi Avrupa şehirleri ve kesintisiz tren yolculuğu',
    background: ROUTE_ART.centralEurope,
    modes: ['⛴️ Gemi', '🚆 Tren', '🚆 Tren', '🚆 Tren', '🚆 Tren', '🚆 Tren'],
    countries: [
      ['ireland', 'İrlanda', '🇮🇪', ['Dublin', 'Galway', 'Killarney'], 'Moher Kayalıkları'],
      ['belgium', 'Belçika', '🇧🇪', ['Brüksel', 'Brugge', 'Gent'], 'Brugge'],
      ['netherlands', 'Hollanda', '🇳🇱', ['Amsterdam', 'Rotterdam', 'Utrecht'], 'Yel Değirmenleri'],
      ['germany', 'Almanya', '🇩🇪', ['Berlin', 'Münih', 'Heidelberg'], 'Neuschwanstein'],
      ['switzerland', 'İsviçre', '🇨🇭', ['Luzern', 'Interlaken', 'Zermatt'], 'Alpler'],
      ['austria', 'Avusturya', '🇦🇹', ['Viyana', 'Salzburg', 'Hallstatt'], 'Hallstatt'],
      ['czechia', 'Çekya', '🇨🇿', ['Prag', 'Český Krumlov', 'Karlovy Vary'], 'Prag'],
    ],
  },
  {
    id: 'northern-lights',
    name: 'Kuzey Işıkları',
    shortName: 'Kuzey Işıkları',
    emoji: '🌌',
    theme: 'Ormanlardan kara, fiyortlardan kuzey ışıklarına',
    background: ROUTE_ART.northernLights,
    modes: ['🚆 Tren', '🚆 Tren', '🚆 Tren', '⛴️ Gemi', '🚆 Tren', '🚆 Tren', '⛴️ Gemi'],
    countries: [
      ['poland', 'Polonya', '🇵🇱', ['Krakow', 'Varşova', 'Gdańsk'], 'Krakow'],
      ['lithuania', 'Litvanya', '🇱🇹', ['Vilnius', 'Kaunas', 'Klaipėda'], 'Vilnius'],
      ['latvia', 'Letonya', '🇱🇻', ['Riga', 'Cēsis', 'Liepāja'], 'Riga'],
      ['estonia', 'Estonya', '🇪🇪', ['Tallinn', 'Tartu', 'Pärnu'], 'Tallinn'],
      ['finland', 'Finlandiya', '🇫🇮', ['Helsinki', 'Rovaniemi', 'Turku'], 'Kuzey Işıkları'],
      ['sweden', 'İsveç', '🇸🇪', ['Stockholm', 'Göteborg', 'Kiruna'], 'Kiruna'],
      ['norway', 'Norveç', '🇳🇴', ['Oslo', 'Bergen', 'Tromsø'], 'Aurora Borealis'],
      ['denmark', 'Danimarka', '🇩🇰', ['Kopenhag', 'Aarhus', 'Odense'], 'Kopenhag'],
    ],
  },
  {
    id: 'danube-to-caucasus',
    name: "Tuna'dan Kafkaslara",
    shortName: 'Kafkaslar',
    emoji: '🏔️',
    theme: "Tuna kıyılarından Kafkas Dağları'na uzanan yol",
    background: ROUTE_ART.caucasus,
    modes: ['🚆 Tren', '🚆 Tren', '🚗 Araba', '✈️ Uçak', '🚗 Araba', '🚆 Tren'],
    countries: [
      ['hungary', 'Macaristan', '🇭🇺', ['Budapeşte', 'Eger', 'Pécs'], 'Budapeşte'],
      ['bosnia-herzegovina', 'Bosna-Hersek', '🇧🇦', ['Saraybosna', 'Mostar', 'Travnik'], 'Mostar'],
      ['romania', 'Romanya', '🇷🇴', ['Bükreş', 'Brașov', 'Sibiu'], 'Transilvanya'],
      ['bulgaria', 'Bulgaristan', '🇧🇬', ['Sofya', 'Plovdiv', 'Veliko Tarnovo'], 'Rila'],
      ['georgia', 'Gürcistan', '🇬🇪', ['Tiflis', 'Batum', 'Stepantsminda / Kazbegi'], 'Kazbegi'],
      ['armenia', 'Ermenistan', '🇦🇲', ['Erivan', 'Gyumri', 'Dilijan'], 'Dilijan'],
      ['azerbaijan', 'Azerbaycan', '🇦🇿', ['Bakü', 'Şeki', 'Gence'], 'Bakü'],
    ],
  },
  {
    id: 'desert-wonders',
    name: 'Çölün Harikaları',
    shortName: 'Çöl Harikaları',
    emoji: '🏜️',
    theme: 'Taşlık çölden vahalara ve modern çöl şehirlerine',
    background: ROUTE_ART.desert,
    modes: ['✈️ Uçak', '🚗 Arazi Aracı', '🚗 Arazi Aracı', '✈️ Uçak', '🚗 Araba', '🚗 Araba'],
    countries: [
      ['jordan', 'Ürdün', '🇯🇴', ['Amman', 'Petra', 'Akabe'], 'Petra'],
      ['saudi-arabia', 'Suudi Arabistan', '🇸🇦', ['Riyad', 'Cidde', 'AlUla'], 'AlUla'],
      ['united-arab-emirates', 'Birleşik Arap Emirlikleri', '🇦🇪', ['Dubai', 'Abu Dabi', 'Şarika'], 'Dubai'],
      ['oman', 'Umman', '🇴🇲', ['Maskat', 'Nizwa', 'Sur'], 'Maskat'],
      ['qatar', 'Katar', '🇶🇦', ['Doha', 'Al Wakrah', 'Al Khor'], 'Doha'],
      ['bahrain', 'Bahreyn', '🇧🇭', ['Manama', 'Muharraq', 'Riffa'], 'Bahreyn Kalesi'],
      ['kuwait', 'Kuveyt', '🇰🇼', ['Kuveyt Şehri', 'Al Jahra', 'Al Ahmadi'], 'Kuveyt Kuleleri'],
    ],
  },
  {
    id: 'silk-road',
    name: 'İpek Yolu',
    shortName: 'İpek Yolu',
    emoji: '🐫',
    theme: 'Kervan şehirleri, bozkırlar ve Orta Asya mirası',
    background: ROUTE_ART.silkRoad,
    modes: ['🚆 Tren', '🚆 Tren', '🚗 Araba', '🚗 Araba', '🚆 Tren', '🚗 Arazi Aracı'],
    countries: [
      ['iran', 'İran', '🇮🇷', ['İsfahan', 'Şiraz', 'Yezd'], 'İsfahan'],
      ['turkmenistan', 'Türkmenistan', '🇹🇲', ['Aşkabat', 'Merv', 'Köhne Ürgenç'], 'Merv'],
      ['uzbekistan', 'Özbekistan', '🇺🇿', ['Semerkant', 'Buhara', 'Hive'], 'Semerkant'],
      ['tajikistan', 'Tacikistan', '🇹🇯', ['Duşanbe', 'Hucend', 'Horog'], 'Pamir Dağları'],
      ['kyrgyzstan', 'Kırgızistan', '🇰🇬', ['Bişkek', 'Karakol', 'Oş'], 'Issık Göl'],
      ['kazakhstan', 'Kazakistan', '🇰🇿', ['Almatı', 'Astana', 'Türkistan'], 'Charyn Canyon'],
      ['mongolia', 'Moğolistan', '🇲🇳', ['Ulan Batur', 'Kharkhorin', 'Dalanzadgad'], 'Gobi Çölü'],
    ],
  },
  {
    id: 'himalayas-indian-ocean',
    name: 'Himalayalar & Hint Okyanusu',
    shortName: 'Himalayalar',
    emoji: '🛕',
    theme: 'Himalaya zirvelerinden tropikal Hint Okyanusu adalarına',
    background: ROUTE_ART.himalayas,
    modes: ['🚗 Araba', '🚆 Tren', '🚗 Araba', '✈️ Uçak', '✈️ Uçak', '✈️ Uçak'],
    countries: [
      ['pakistan', 'Pakistan', '🇵🇰', ['Lahor', 'İslamabad', 'Karimabad / Hunza'], 'Hunza Vadisi'],
      ['india', 'Hindistan', '🇮🇳', ['Delhi', 'Agra', 'Jaipur'], 'Tac Mahal'],
      ['nepal', 'Nepal', '🇳🇵', ['Katmandu', 'Pokhara', 'Bhaktapur'], 'Himalayalar'],
      ['bhutan', 'Bhutan', '🇧🇹', ['Thimphu', 'Paro', 'Punakha'], "Tiger's Nest"],
      ['bangladesh', 'Bangladeş', '🇧🇩', ['Dakka', 'Chattogram', 'Sylhet'], 'Nehir Deltaları'],
      ['sri-lanka', 'Sri Lanka', '🇱🇰', ['Colombo', 'Kandy', 'Galle'], 'Sigiriya'],
      ['maldives', 'Maldivler', '🇲🇻', ['Malé', 'Maafushi', 'Addu City'], 'Tropik Adalar'],
    ],
  },
  {
    id: 'southeast-asia',
    name: 'Güneydoğu Asya',
    shortName: 'Güneydoğu Asya',
    emoji: '🌴',
    theme: 'Tropikal ormanlar, nehirler, tapınaklar ve modern şehirler',
    background: ROUTE_ART.southeastAsia,
    modes: ['✈️ Uçak', '🚗 Araba', '🚗 Araba', '🚗 Araba', '✈️ Uçak', '🚆 Tren'],
    countries: [
      ['myanmar', 'Myanmar', '🇲🇲', ['Yangon', 'Bagan', 'Mandalay'], 'Bagan'],
      ['thailand', 'Tayland', '🇹🇭', ['Bangkok', 'Chiang Mai', 'Phuket'], 'Bangkok'],
      ['laos', 'Laos', '🇱🇦', ['Luang Prabang', 'Vientiane', 'Vang Vieng'], 'Luang Prabang'],
      ['cambodia', 'Kamboçya', '🇰🇭', ['Siem Reap', 'Phnom Penh', 'Kampot'], 'Angkor Wat'],
      ['vietnam', 'Vietnam', '🇻🇳', ['Hanoi', 'Hoi An', 'Ho Chi Minh City'], 'Ha Long Bay'],
      ['malaysia', 'Malezya', '🇲🇾', ['Kuala Lumpur', 'George Town', 'Malakka'], 'Petronas Kuleleri'],
      ['singapore', 'Singapur', '🇸🇬', ['Marina Bay', 'Gardens by the Bay', 'Sentosa'], 'Marina Bay'],
    ],
  },
  {
    id: 'far-east-pacific',
    name: 'Uzak Doğu & Pasifik',
    shortName: 'Uzak Doğu',
    emoji: '🏯',
    theme: 'Tropik adalardan sakura bahçelerine uzanan Pasifik rotası',
    background: ROUTE_ART.farEast,
    modes: ['⛴️ Gemi', '✈️ Uçak', '✈️ Uçak', '✈️ Uçak', '🚆 Tren', '✈️ Uçak'],
    countries: [
      ['indonesia', 'Endonezya', '🇮🇩', ['Ubud / Bali', 'Yogyakarta', 'Jakarta'], 'Borobudur'],
      ['brunei', 'Brunei', '🇧🇳', ['Bandar Seri Begawan', 'Kuala Belait', 'Tutong'], 'Bandar Seri Begawan'],
      ['philippines', 'Filipinler', '🇵🇭', ['Manila', 'Cebu', 'Puerto Princesa / Palawan'], 'Palawan'],
      ['taiwan', 'Tayvan', '🇹🇼', ['Taipei', 'Kaohsiung', 'Tainan'], 'Taipei 101'],
      ['china', 'Çin', '🇨🇳', ['Pekin', "Xi'an", 'Şanghay'], 'Çin Seddi'],
      ['south-korea', 'Güney Kore', '🇰🇷', ['Seul', 'Busan', 'Gyeongju'], 'Seul'],
      ['japan', 'Japonya', '🇯🇵', ['Tokyo', 'Kyoto', 'Osaka'], 'Fuji Dağı'],
    ],
  },

  {
    id: 'nile-to-south-africa',
    name: "Nil'den Afrika'nın Güneyine",
    shortName: 'Nil & Afrika',
    emoji: '🦁',
    theme: 'Nil, yüksek platolar, savanlar, şelaleler ve Cape Town',
    background: ROUTE_ART.nileAfrica,
    modes: ['✈️ Uçak', '✈️ Uçak', '🚗 Arazi Aracı', '🚗 Arazi Aracı', '🚗 Araba', '✈️ Uçak'],
    countries: [
      ['egypt', 'Mısır', '🇪🇬', ['Kahire / Gize', 'Luksor', 'Asvan'], 'Piramitler'],
      ['ethiopia', 'Etiyopya', '🇪🇹', ['Addis Ababa', 'Lalibela', 'Gondar'], 'Lalibela'],
      ['kenya', 'Kenya', '🇰🇪', ['Nairobi', 'Mombasa', 'Naivasha'], 'Maasai Mara'],
      ['tanzania', 'Tanzanya', '🇹🇿', ['Arusha', 'Zanzibar City', 'Darüsselam'], 'Kilimanjaro'],
      ['zambia', 'Zambiya', '🇿🇲', ['Lusaka', 'Livingstone', 'Ndola'], 'Victoria Şelaleleri'],
      ['zimbabwe', 'Zimbabve', '🇿🇼', ['Harare', 'Victoria Falls', 'Bulawayo'], 'Victoria Falls'],
      ['south-africa', 'Güney Afrika', '🇿🇦', ['Cape Town', 'Johannesburg', 'Durban'], 'Cape Town'],
    ],
  },
  {
    id: 'africa-adventure',
    name: 'Afrika Macerası',
    shortName: 'Afrika Macerası',
    emoji: '🌍',
    theme: 'Çöllerden tropikal kıyılara uzanan çok renkli Afrika',
    background: ROUTE_ART.africaAdventure,
    modes: ['🚗 Arazi Aracı', '✈️ Uçak', '✈️ Uçak', '✈️ Uçak', '✈️ Uçak', '✈️ Uçak'],
    countries: [
      ['namibia', 'Namibya', '🇳🇦', ['Windhoek', 'Swakopmund', 'Lüderitz'], 'Sossusvlei'],
      ['botswana', 'Botsvana', '🇧🇼', ['Gaborone', 'Maun', 'Kasane'], 'Okavango'],
      ['mozambique', 'Mozambik', '🇲🇿', ['Maputo', 'Vilanculos', 'Pemba'], 'Hint Okyanusu'],
      ['madagascar', 'Madagaskar', '🇲🇬', ['Antananarivo', 'Morondava', 'Antsiranana'], 'Baobab Yolu'],
      ['mauritius', 'Mauritius', '🇲🇺', ['Port Louis', 'Grand Baie', 'Mahébourg'], 'Le Morne'],
      ['ghana', 'Gana', '🇬🇭', ['Accra', 'Cape Coast', 'Kumasi'], 'Cape Coast'],
      ['senegal', 'Senegal', '🇸🇳', ['Dakar', 'Saint-Louis', 'Ziguinchor'], 'Gorée'],
    ],
  },
  {
    id: 'americas-journey',
    name: 'Amerika Yolculuğu',
    shortName: 'Amerika',
    emoji: '🗽',
    theme: 'Kanada kayalıklarından And Dağları’na kuzeyden güneye yolculuk',
    background: ROUTE_ART.americas,
    modes: ['✈️ Uçak', '✈️ Uçak', '🚗 Araba', '🚗 Araba', '✈️ Uçak', '✈️ Uçak'],
    countries: [
      ['canada', 'Kanada', '🇨🇦', ['Vancouver', 'Banff', 'Québec City'], 'Banff'],
      ['united-states', 'ABD', '🇺🇸', ['New York', 'San Francisco', 'Las Vegas / Grand Canyon'], 'Grand Canyon'],
      ['mexico', 'Meksika', '🇲🇽', ['Mexico City', 'Oaxaca', 'Valladolid / Yucatán'], 'Chichén Itzá'],
      ['guatemala', 'Guatemala', '🇬🇹', ['Antigua Guatemala', 'Guatemala City', 'Flores'], 'Tikal'],
      ['costa-rica', 'Kosta Rika', '🇨🇷', ['San José', 'La Fortuna', 'Puerto Viejo'], 'Arenal'],
      ['colombia', 'Kolombiya', '🇨🇴', ['Cartagena', 'Medellín', 'Bogotá'], 'Cartagena'],
      ['peru', 'Peru', '🇵🇪', ['Lima', 'Cusco', 'Arequipa'], 'Machu Picchu'],
    ],
  },
  {
    id: 'andes-to-pacific',
    name: "Andlar'dan Büyük Okyanus'a",
    shortName: 'Pasifik Finali',
    emoji: '🌏',
    theme: "Andlar'dan Pasifik'e, Dünya Turu'nun altın finali",
    background: ROUTE_ART.pacificFinal,
    modes: ['🚗 Araba', '🚗 Araba', '✈️ Uçak', '✈️ Uçak', '✈️ Uçak', '✈️ Uçak'],
    countries: [
      ['ecuador', 'Ekvador', '🇪🇨', ['Quito', 'Cuenca', 'Puerto Ayora / Galápagos'], 'Galápagos'],
      ['bolivia', 'Bolivya', '🇧🇴', ['La Paz', 'Sucre', 'Uyuni'], 'Salar de Uyuni'],
      ['chile', 'Şili', '🇨🇱', ['Santiago', 'Valparaíso', 'San Pedro de Atacama'], 'Atacama'],
      ['argentina', 'Arjantin', '🇦🇷', ['Buenos Aires', 'Mendoza', 'El Calafate / Patagonya'], 'Patagonya'],
      ['brazil', 'Brezilya', '🇧🇷', ['Rio de Janeiro', 'Salvador', 'Foz do Iguaçu'], 'Iguaçu Şelaleleri'],
      ['australia', 'Avustralya', '🇦🇺', ['Sydney', 'Cairns', 'Alice Springs / Uluru'], 'Uluru'],
      ['new-zealand', 'Yeni Zelanda', '🇳🇿', ['Auckland', 'Rotorua', 'Queenstown'], 'Milford Sound'],
    ],
  },
] as const;

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function locationEmoji(name: string, index: number) {
  if (/göl|ada|bay|sahil|kıyı|sound|male|malé|sentosa|phuket|palawan|cebu|zanzibar/i.test(name)) return '🏝️';
  if (/dağ|fuji|alp|hunza|banff|tromsø|patagonya|uluru|zermatt|interlaken/i.test(name)) return '🏔️';
  if (/çöl|gobi|wadi|atacama|uyuni|alula/i.test(name)) return '🏜️';
  if (/şelale|falls|iguaçu|livingstone/i.test(name)) return '💧';
  if (/petra|gize|luksor|angkor|borobudur|machu|chichén|tikal|sigiriya|akropolis|colosseum/i.test(name)) return '🏛️';
  return ['🏙️', '🏛️', '🌄'][index % 3];
}

function makeLocations(
  countryId: string,
  names: readonly [string, string, string],
  background: string,
): TravelLocation[] {
  const counts = [7, 7, 5] as const;
  const starts = [1, 8, 15] as const;
  return names.map((name, index) => ({
    id: `${countryId}-${slugify(name)}`,
    name,
    emoji: locationEmoji(name, index),
    background,
    levelCount: counts[index],
    startLevel: starts[index],
    kind: 'destination' as const,
  }));
}

function distanceFor(mode: string, routeOrder: number, legIndex: number) {
  if (mode.includes('🚗')) return `≈ ${120 + ((routeOrder * 73 + legIndex * 97) % 640)} km`;
  if (mode.includes('🚆')) return `≈ ${300 + ((routeOrder * 113 + legIndex * 151) % 700)} km`;
  if (mode.includes('⛴️')) return `≈ ${180 + ((routeOrder * 83 + legIndex * 127) % 620)} km`;
  return `≈ ${850 + ((routeOrder * 431 + legIndex * 617) % 6200)} km`;
}

const countries: TravelCountry[] = [];

export const TRAVEL_ROUTES: TravelRoute[] = ROUTE_SEEDS.map((seed, routeIndex) => {
  const order = routeIndex + 1;
  seed.countries.forEach(([id, country, flag, locationNames, rewardLandmark]) => {
    const background = COUNTRY_ART[id] ?? seed.background;
    const locations = makeLocations(id, locationNames, background);
    countries.push({
      id,
      country,
      flag,
      primaryRouteId: seed.id,
      levelCount: 20,
      locations,
      challenge: {
        id: `${id}-country-challenge`,
        name: id === 'new-zealand' ? 'WORLD TOUR FINAL' : `${country} Challenge`,
        emoji: id === 'new-zealand' ? '🌍' : '🏆',
        background,
        levelCount: 1,
        startLevel: 20,
        kind: 'challenge',
      },
      cities: locations,
      background,
      rewardLandmark: rewardLandmark ?? locationNames[2],
      worldIndex: countries.length,
    });
  });

  return {
    id: seed.id,
    name: seed.name,
    shortName: seed.shortName,
    emoji: seed.emoji,
    order,
    difficulty: order,
    countryIds: seed.countries.map(([id]) => id),
    nextRouteIds: ROUTE_SEEDS[routeIndex + 1] ? [ROUTE_SEEDS[routeIndex + 1].id] : [],
    background: seed.background,
    theme: seed.theme,
    legs: seed.modes.map((label, legIndex) => ({
      label,
      distance: distanceFor(label, order, legIndex),
    })),
  };
});

export const WORLD_COUNTRIES = countries;
export const PLAY_ORDER_COUNTRIES = WORLD_COUNTRIES;
export const COUNTRY_BY_ID = new Map(WORLD_COUNTRIES.map((country) => [country.id, country]));
export const ROUTE_BY_ID = new Map(TRAVEL_ROUTES.map((route) => [route.id, route]));
export const TOTAL_DESTINATIONS = WORLD_COUNTRIES.reduce(
  (total, country) => total + country.locations.length,
  0,
);
export const TOTAL_WORLD_LEVELS = WORLD_COUNTRIES.length * 20;

const countryStartById = new Map(
  WORLD_COUNTRIES.map((country, index) => [country.id, index * country.levelCount]),
);

export function getCountryStart(countryId: string) {
  return countryStartById.get(countryId) ?? Number.POSITIVE_INFINITY;
}

export function getCompletedWorldLevelCount(globalLevel: number) {
  return Math.min(TOTAL_WORLD_LEVELS, Math.max(0, Math.floor(globalLevel) - 1));
}

export function getCountryProgress(globalLevel: number, countryId: string) {
  const country = COUNTRY_BY_ID.get(countryId);
  if (!country) return 0;
  return Math.max(
    0,
    Math.min(country.levelCount, getCompletedWorldLevelCount(globalLevel) - getCountryStart(countryId)),
  );
}

export function getLocationProgress(
  globalLevel: number,
  country: TravelCountry,
  location: TravelLocation,
) {
  const completedInCountry = getCountryProgress(globalLevel, country.id);
  return Math.max(0, Math.min(location.levelCount, completedInCountry - location.startLevel + 1));
}

export function isLocationUnlocked(
  globalLevel: number,
  country: TravelCountry,
  location: TravelLocation,
) {
  return isCountryUnlocked(globalLevel, country.id) &&
    getCountryProgress(globalLevel, country.id) >= location.startLevel - 1;
}

export function isCountryUnlocked(globalLevel: number, countryId: string) {
  return getCompletedWorldLevelCount(globalLevel) >= getCountryStart(countryId);
}

export function isCountryComplete(globalLevel: number, countryId: string) {
  const country = COUNTRY_BY_ID.get(countryId);
  return country ? getCountryProgress(globalLevel, countryId) >= country.levelCount : false;
}

export function getCompletedCountryCount(globalLevel: number) {
  return Math.min(WORLD_COUNTRIES.length, Math.floor(getCompletedWorldLevelCount(globalLevel) / 20));
}

export function getRouteProgress(globalLevel: number, route: TravelRoute) {
  return route.countryIds.filter((countryId) => isCountryComplete(globalLevel, countryId)).length;
}

export function isRouteUnlocked(globalLevel: number, route: TravelRoute) {
  if (route.order === 1) return true;
  return isRouteComplete(globalLevel, TRAVEL_ROUTES[route.order - 2]);
}

export function isRouteComplete(globalLevel: number, route: TravelRoute) {
  return getRouteProgress(globalLevel, route) === route.countryIds.length;
}

export function routeCountries(route: TravelRoute) {
  return route.countryIds.map((id) => {
    const country = COUNTRY_BY_ID.get(id);
    if (!country) throw new Error(`Rota ülke kaydı bulunamadı: ${id}`);
    return country;
  });
}

export function routeLeg(route: TravelRoute, index: number): TravelLeg {
  return route.legs[index] ?? { label: '✈️ Uçak', distance: '≈ 1.000 km' };
}

export function resolveTravelLevel(globalLevel: number): TravelDestination {
  const normalizedLevel = Math.max(1, Math.floor(globalLevel));
  const masterTour = Math.floor((normalizedLevel - 1) / TOTAL_WORLD_LEVELS);
  const cycleLevel = ((normalizedLevel - 1) % TOTAL_WORLD_LEVELS) + 1;
  const countryIndex = Math.floor((cycleLevel - 1) / 20);
  const country = WORLD_COUNTRIES[countryIndex];
  const countryLevel = ((cycleLevel - 1) % 20) + 1;
  const countryChallenge = countryLevel === 20;
  const locationIndex = countryChallenge ? 3 : countryLevel <= 7 ? 0 : countryLevel <= 14 ? 1 : 2;
  const location = countryChallenge ? country.challenge : country.locations[locationIndex];
  const route = ROUTE_BY_ID.get(country.primaryRouteId) ?? TRAVEL_ROUTES[0];

  return {
    globalLevel: normalizedLevel,
    cycleLevel,
    masterTour,
    route,
    routeIndex: route.order - 1,
    routeCountryIndex: route.countryIds.indexOf(country.id),
    country,
    countryIndex,
    countryLevel,
    location,
    locationIndex,
    locationLevel: countryLevel - location.startLevel + 1,
    countryChallenge,
    worldTourFinal: normalizedLevel === TOTAL_WORLD_LEVELS,
  };
}

/**
 * Tamamlanan puzzle'ın seyahat hiyerarşisinde hangi sınırı geçtiğini katalogdan türetir.
 * UI metinleri, mevcut puzzle sıra numarasına bakarak şehir bitişi varsaymamalıdır.
 */
export function getTravelLevelCompletion(globalLevel: number): TravelLevelCompletion {
  const currentDestination = resolveTravelLevel(globalLevel);
  const nextDestination = resolveTravelLevel(globalLevel + 1);

  return {
    locationCompleted:
      !currentDestination.countryChallenge &&
      currentDestination.locationLevel === currentDestination.location.levelCount,
    countryCompleted:
      currentDestination.countryChallenge &&
      currentDestination.countryLevel === currentDestination.country.levelCount,
    worldTourCompleted: currentDestination.worldTourFinal,
    nextDestination,
  };
}

export function assertTravelCatalog() {
  if (TRAVEL_ROUTES.length !== 14) {
    throw new Error(`Dünya kataloğu 14 rota olmalı; bulunan: ${TRAVEL_ROUTES.length}`);
  }
  if (WORLD_COUNTRIES.length !== 100) {
    throw new Error(`Dünya kataloğu 100 ülke olmalı; bulunan: ${WORLD_COUNTRIES.length}`);
  }
  if (TOTAL_WORLD_LEVELS !== 2000) {
    throw new Error(`Ana tur 2.000 level olmalı; bulunan: ${TOTAL_WORLD_LEVELS}`);
  }
  if (TOTAL_DESTINATIONS !== 300) {
    throw new Error(`Dünya kataloğu 300 destinasyon olmalı; bulunan: ${TOTAL_DESTINATIONS}`);
  }

  const ids = new Set(WORLD_COUNTRIES.map((country) => country.id));
  if (ids.size !== WORLD_COUNTRIES.length) throw new Error('Ülke kimlikleri benzersiz olmalı.');

  TRAVEL_ROUTES.forEach((route) => {
    if (route.countryIds.length < 7 || route.countryIds.length > 8) {
      throw new Error(`${route.name}: rota 7–8 ülke içermeli.`);
    }
    if (route.legs.length !== route.countryIds.length - 1) {
      throw new Error(`${route.name}: her ülke geçişinin seyahat bağlantısı olmalı.`);
    }
    route.countryIds.forEach((countryId) => {
      if (!COUNTRY_BY_ID.has(countryId)) throw new Error(`${route.name}: ${countryId} bulunamadı.`);
    });
  });

  WORLD_COUNTRIES.forEach((country, index) => {
    if (country.worldIndex !== index || country.levelCount !== 20) {
      throw new Error(`${country.country}: dünya sırası veya level sayısı hatalı.`);
    }
    if (country.locations.length !== 3) {
      throw new Error(`${country.country}: tam üç destinasyon içermeli.`);
    }
    const counts = country.locations.map((location) => location.levelCount).join(',');
    const starts = country.locations.map((location) => location.startLevel).join(',');
    if (counts !== '7,7,5' || starts !== '1,8,15' || country.challenge.startLevel !== 20) {
      throw new Error(`${country.country}: beklenen 7+7+5+Challenge progression yapısına uymuyor.`);
    }
  });
}

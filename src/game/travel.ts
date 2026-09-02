import {
  countryContentImageUrl,
  routeContentImageUrl,
} from '../constants/content-images.ts';

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
  /** Aynı ülkenin farklı rota paketlerini tek pasaport altında birleştirir. */
  passportId: string;
  passportIndex: number;
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

type CountrySeedTuple = readonly [
  id: string,
  country: string,
  flag: string,
  locations: readonly [string, string, string],
  rewardLandmark?: string,
];

/**
 * Yeni ülke paketlerinde nesne biçimi tercih edilir. `passportId` verilirse aynı ülkenin
 * farklı şehir paketi bağımsız bir rota etabı olur, fakat koleksiyonda tek pasaport kazanır.
 */
type CountrySeedConfig = {
  id: string;
  passportId?: string;
  country: string;
  flag: string;
  locations: readonly [string, string, string];
  rewardLandmark?: string;
};

type CountrySeed = CountrySeedTuple | CountrySeedConfig;

type RouteSeed = {
  id: string;
  name: string;
  shortName: string;
  emoji: string;
  theme: string;
  countries: readonly CountrySeed[];
  modes: readonly string[];
};

const ROUTE_SEEDS: readonly RouteSeed[] = [
  {
    id: 'mediterranean-gateway',
    name: "Akdeniz'in Kapısı",
    shortName: 'Akdeniz',
    emoji: '🌊',
    theme: 'Turkuaz denizler, Akdeniz kasabaları ve gün batımı',
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
  {
    id: 'caribbean-treasures',
    name: 'Karayip Hazineleri',
    shortName: 'Karayipler',
    emoji: '🏝️',
    theme: 'Renkli ada kültürleri, mercan kıyıları ve Karayip ritimleri',
    modes: ['✈️ Uçak', '⛴️ Gemi', '⛴️ Gemi', '⛴️ Gemi', '⛴️ Gemi', '⛴️ Gemi'],
    countries: [
      ['cuba', 'Küba', '🇨🇺', ['Havana', 'Trinidad', 'Varadero'], 'Eski Havana'],
      ['jamaica', 'Jamaika', '🇯🇲', ['Kingston', 'Montego Bay', 'Ocho Rios'], "Dunn's River Şelaleleri"],
      ['dominican-republic', 'Dominik Cumhuriyeti', '🇩🇴', ['Santo Domingo', 'Puerto Plata', 'Punta Cana'], 'Kolonyal Şehir'],
      ['bahamas', 'Bahamalar', '🇧🇸', ['Nassau', 'Freeport', 'Exuma'], 'Exuma Adaları'],
      ['barbados', 'Barbados', '🇧🇧', ['Bridgetown', 'Bathsheba', 'Speightstown'], "Harrison's Cave"],
      ['trinidad-and-tobago', 'Trinidad & Tobago', '🇹🇹', ['Port of Spain', 'San Fernando', 'Scarborough'], 'Pigeon Point'],
      ['haiti', 'Haiti', '🇭🇹', ['Port-au-Prince', 'Cap-Haïtien', 'Jacmel'], 'Citadelle Laferrière'],
    ],
  },

  {
    id: 'central-america-guianas',
    name: 'Orta Amerika & Guyanalar',
    shortName: 'Orta Amerika',
    emoji: '🌴',
    theme: 'Maya izlerinden yağmur ormanlarına uzanan tropik geçit',
    modes: ['🚗 Araba', '🚗 Araba', '🚗 Araba', '🚗 Araba', '🚗 Araba', '✈️ Uçak'],
    countries: [
      ['belize', 'Belize', '🇧🇿', ['Belize City', 'San Ignacio', 'Caye Caulker'], 'Büyük Mavi Çukur'],
      ['honduras', 'Honduras', '🇭🇳', ['Tegucigalpa', 'Copán Ruinas', 'Roatán'], 'Copán'],
      ['el-salvador', 'El Salvador', '🇸🇻', ['San Salvador', 'Suchitoto', 'Santa Ana'], 'Çiçekler Rotası'],
      ['nicaragua', 'Nikaragua', '🇳🇮', ['Managua', 'Granada', 'León'], 'Ometepe Adası'],
      ['panama', 'Panama', '🇵🇦', ['Panama City', 'Boquete', 'Bocas del Toro'], 'Panama Kanalı'],
      ['guyana', 'Guyana', '🇬🇾', ['Georgetown', 'Kaieteur', 'Lethem'], 'Kaieteur Şelalesi'],
      ['suriname', 'Surinam', '🇸🇷', ['Paramaribo', 'Brownsberg', 'Galibi'], 'Tarihi Paramaribo'],
    ],
  },
  {
    id: 'heart-of-africa',
    name: "Afrika'nın Kalbi",
    shortName: "Afrika'nın Kalbi",
    emoji: '🦍',
    theme: 'Büyük göller, volkanlar ve ekvator ormanlarının vahşi kalbi',
    modes: ['🚗 Araba', '🚗 Araba', '✈️ Uçak', '🚗 Araba', '🚗 Araba', '🚗 Araba'],
    countries: [
      ['uganda', 'Uganda', '🇺🇬', ['Kampala', 'Jinja', 'Entebbe'], 'Bwindi Ormanı'],
      ['rwanda', 'Ruanda', '🇷🇼', ['Kigali', 'Musanze', 'Kibuye'], 'Volkanlar Milli Parkı'],
      ['dr-congo', 'Kongo Demokratik Cumhuriyeti', '🇨🇩', ['Kinşasa', 'Goma', 'Kisangani'], 'Virunga'],
      ['republic-of-congo', 'Kongo Cumhuriyeti', '🇨🇬', ['Brazzaville', 'Pointe-Noire', 'Ouesso'], 'Odzala Ormanı'],
      ['cameroon', 'Kamerun', '🇨🇲', ['Yaoundé', 'Douala', 'Buea'], 'Kamerun Dağı'],
      ['gabon', 'Gabon', '🇬🇦', ['Libreville', 'Lambaréné', 'Port-Gentil'], 'Loango Milli Parkı'],
      ['burundi', 'Burundi', '🇧🇮', ['Bujumbura', 'Gitega', 'Rumonge'], 'Tanganika Gölü'],
    ],
  },
  {
    id: 'west-africa',
    name: 'Batı Afrika',
    shortName: 'Batı Afrika',
    emoji: '🥁',
    theme: 'Atlantik kıyıları, kadim krallıklar ve canlı pazarlar',
    modes: ['✈️ Uçak', '🚗 Araba', '🚗 Araba', '✈️ Uçak', '🚗 Araba', '🚗 Araba'],
    countries: [
      ['nigeria', 'Nijerya', '🇳🇬', ['Lagos', 'Abuja', 'Calabar'], 'Zuma Kayası'],
      ['ivory-coast', 'Fildişi Sahili', '🇨🇮', ['Abidjan', 'Yamoussoukro', 'Grand-Bassam'], 'Barış Meryem Ana Bazilikası'],
      ['benin', 'Benin', '🇧🇯', ['Cotonou', 'Ouidah', 'Abomey'], 'Abomey Kraliyet Sarayları'],
      ['togo', 'Togo', '🇹🇬', ['Lomé', 'Kpalimé', 'Kara'], 'Koutammakou'],
      ['gambia', 'Gambiya', '🇬🇲', ['Banjul', 'Serrekunda', 'Janjanbureh'], 'Kunta Kinteh Adası'],
      ['guinea', 'Gine', '🇬🇳', ['Conakry', 'Kindia', 'Labé'], 'Fouta Djallon'],
      ['sierra-leone', 'Sierra Leone', '🇸🇱', ['Freetown', 'Bo', 'Kenema'], 'Tiwai Adası'],
    ],
  },
  {
    id: 'pacific-islands',
    name: 'Pasifik Adaları',
    shortName: 'Pasifik',
    emoji: '🌺',
    theme: 'Volkanik adalar, lagünler ve Büyük Okyanus kültürleri',
    modes: ['✈️ Uçak', '✈️ Uçak', '✈️ Uçak', '✈️ Uçak', '✈️ Uçak', '✈️ Uçak'],
    countries: [
      ['fiji', 'Fiji', '🇫🇯', ['Suva', 'Nadi', 'Levuka'], 'Mamanuca Adaları'],
      ['samoa', 'Samoa', '🇼🇸', ['Apia', "Savai'i", 'Lalomanu'], 'To Sua Okyanus Çukuru'],
      ['tonga', 'Tonga', '🇹🇴', ["Nuku'alofa", "Neiafu / Vava'u", "Pangai / Ha'apai"], "Vava'u Adaları"],
      ['vanuatu', 'Vanuatu', '🇻🇺', ['Port Vila', 'Luganville', 'Tanna'], 'Yasur Yanardağı'],
      ['solomon-islands', 'Solomon Adaları', '🇸🇧', ['Honiara', 'Gizo', 'Munda'], 'Marovo Lagünü'],
      ['kiribati', 'Kiribati', '🇰🇮', ['Güney Tarawa', 'Kiritimati', 'Abaiang'], 'Phoenix Adaları'],
      ['papua-new-guinea', 'Papua Yeni Gine', '🇵🇬', ['Port Moresby', 'Lae', 'Mount Hagen'], 'Kokoda Patikası'],
    ],
  },
  {
    id: 'north-america-arctic',
    name: 'Kuzey Amerika & Arktik',
    shortName: 'Arktik',
    emoji: '❄️',
    theme: 'Kuzey Atlantik adaları ve Kuzey Amerika’nın kutup etapları',
    modes: ['✈️ Uçak', '✈️ Uçak', '⛴️ Gemi', '✈️ Uçak', '✈️ Uçak', '✈️ Uçak'],
    countries: [
      ['iceland', 'İzlanda', '🇮🇸', ['Reykjavík', 'Akureyri', 'Vík'], 'Altın Çember'],
      ['greenland', 'Grönland', '🇬🇱', ['Nuuk', 'Ilulissat', 'Sisimiut'], 'Ilulissat Buz Fiyordu'],
      ['faroe-islands', 'Faroe Adaları', '🇫🇴', ['Tórshavn', 'Klaksvík', 'Gjógv'], 'Múlafossur Şelalesi'],
      {
        id: 'norway-svalbard',
        passportId: 'norway',
        country: 'Norveç · Svalbard',
        flag: '🇳🇴',
        locations: ['Longyearbyen', 'Barentsburg', 'Ny-Ålesund'],
        rewardLandmark: 'Arktik Vahşi Yaşamı',
      },
      {
        id: 'united-states-alaska',
        passportId: 'united-states',
        country: 'ABD · Alaska',
        flag: '🇺🇸',
        locations: ['Anchorage', 'Fairbanks', 'Juneau'],
        rewardLandmark: 'Denali',
      },
      {
        id: 'canada-yukon',
        passportId: 'canada',
        country: 'Kanada · Yukon',
        flag: '🇨🇦',
        locations: ['Whitehorse', 'Dawson City', 'Kluane'],
        rewardLandmark: 'Kluane Milli Parkı',
      },
      {
        id: 'canada-nunavut',
        passportId: 'canada',
        country: 'Kanada · Nunavut',
        flag: '🇨🇦',
        locations: ['Iqaluit', 'Rankin Inlet', 'Cambridge Bay'],
        rewardLandmark: 'Auyuittuq Milli Parkı',
      },
    ],
  },
  {
    id: 'hidden-africa',
    name: "Afrika'nın Saklı Hazineleri",
    shortName: 'Saklı Afrika',
    emoji: '🌍',
    theme: 'Atlantik yaylalarından Hint Okyanusu adalarına keşif',
    modes: ['✈️ Uçak', '🚗 Araba', '🚗 Araba', '✈️ Uçak', '✈️ Uçak', '✈️ Uçak'],
    countries: [
      ['angola', 'Angola', '🇦🇴', ['Luanda', 'Lubango', 'Benguela'], 'Kalandula Şelaleleri'],
      ['malawi', 'Malavi', '🇲🇼', ['Lilongwe', 'Blantyre', 'Nkhata Bay'], 'Malavi Gölü'],
      ['lesotho', 'Lesotho', '🇱🇸', ['Maseru', 'Semonkong', 'Butha-Buthe'], 'Maletsunyane Şelalesi'],
      ['eswatini', 'Esvatini', '🇸🇿', ['Mbabane', 'Lobamba', 'Manzini'], 'Mlilwane Koruma Alanı'],
      ['seychelles', 'Seyşeller', '🇸🇨', ['Victoria / Mahé', 'Praslin', 'La Digue'], "Anse Source d'Argent"],
      ['comoros', 'Komorlar', '🇰🇲', ['Moroni', 'Mutsamudu', 'Fomboni'], 'Karthala Dağı'],
      ['djibouti', 'Cibuti', '🇩🇯', ['Cibuti', 'Tadjoura', 'Ali Sabieh'], 'Assal Gölü'],
    ],
  },
] as const;

function normalizeCountrySeed(seed: CountrySeed): CountrySeedConfig {
  if (!Array.isArray(seed)) return seed as CountrySeedConfig;
  const [id, country, flag, locations, rewardLandmark] = seed as CountrySeedTuple;
  return { id, country, flag, locations, rewardLandmark };
}

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
const passportIndexById = new Map<string, number>();

export const TRAVEL_ROUTES: TravelRoute[] = ROUTE_SEEDS.map((seed, routeIndex) => {
  const order = routeIndex + 1;
  seed.countries.forEach((countrySeed, countryIndex) => {
    const {
      id,
      passportId = id,
      country,
      flag,
      locations: locationNames,
      rewardLandmark,
    } = normalizeCountrySeed(countrySeed);
    if (!passportIndexById.has(passportId)) {
      passportIndexById.set(passportId, passportIndexById.size);
    }
    const background = countryContentImageUrl(seed.id, id);
    const locations = makeLocations(id, locationNames, background);
    const isWorldTourFinal =
      routeIndex === ROUTE_SEEDS.length - 1 && countryIndex === seed.countries.length - 1;
    countries.push({
      id,
      passportId,
      passportIndex: passportIndexById.get(passportId) ?? 0,
      country,
      flag,
      primaryRouteId: seed.id,
      levelCount: 20,
      locations,
      challenge: {
        id: `${id}-country-challenge`,
        name: isWorldTourFinal ? 'WORLD TOUR FINAL' : `${country} Challenge`,
        emoji: isWorldTourFinal ? '🌍' : '🏆',
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
    countryIds: seed.countries.map((countrySeed) => normalizeCountrySeed(countrySeed).id),
    nextRouteIds: ROUTE_SEEDS[routeIndex + 1] ? [ROUTE_SEEDS[routeIndex + 1].id] : [],
    background: routeContentImageUrl(seed.id),
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
const listedPassportIds = new Set<string>();
export const PASSPORT_COUNTRIES = WORLD_COUNTRIES.filter((country) => {
  if (listedPassportIds.has(country.passportId)) return false;
  listedPassportIds.add(country.passportId);
  return true;
});
export const TOTAL_COUNTRY_STAGES = WORLD_COUNTRIES.length;
export const TOTAL_COUNTRIES = PASSPORT_COUNTRIES.length;
export const TOTAL_ROUTES = TRAVEL_ROUTES.length;
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

export function isPassportEarned(globalLevel: number, passportId: string) {
  return WORLD_COUNTRIES.some(
    (country) => country.passportId === passportId && isCountryComplete(globalLevel, country.id),
  );
}

export function getCompletedCountryCount(globalLevel: number) {
  return PASSPORT_COUNTRIES.filter((country) => isPassportEarned(globalLevel, country.passportId)).length;
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
    worldTourFinal: cycleLevel === TOTAL_WORLD_LEVELS,
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
  if (TOTAL_ROUTES < 20) {
    throw new Error(`Dünya kataloğu en az 20 rota içermeli; bulunan: ${TOTAL_ROUTES}`);
  }
  if (TOTAL_COUNTRY_STAGES < 140) {
    throw new Error(`Dünya kataloğu en az 140 ülke etabı içermeli; bulunan: ${TOTAL_COUNTRY_STAGES}`);
  }
  if (TOTAL_WORLD_LEVELS !== TOTAL_COUNTRY_STAGES * 20) {
    throw new Error(`Ana tur ülke etabı başına 20 level içermeli; bulunan: ${TOTAL_WORLD_LEVELS}`);
  }
  if (TOTAL_DESTINATIONS !== TOTAL_COUNTRY_STAGES * 3) {
    throw new Error(`Her ülke etabı üç destinasyon içermeli; bulunan: ${TOTAL_DESTINATIONS}`);
  }

  const ids = new Set(WORLD_COUNTRIES.map((country) => country.id));
  if (ids.size !== WORLD_COUNTRIES.length) throw new Error('Ülke kimlikleri benzersiz olmalı.');
  if (PASSPORT_COUNTRIES.some((country, index) => country.passportIndex !== index)) {
    throw new Error('Pasaport kimlikleri ve sıraları tutarlı olmalı.');
  }

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

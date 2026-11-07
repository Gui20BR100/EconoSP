/**
 * EconoSP - Sistema de Rotas, Pedágios e Monitoramento Rodoviário
 * Base do mapa: OpenStreetMap + Esri
 * Rotas pelas Ruas: Traçados reais conectados às avenidas e rodovias via OSRM Engine
 * Monitoramento Viário: Ocorrências de risco, lentidões com atraso, obras na pista, fiscalização e clima
 * Análise de Rota: Detecta ocorrências e pedágios no trajeto exato do usuário
 * Consulta de Placas LGPD: Decodifica modelo, ano, motor e consumo sem expor dados críticos
 */

// ================= CAMADAS DE MAPA (OpenStreetMap + Esri — sem chave de API) =================
const GOOGLE_TILE_LAYERS = {
  roadmap: {
    name: "Ruas (OSM)",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    options: { subdomains: ["a", "b", "c"], maxZoom: 19 }
  },
  satellite: {
    name: "Satélite (Esri)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a> World Imagery',
    options: { maxZoom: 19 }
  },
  hybrid: {
    name: "Satélite + Ruas",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a> World Street Map',
    options: { maxZoom: 19 }
  },
  terrain: {
    name: "Relevo (OpenTopoMap)",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    options: { subdomains: ["a", "b", "c"], maxZoom: 17 }
  }
};

// ================= BASE DE CONSULTA DE VEÍCULOS POR PLACA (SEM CHASSI / RENAVAM / LGPD) =================
const KNOWN_VEHICLES_DATABASE = {
  "BRA2E19": {
    brand: "Renault",
    model: "Kwid Zen 1.0 12V SCe",
    year: "2023/2023",
    color: "Branco Glaciar",
    fuel: "Flex (Álcool/Gasolina)",
    city: "São Paulo/SP",
    engine: "1.0 3 Cilindros 71cv",
    segment: "Subcompacto Econômico",
    ethanolKmPerL: 10.8,
    gasolineKmPerL: 15.3,
    tankSize: 38
  },
  "ABC1234": {
    brand: "Volkswagen",
    model: "Gol 1.6 MSI TotalFlex",
    year: "2020/2021",
    color: "Prata Sirius",
    fuel: "Flex (Álcool/Gasolina)",
    city: "São Bernardo do Campo/SP",
    engine: "1.6 8V 104cv",
    segment: "Hatch Popular",
    ethanolKmPerL: 9.8,
    gasolineKmPerL: 14.1,
    tankSize: 55
  },
  "RIO2A18": {
    brand: "Chevrolet",
    model: "Onix Hatch LT 1.0 MT",
    year: "2022/2023",
    color: "Cinza Satin Steel",
    fuel: "Flex (Álcool/Gasolina)",
    city: "Campinas/SP",
    engine: "1.0 12V 82cv",
    segment: "Hatch Compacto",
    ethanolKmPerL: 11.2,
    gasolineKmPerL: 16.7,
    tankSize: 44
  },
  "SPK9F88": {
    brand: "Hyundai",
    model: "HB20 Sense 1.0 Kappa",
    year: "2023/2024",
    color: "Preto Onix",
    fuel: "Flex (Álcool/Gasolina)",
    city: "São Paulo/SP",
    engine: "1.0 12V 80cv",
    segment: "Hatch Compacto",
    ethanolKmPerL: 10.4,
    gasolineKmPerL: 14.6,
    tankSize: 50
  },
  "COR2023": {
    brand: "Toyota",
    model: "Corolla Altis Híbrido 1.8",
    year: "2023/2024",
    color: "Branco Pérola",
    fuel: "Híbrido Flex (Elétrico/Álcool/Gasolina)",
    city: "Sorocaba/SP",
    engine: "1.8 16V VVT-i + Elétrico 122cv",
    segment: "Sedan Híbrido",
    ethanolKmPerL: 13.0,
    gasolineKmPerL: 17.8,
    tankSize: 43
  },
  "MOB1010": {
    brand: "Fiat",
    model: "Mobi Like 1.0 Fire EVO",
    year: "2022/2022",
    color: "Vermelho Montecarlo",
    fuel: "Flex (Álcool/Gasolina)",
    city: "Osasco/SP",
    engine: "1.0 8V 74cv",
    segment: "Subcompacto",
    ethanolKmPerL: 10.5,
    gasolineKmPerL: 14.9,
    tankSize: 47
  },
  "TIT1600": {
    brand: "Honda",
    model: "CG 160 Titan FlexOne",
    year: "2023/2024",
    color: "Azul Metálico",
    fuel: "Flex (Álcool/Gasolina)",
    city: "Santo André/SP",
    engine: "162.7cc OHC",
    segment: "Motocicleta",
    ethanolKmPerL: 28.0,
    gasolineKmPerL: 39.5,
    tankSize: 16
  }
};

// Motor determinístico de placas brasileiras (sempre preserva privacidade sem exibir chassi/renavam)
function lookupVehicleByPlate(rawPlate) {
  const clean = (rawPlate || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (clean.length < 5) return null;

  if (KNOWN_VEHICLES_DATABASE[clean]) {
    return { ...KNOWN_VEHICLES_DATABASE[clean], plate: clean };
  }

  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  hash = Math.abs(hash);

  const brands = [
    { brand: "Chevrolet", models: ["Onix 1.0 MT", "Tracker 1.0 Turbo", "Prisma 1.4 LT", "Spin 1.8 LTZ"], eth: 11.0, gas: 15.8, tank: 44, eng: "1.0 12V Flex 82cv" },
    { brand: "Volkswagen", models: ["Polo Track 1.0 MPI", "Gol 1.6 MSI", "T-Cross 1.0 TSI", "Virtus 1.6 MSI"], eth: 10.5, gas: 15.1, tank: 52, eng: "1.0 MPI 3 Cilindros 84cv" },
    { brand: "Fiat", models: ["Mobi Like 1.0", "Argo Drive 1.0", "Pulse 1.3 Drive", "Uno Mille Way 1.0"], eth: 10.5, gas: 14.9, tank: 47, eng: "1.0 Fire EVO 74cv" },
    { brand: "Renault", models: ["Kwid Zen 1.0 SCe", "Sandero 1.0 Zen", "Duster 1.6 Intense", "Logan 1.0 Life"], eth: 10.8, gas: 15.3, tank: 38, eng: "1.0 12V SCe 71cv" },
    { brand: "Hyundai", models: ["HB20 Sense 1.0", "Creta 1.0 TGDI", "HB20S 1.0 Comfort"], eth: 10.4, gas: 14.6, tank: 50, eng: "1.0 Kappa 12V 80cv" },
    { brand: "Toyota", models: ["Corolla XEi 2.0 Dynamic", "Yaris Hatch 1.5", "Corolla Cross Híbrido"], eth: 11.5, gas: 16.0, tank: 50, eng: "2.0 Dynamic Force 177cv" },
    { brand: "Honda", models: ["Civic EXL 2.0", "City Hatchback 1.5", "CG 160 Titan"], eth: 10.8, gas: 15.2, tank: 45, eng: "1.5 i-VTEC DOHC 126cv" }
  ];

  const colors = ["Branco Glaciar", "Prata Metálico", "Preto Vulcano", "Cinza Grafite", "Vermelho Rubi", "Azul Cósmico"];
  const cities = ["São Paulo/SP", "Campinas/SP", "São Bernardo do Campo/SP", "Santo André/SP", "Osasco/SP", "Sorocaba/SP", "Ribeirão Preto/SP", "Santos/SP", "São José dos Campos/SP"];
  const years = ["2019/2020", "2020/2021", "2021/2022", "2022/2023", "2023/2024"];

  const bObj = brands[hash % brands.length];
  const model = bObj.models[hash % bObj.models.length];
  const color = colors[hash % colors.length];
  const city = cities[hash % cities.length];
  const year = years[hash % years.length];

  return {
    plate: clean,
    brand: bObj.brand,
    model: model,
    year: year,
    color: color,
    fuel: "Flex (Álcool/Gasolina)",
    city: city,
    engine: bObj.eng,
    segment: "Passeio / Automóvel",
    ethanolKmPerL: bObj.eth,
    gasolineKmPerL: bObj.gas,
    tankSize: bObj.tank
  };
}

// ================= MEGA BANCO DE DADOS: PONTOS, RADARES, PEDÁGIOS E WAZE REAL =================
const POINTS_DATA = [
  // 1. ÁREAS DE RISCO / ASSALTO (WAZE HAZARD)
  {
    id: "waze-hz-01",
    name: "Área de Risco: Ponte das Bandeiras / Saída Marginal Tietê",
    highway: "Marginal Tietê (km 0 / Acesso Dutra e Ayrton Senna)",
    km: "km 0",
    category: "waze_hazard",
    lat: -23.5180,
    lng: -46.6280,
    wazeType: "Assalto / Quebra de Vidro",
    desc: "Ataques com pedras e quebra de vidros em semáforos e acessos noturnos. Celular fora de vista!",
    dangerTip: "PERIGO: Mantenha vidros totalmente fechados e não pare em acostamentos no trecho urbano.",
    economyTip: "Evite transitar de madrugada com bolsas à mostra."
  },
  {
    id: "waze-hz-02",
    name: "Área de Risco: Semáforos Av. do Estado / Tamanduateí",
    highway: "Av. do Estado (km 4 - Acesso Anchieta/Imigrantes)",
    km: "km 4",
    category: "waze_hazard",
    lat: -23.5650,
    lng: -46.6120,
    wazeType: "Arrastão / Abordagem em Semáforo",
    desc: "Histórico de abordagens rápidas por motocicletas sem placa com garupa nos cruzamentos.",
    dangerTip: "Mantenha o veículo sempre engatado e distância de 3 metros do carro da frente.",
    economyTip: "Use as faixas centrais de vias expressas."
  },
  {
    id: "waze-hz-03",
    name: "Área de Risco: Trecho Urbano Dutra km 222 (Guarulhos/Cumbica)",
    highway: "BR-116 Presidente Dutra",
    km: "km 222",
    category: "waze_hazard",
    lat: -23.4680,
    lng: -46.4950,
    wazeType: "Assalto no Acostamento Escuro",
    desc: "Assaltos a motoristas parados com pneu furado ou falha mecânica à noite.",
    dangerTip: "Se o pneu furar, rode devagar sobre a roda até o posto de combustível iluminado mais próximo.",
    economyTip: "Calibre com rigor os pneus antes de pegar a Dutra."
  },
  {
    id: "waze-hz-04",
    name: "Área de Risco: Pé da Serra / Piaçaguera em Cubatão",
    highway: "SP-055 / Conexão Anchieta-Imigrantes",
    km: "km 58",
    category: "waze_hazard",
    lat: -23.8850,
    lng: -46.4150,
    wazeType: "Assalto na Pista Lenta",
    desc: "Pedestres armados abordando veículos em lentidão nas alças de acesso a Cubatão e Santos.",
    dangerTip: "Siga direto pelas pistas centrais expressas sem entrar em alças desertas.",
    economyTip: "Faça paradas somente em postos de serviço estruturados."
  },
  {
    id: "waze-hz-05",
    name: "Área de Risco: Raposo Tavares km 14 (Butantã / Rio Pequeno)",
    highway: "SP-270 Raposo Tavares",
    km: "km 14",
    category: "waze_hazard",
    lat: -23.5780,
    lng: -46.7450,
    wazeType: "Furto em Semáforo",
    desc: "Aproximação de suspeitos no trânsito lento de saída da capital.",
    dangerTip: "Travas elétricas acionadas e bolsas obrigatoriamente no assoalho do veículo.",
    economyTip: "Mantenha velocidade constante para fugir de paradas desnecessárias."
  },
  {
    id: "waze-hz-06",
    name: "Área de Risco: Imigrantes km 12 (Diadema / Campanário)",
    highway: "SP-160 Imigrantes",
    km: "km 12",
    category: "waze_hazard",
    lat: -23.6680,
    lng: -46.6250,
    wazeType: "Pedrada de Passarela / Assalto",
    desc: "Casos de arremesso de objetos de passarelas para forçar o motorista a parar no acostamento.",
    dangerTip: "Se atingido, NUNCA pare imediatamente! Prossiga até o Posto da Polícia Rodoviária no km 28.",
    economyTip: "Transite pelas faixas centrais longe do acostamento."
  },
  {
    id: "waze-hz-07",
    name: "Área de Risco: Ayrton Senna km 28 (Itaquaquecetuba)",
    highway: "SP-070 Ayrton Senna",
    km: "km 28",
    category: "waze_hazard",
    lat: -23.4620,
    lng: -46.3680,
    wazeType: "Abordagem no Acostamento Noturno",
    desc: "Trecho ermo após o pedágio com histórico de tentativas de abordagem a carros parados.",
    dangerTip: "Em pane, acione imediatamente o 0800 da concessionária Ecopistas.",
    economyTip: "Revise a bateria antes de viajar."
  },
  {
    id: "waze-hz-08",
    name: "Área de Risco: Fernão Dias km 84 (Parque Novo Mundo)",
    highway: "BR-381 Fernão Dias",
    km: "km 84",
    category: "waze_hazard",
    lat: -23.4980,
    lng: -46.5680,
    wazeType: "Furtos Rápidos no Trânsito",
    desc: "Indivíduos a pé aproveitam filas matinais para quebrar vidros laterais.",
    dangerTip: "Não utilize celular em suportes colados no para-brisa nesta região.",
    economyTip: "Planeje a saída para antes das 06h30."
  },
  {
    id: "waze-hz-09",
    name: "Área de Risco: Rodoanel Sul km 56 (Parelheiros)",
    highway: "SP-021 Rodoanel Mário Covas",
    km: "km 56",
    category: "waze_hazard",
    lat: -23.7850,
    lng: -46.6850,
    wazeType: "Arremesso de Pedras Noturno",
    desc: "Trecho sem iluminação artificial com risco no acostamento após às 21h.",
    dangerTip: "Utilize faróis baixos com foco limpo e não desça do carro no acostamento.",
    economyTip: "Use o Rodoanel durante a luz do dia para evitar multas de rodízio."
  },
  {
    id: "waze-hz-10",
    name: "Área de Risco: Tamoios km 18 (Trevo São José dos Campos)",
    highway: "SP-099 Rodovia dos Tamoios",
    km: "km 18",
    category: "waze_hazard",
    lat: -23.2350,
    lng: -45.8620,
    wazeType: "Aproximação em Semáforo",
    desc: "Cruzamentos no trecho inicial de São José dos Campos com pedintes e abordagens.",
    dangerTip: "Mantenha portas travadas.",
    economyTip: "Prefira abastecer nos grandes postos da rodovia Carvalho Pinto antes."
  },

  // 2. TRÂNSITO PESADO E LENTIDÃO (WAZE JAM)
  {
    id: "waze-jm-01",
    name: "Lentidão Pesada: Planalto e Descida da Imigrantes",
    highway: "SP-160 Imigrantes",
    km: "km 42 ao km 54",
    category: "waze_jam",
    lat: -23.8750,
    lng: -46.5250,
    delay: "+45 min",
    delayMinutes: 45,
    desc: "Congestionamento intenso nos finais de semana e feriados no funil de descida da serra.",
    dangerTip: "Atenção a freadas bruscas. Mantenha 40 metros do veículo à frente.",
    economyTip: "Descendo no freio-motor (engatado), a injeção eletrônica reduz o consumo a ZERO!"
  },
  {
    id: "waze-jm-02",
    name: "Trânsito Intenso: Serra Velha da Anchieta",
    highway: "SP-150 Anchieta",
    km: "km 45 ao km 52",
    category: "waze_jam",
    lat: -23.8550,
    lng: -46.5050,
    delay: "+30 min",
    delayMinutes: 30,
    desc: "Lentidão provocada por caminhões pesados em comboio e pista molhada nas curvas.",
    dangerTip: "Proibido ultrapassar em curvas cegas.",
    economyTip: "Economize abastecendo antes em São Bernardo do Campo com Etanol a R$ 3,49."
  },
  {
    id: "waze-jm-03",
    name: "Lentidão Pesada: Afunilamento de Jundiaí (Anhanguera)",
    highway: "SP-330 Anhanguera",
    km: "km 58",
    category: "waze_jam",
    lat: -23.1950,
    lng: -46.9020,
    delay: "+20 min",
    delayMinutes: 20,
    desc: "A rodovia afunila de 3 para 2 faixas no trecho urbano de Jundiaí.",
    dangerTip: "ATENÇÃO: Radar de 80 km/h bem no afunilamento. Fique atento.",
    economyTip: "Tire o pé do acelerador com antecedência antes da placa de 80."
  },
  {
    id: "waze-jm-04",
    name: "Congestionamento: Ayrton Senna Acesso Aeroporto Guarulhos",
    highway: "SP-070 Ayrton Senna",
    km: "km 21 ao km 24",
    category: "waze_jam",
    lat: -23.4750,
    lng: -46.4750,
    delay: "+25 min",
    delayMinutes: 25,
    desc: "Retenção diária provocada pelo fluxo para o Aeroporto Internacional e Dutra.",
    dangerTip: "Fique atento a motos no corredor entre faixas 1 e 2.",
    economyTip: "Evite aceleradas e freadas constantes para não gastar 30% a mais de combustível."
  },
  {
    id: "waze-jm-05",
    name: "Trânsito Parado: Dutra Entroncamento Guarulhos",
    highway: "BR-116 Presidente Dutra",
    km: "km 212 ao km 218",
    category: "waze_jam",
    lat: -23.4650,
    lng: -46.5200,
    delay: "+30 min",
    delayMinutes: 30,
    desc: "Lentidão crônica nos horários de pico comercial no cruzamento com a Fernão Dias.",
    dangerTip: "Veículos entrando repentinamente de pistas locais.",
    economyTip: "Pela Ayrton Senna a pista é mais plana e economiza freios."
  },
  {
    id: "waze-jm-06",
    name: "Lentidão Crítica: Trevo de Alphaville e Barueri (Castelo)",
    highway: "SP-280 Castelo Branco",
    km: "km 21 ao km 26",
    category: "waze_jam",
    lat: -23.5050,
    lng: -46.8650,
    delay: "+35 min",
    delayMinutes: 35,
    desc: "Trânsito pesado com velocidade média abaixo de 20 km/h das 16h às 20h.",
    dangerTip: "Fila de acesso a Barueri invade a faixa da direita da pista expressa.",
    economyTip: "A rota alternativa pela Raposo Tavares elimina R$ 20,70 em pedágios e desvia daqui!"
  },
  {
    id: "waze-jm-07",
    name: "Fila de Espera: Afunilamento de Paraibuna (Tamoios)",
    highway: "SP-099 Rodovia dos Tamoios",
    km: "km 62",
    category: "waze_jam",
    lat: -23.4150,
    lng: -45.6850,
    delay: "+35 min",
    delayMinutes: 35,
    desc: "Fila de descida antes do acesso aos novos túneis expressos da serra.",
    dangerTip: "Velocidade rígida de 80 km/h fiscalizada por radares nos túneis.",
    economyTip: "Rota Econômica via Mogi-Bertioga foge dos pedágios de R$ 13,20 da Tamoios!"
  },
  {
    id: "waze-jm-08",
    name: "Congestionamento: Granja Viana e Cotia (Raposo)",
    highway: "SP-270 Raposo Tavares",
    km: "km 24 ao km 29",
    category: "waze_jam",
    lat: -23.5950,
    lng: -46.8650,
    delay: "+40 min",
    delayMinutes: 40,
    desc: "Tráfego urbano intenso até ultrapassar o km 34 em Cotia.",
    dangerTip: "Semáforos frequentes e travessia de pedestres.",
    economyTip: "Se sair antes das 06h30, a Raposo é totalmente livre e você economiza 2 pedágios."
  },
  {
    id: "waze-jm-09",
    name: "Lentidão de Praia: Serra da Mogi-Bertioga",
    highway: "SP-098 Rodovia Mogi-Bertioga",
    km: "km 82",
    category: "waze_jam",
    lat: -23.7850,
    lng: -46.1650,
    delay: "+30 min",
    delayMinutes: 30,
    desc: "Retenção na descida de serra de pista simples nos fins de semana ensolarados.",
    dangerTip: "Pista sinuosa. Nunca tente ultrapassar em faixa dupla contínua.",
    economyTip: "Zero pedágio nesta serra! Economia líquida no bolso."
  },
  {
    id: "waze-jm-10",
    name: "Tráfego Urbano: Rio-Santos Trecho São Sebastião",
    highway: "SP-055 Rodovia Rio-Santos",
    km: "km 112",
    category: "waze_jam",
    lat: -23.7950,
    lng: -45.5650,
    delay: "+25 min",
    delayMinutes: 25,
    desc: "Movimentação intensa de turistas, pedestres e ciclistas na orla.",
    dangerTip: "Radares de 40 km/h e 50 km/h em travessias urbanas.",
    economyTip: "Dirija em velocidade constante para economizar."
  },

  // 3. OBRAS NA PISTA (WAZE WORKS)
  {
    id: "waze-wk-01",
    name: "Obras de Recapeamento: Castelo Branco km 24",
    highway: "SP-280 Castelo Branco",
    km: "km 24",
    category: "waze_works",
    lat: -23.5080,
    lng: -46.8850,
    desc: "Obras de ampliação das pistas marginais de Barueri. Cones e homens na pista.",
    dangerTip: "Velocidade reduzida para 60 km/h. Multa gravíssima se desrespeitar operários.",
    economyTip: "Mude com antecedência para as faixas 1 ou 2."
  },
  {
    id: "waze-wk-02",
    name: "Obras de Contorno: Tamoios km 72 (Caraguatatuba)",
    highway: "SP-099 / Contorno Sul",
    km: "km 72",
    category: "waze_works",
    lat: -23.5850,
    lng: -45.4650,
    desc: "Obras de interligação dos novos contornos de Caraguá e São Sebastião. Meia pista.",
    dangerTip: "Desvios provisórios com brita solta no asfalto. Cuidado com o para-brisa.",
    economyTip: "Evite aceleração brusca para não projetar pedras no radiador."
  },
  {
    id: "waze-wk-03",
    name: "Obras Noturnas: Dutra km 208 (Arujá)",
    highway: "BR-116 Presidente Dutra",
    km: "km 208",
    category: "waze_works",
    lat: -23.4150,
    lng: -46.3350,
    desc: "Recapeamento asfáltico e fresagem pela CCR RioSP. Faixa central bloqueada.",
    dangerTip: "Degraus na pista durante as etapas de fresagem.",
    economyTip: "Mantenha pneus calibrados para não danificar as rodas."
  },
  {
    id: "waze-wk-04",
    name: "Obras de Encosta: Régis Bittencourt km 342 (Serra do Cafezal)",
    highway: "BR-116 Régis Bittencourt",
    km: "km 342",
    category: "waze_works",
    lat: -24.1150,
    lng: -47.2050,
    desc: "Contenção de encostas e drenagem de taludes. Tráfego canalizado em cones.",
    dangerTip: "Proibida ultrapassagem em toda a extensão do canteiro de obras.",
    economyTip: "Mantenha 3ª marcha para estabilidade."
  },
  {
    id: "waze-wk-05",
    name: "Manutenção de Viadutos: Carvalho Pinto km 92 (SJC)",
    highway: "SP-070 Carvalho Pinto",
    km: "km 92",
    category: "waze_works",
    lat: -23.2850,
    lng: -45.8950,
    desc: "Troca periódica de juntas de dilatação de pontes. Faixa 3 interditada.",
    dangerTip: "Sinalização com setas luminosas intermitentes.",
    economyTip: "Mantenha velocidade constante de 100 km/h nas faixas livres."
  },
  {
    id: "waze-wk-06",
    name: "Obras de Contenção: Mogi-Bertioga km 88",
    highway: "SP-098 Mogi-Bertioga",
    km: "km 88",
    category: "waze_works",
    lat: -23.8250,
    lng: -46.1550,
    desc: "Drenagem da serra com sistema de Pare e Siga operado pelo DER.",
    dangerTip: "Aguarde o sinal verde do operador com o freio de mão acionado.",
    economyTip: "Desligue o motor em paradas superiores a 3 minutos para poupar combustível."
  },

  // 4. POLÍCIA RODOVIÁRIA / BLITZ / COMANDOS (WAZE POLICE)
  {
    id: "waze-pol-01",
    name: "Comando PMRv: Base Carvalho Pinto km 72 (Jacareí)",
    highway: "SP-070 Carvalho Pinto",
    km: "km 72",
    category: "waze_police",
    lat: -23.3120,
    lng: -46.0250,
    desc: "Fiscalização ostensiva da Polícia Militar Rodoviária: faróis acesos, cinto e bafômetro.",
    dangerTip: "FARÓIS ACESOS OBRIGATÓRIOS: Multa de R$ 130,16 + 4 pontos.",
    economyTip: "Documento digital (CRLV e CNH) baixado offline no celular evita retenção."
  },
  {
    id: "waze-pol-02",
    name: "Posto PRF Arujá: Dutra km 204",
    highway: "BR-116 Presidente Dutra",
    km: "km 204",
    category: "waze_police",
    lat: -23.3980,
    lng: -46.3150,
    desc: "Posto da Polícia Rodoviária Federal com fiscalização 24h e balança de pesagem.",
    dangerTip: "Fiscalização minuciosa de conservação de pneus e películas/insulfilm.",
    economyTip: "Pneus sem desgaste excessivo poupam vidas e evitam guincho de R$ 400."
  },
  {
    id: "waze-pol-03",
    name: "Base PMRv Imigrantes km 28 (São Bernardo)",
    highway: "SP-160 Imigrantes",
    km: "km 28",
    category: "waze_police",
    lat: -23.7950,
    lng: -46.5550,
    desc: "Fiscalização antes dos primeiros túneis de descida da serra.",
    dangerTip: "Operação Lei Seca com etilômetro passivo nos finais de semana.",
    economyTip: "Mantenha passageiros traseiros de cinto para evitar multa de R$ 195,23."
  },
  {
    id: "waze-pol-04",
    name: "Base PMRv Ayrton Senna km 34 (Itaquaquecetuba)",
    highway: "SP-070 Ayrton Senna",
    km: "km 34",
    category: "waze_police",
    lat: -23.4680,
    lng: -46.3150,
    desc: "Fiscalização de velocidade com radares portáteis laser do tipo TruCam.",
    dangerTip: "O radar portátil mede velocidade a mais de 800 metros de distância!",
    economyTip: "Mantenha o limitador do Kwid/Onix travado em 115 km/h."
  },
  {
    id: "waze-pol-05",
    name: "Base PMRv Tamoios km 58 (Paraibuna)",
    highway: "SP-099 Rodovia dos Tamoios",
    km: "km 58",
    category: "waze_police",
    lat: -23.3950,
    lng: -45.6650,
    desc: "Posto policial logo antes da praça de pedágio de Paraibuna.",
    dangerTip: "Vistoria de extintor (veículos comerciais), luzes de freio e placas limpas.",
    economyTip: "Verifique se a luz de placa traseira está funcionando."
  },
  {
    id: "waze-pol-06",
    name: "Base PMRv Castelo Branco km 41 (Santana de Parnaíba)",
    highway: "SP-280 Castelo Branco",
    km: "km 41",
    category: "waze_police",
    lat: -23.4650,
    lng: -47.0150,
    desc: "Comando policial estratégico no final do trecho mais veloz da rodovia.",
    dangerTip: "Controle estrito de velocidade e ultrapassagens pelo acostamento.",
    economyTip: "Andar pelo acostamento gera multa gravíssima de R$ 880,41."
  },

  // 5. CLIMA ADVERSO E NEBLINA (WAZE WEATHER)
  {
    id: "waze-wt-01",
    name: "Neblina Densa: Serra do Mar na Imigrantes",
    highway: "SP-160 Imigrantes",
    km: "km 45 ao km 55",
    category: "waze_weather",
    lat: -23.8950,
    lng: -46.5250,
    desc: "Visibilidade reduzida a menos de 40 metros pela manhã e no final da tarde.",
    dangerTip: "NUNCA ligue o pisca-alerta em movimento. Isso confunde quem vem atrás achando que você está parado.",
    economyTip: "Acenda faróis de neblina ou baixos e dobre a distância de seguimento."
  },
  {
    id: "waze-wt-02",
    name: "Neblina Densa: Serra da Cantareira (Fernão Dias)",
    highway: "BR-381 Fernão Dias",
    km: "km 72 ao km 78",
    category: "waze_weather",
    lat: -23.3750,
    lng: -46.5950,
    desc: "Nevoeiro espesso de montanha com pista fria e escorregadia.",
    dangerTip: "Farol alto reflete nas gotículas e causa efeito de parede branca cegando o motorista.",
    economyTip: "Reduza suavemente a velocidade para 60 km/h."
  },
  {
    id: "waze-wt-03",
    name: "Nevoeiro e Chuva: Serra dos Tamoios km 68",
    highway: "SP-099 Rodovia dos Tamoios",
    km: "km 68",
    category: "waze_weather",
    lat: -23.4750,
    lng: -45.6250,
    desc: "Neblina forte nos trechos de transição entre viadutos e encostas.",
    dangerTip: "Risco de aquaplanagem nas descidas. Evite movimentos bruscos no volante.",
    economyTip: "Verifique as palhetas do limpador de para-brisa antes de descer."
  },
  {
    id: "waze-wt-04",
    name: "Cerração: Serra da Mogi-Bertioga km 80",
    highway: "SP-098 Mogi-Bertioga",
    km: "km 80 ao km 86",
    category: "waze_weather",
    lat: -23.7950,
    lng: -46.1600,
    desc: "Cerração repentina na descida em direção à planície litorânea.",
    dangerTip: "Pista simples com curvas fechadas em cotovelo.",
    economyTip: "Use 2ª marcha engatada para segurar o carro sem ferver os freios."
  },

  // 6. PEDÁGIOS REAIS DAS PRINCIPAIS RODOVIAS DE SP
  {
    id: "tol-01",
    name: "Pedágio Piratininga (Imigrantes km 32)",
    highway: "SP-160 Imigrantes",
    km: "km 32",
    category: "toll",
    lat: -23.8210,
    lng: -46.5410,
    price: "R$ 36,80",
    priceNum: 36.80,
    desc: "Cobrado apenas no sentido litoral. O retorno para São Paulo é livre de pedágio.",
    dangerTip: "Evasão de cancela automática: Multa de R$ 195,23 + 5 pontos na CNH.",
    economyTip: "Na volta para SP não há pedágio nem na Imigrantes nem na Anchieta!"
  },
  {
    id: "tol-02",
    name: "Pedágio Riacho Grande (Anchieta km 31)",
    highway: "SP-150 Anchieta",
    km: "km 31",
    category: "toll",
    lat: -23.7760,
    lng: -46.5370,
    price: "R$ 36,80",
    priceNum: 36.80,
    desc: "Mesma tarifa integrada do Sistema Anchieta-Imigrantes na descida.",
    dangerTip: "Pistas automáticas de Tag (Sem Parar/ConectCar) com limite de 40 km/h.",
    economyTip: "Abasteça com Etanol em SBC no km 19 antes da praça para economizar."
  },
  {
    id: "tol-03",
    name: "Pedágio Itaquaquecetuba (Ayrton Senna km 32)",
    highway: "SP-070 Ayrton Senna",
    km: "km 32",
    category: "toll",
    lat: -23.4730,
    lng: -46.3310,
    price: "R$ 5,60",
    priceNum: 5.60,
    desc: "Cobrado em ambos os sentidos da rodovia.",
    dangerTip: "Aproxime-se com calma da cabine de cobrança manual.",
    economyTip: "Seguindo pela Mogi-Bertioga você só paga esse pedágio até chegar no mar!"
  },
  {
    id: "tol-04",
    name: "Pedágio Guararema (Ayrton Senna km 57)",
    highway: "SP-070 Ayrton Senna",
    km: "km 57",
    category: "toll",
    lat: -23.4080,
    lng: -46.1420,
    price: "R$ 5,20",
    priceNum: 5.20,
    desc: "Praça antes da transição para a Rodovia Carvalho Pinto.",
    dangerTip: "Velocidade na aproximação da praça.",
    economyTip: "Rota Econômica via Mogi das Cruzes desvia dessa praça e economiza R$ 5,20!"
  },
  {
    id: "tol-05",
    name: "Pedágio São José dos Campos (Carvalho Pinto km 92)",
    highway: "SP-070 Carvalho Pinto",
    km: "km 92",
    category: "toll",
    lat: -23.2840,
    lng: -45.8940,
    price: "R$ 5,10",
    priceNum: 5.10,
    desc: "Cobrado nos sentidos Litoral/Rio e Capital.",
    dangerTip: "Atenção a motocicletas no acostamento perto da praça.",
    economyTip: "Mais uma praça que você elimina ao usar a Rota Econômica pela Mogi-Bertioga."
  },
  {
    id: "tol-06",
    name: "Pedágio Paraibuna (Tamoios km 59)",
    highway: "SP-099 Rodovia dos Tamoios",
    km: "km 59",
    category: "toll",
    lat: -23.3850,
    lng: -45.6550,
    price: "R$ 13,20",
    priceNum: 13.20,
    desc: "Praça do trecho de planalto da Tamoios antes dos novos túneis.",
    dangerTip: "Aceita dinheiro, cartões de débito/crédito por aproximação e Tags.",
    economyTip: "Pedágio pesado! Somando ida e volta são R$ 26,40 só nesta cabine."
  },
  {
    id: "tol-07",
    name: "Pedágio Jambeiro (Tamoios km 28)",
    highway: "SP-099 Rodovia dos Tamoios",
    km: "km 28",
    category: "toll",
    lat: -23.3150,
    lng: -45.7520,
    price: "R$ 6,20",
    priceNum: 6.20,
    desc: "Primeira praça da rodovia no sentido Litoral Norte.",
    dangerTip: "Reduza a velocidade na aproximação da praça.",
    economyTip: "Juntas, as duas praças da Tamoios custam R$ 19,40 por trecho."
  },
  {
    id: "tol-08",
    name: "Pedágio Itapevi (Castelo Branco km 33)",
    highway: "SP-280 Castelo Branco",
    km: "km 33",
    category: "toll",
    lat: -23.4980,
    lng: -46.9620,
    price: "R$ 11,80",
    priceNum: 11.80,
    desc: "Praça principal sentido Interior / Sorocaba.",
    dangerTip: "Cobrança rápida nas pistas automáticas.",
    economyTip: "Indo pela Raposo Tavares você não paga essa praça de R$ 11,80!"
  },
  {
    id: "tol-09",
    name: "Pedágio Itu (Castelo Branco km 74)",
    highway: "SP-280 Castelo Branco",
    km: "km 74",
    category: "toll",
    lat: -23.3850,
    lng: -47.2850,
    price: "R$ 15,20",
    priceNum: 15.20,
    desc: "Praça após o acesso a Sorocaba e Itu.",
    dangerTip: "Fique atento ao limite de 40 km/h nas cabines automáticas.",
    economyTip: "Tarifa altíssima! Total na Castelo chega a R$ 32,90 só de pedágio."
  },
  {
    id: "tol-10",
    name: "Pedágio São Roque (Raposo Tavares km 46)",
    highway: "SP-270 Raposo Tavares",
    km: "km 46",
    category: "toll",
    lat: -23.5850,
    lng: -47.0510,
    price: "R$ 12,20",
    priceNum: 12.20,
    desc: "Único pedágio no trecho da Raposo até Sorocaba.",
    dangerTip: "Pista em aclive suave antes da praça.",
    economyTip: "Pague apenas R$ 12,20 contra R$ 32,90 da Castelo. Economia direta de R$ 20,70!"
  },
  {
    id: "tol-11",
    name: "Pedágio Caieiras (Bandeirantes km 36)",
    highway: "SP-348 Rodovia dos Bandeirantes",
    km: "km 36",
    category: "toll",
    lat: -23.3250,
    lng: -46.8350,
    price: "R$ 12,40",
    priceNum: 12.40,
    desc: "Praça sentido Jundiaí e Campinas.",
    dangerTip: "Pista expressa a 120 km/h: comece a desacelerar a 1 km da praça.",
    economyTip: "Pela Anhanguera a distância é similar com paradas em postos de combustível mais baratos."
  },
  {
    id: "tol-12",
    name: "Pedágio Itupeva (Bandeirantes km 77)",
    highway: "SP-348 Rodovia dos Bandeirantes",
    km: "km 77",
    category: "toll",
    lat: -23.1650,
    lng: -47.0550,
    price: "R$ 12,20",
    priceNum: 12.20,
    desc: "Praça antes de Campinas.",
    dangerTip: "Radares de fiscalização logo após as cancelas.",
    economyTip: "Rota alternativa de fuga via Rodoanel e Jundiaí."
  },
  {
    id: "tol-13",
    name: "Pedágio Arujá (Dutra km 204)",
    highway: "BR-116 Presidente Dutra",
    km: "km 204",
    category: "toll",
    lat: -23.3980,
    lng: -46.3150,
    price: "R$ 4,10",
    priceNum: 4.10,
    desc: "Primeira praça da CCR RioSP no sentido Rio de Janeiro e Vale do Paraíba.",
    dangerTip: "Free Flow em implantação: se passar em pista sem cancela, pague pelo app em 15 dias.",
    economyTip: "Tarifa mais barata que as rodovias estaduais concorrentes."
  },
  {
    id: "tol-14",
    name: "Pedágio Rodoanel Sul (km 67 Imigrantes)",
    highway: "SP-021 Rodoanel Mário Covas",
    km: "km 67",
    category: "toll",
    lat: -23.7710,
    lng: -46.5620,
    price: "R$ 4,30",
    priceNum: 4.30,
    desc: "Acesso entre o Trecho Sul do Rodoanel e o Sistema Anchieta-Imigrantes.",
    dangerTip: "Atenção a caminhões em manobra nas alças.",
    economyTip: "Excelente rota de fuga do Rodízio Municipal do Centro Expandido de SP!"
  },

  // 7. RADARES CRÍTICOS COM LIMITE E DICAS ANTI-MULTA
  {
    id: "rad-01",
    name: "Radar Marginal Tietê Ponte das Bandeiras",
    highway: "Marginal Tietê (Pista Expressa km 0)",
    km: "km 0",
    category: "radar",
    lat: -23.5180,
    lng: -46.6280,
    speed: "70 km/h (Expressa) / 50 km/h (Local)",
    desc: "Fiscalização eletrônica por laços no asfalto com leitura de placas para Rodízio de SP.",
    dangerTip: "DUPLO RISCO: Multa de excesso de velocidade + Multa de Rodízio de R$ 130,16.",
    economyTip: "Mantenha rigorosamente 65 km/h no velocímetro do carro."
  },
  {
    id: "rad-02",
    name: "Radar Marginal Pinheiros Ponte Cidade Jardim",
    highway: "Marginal Pinheiros (Pista Expressa)",
    km: "km 5",
    category: "radar",
    lat: -23.5850,
    lng: -46.6950,
    speed: "70 km/h",
    desc: "Radar sob a passarela de pedestres. Ponto campeão de infrações de trânsito em SP.",
    dangerTip: "Multa de R$ 130 a R$ 880 se ultrapassar a velocidade permitida.",
    economyTip: "Evite frear em cima do radar: mantenha o carro em velocidade constante."
  },
  {
    id: "rad-03",
    name: "Radar Imigrantes km 18 (Diadema)",
    highway: "SP-160 Imigrantes",
    km: "km 18",
    category: "radar",
    lat: -23.7050,
    lng: -46.5820,
    speed: "90 km/h",
    desc: "Radar instalado logo após a passarela no trecho em descida suave.",
    dangerTip: "O carro ganha velocidade facilmente no declive: fique de olho no velocímetro.",
    economyTip: "Use freio-motor de 5ª marcha para conter a velocidade sem gastar pastilha."
  },
  {
    id: "rad-04",
    name: "Radar Descida de Serra da Imigrantes km 42",
    highway: "SP-160 Imigrantes",
    km: "km 42",
    category: "radar",
    lat: -23.8680,
    lng: -46.5350,
    speed: "80 km/h",
    desc: "Controle estrito de velocidade na transição da pista plana para a serra sinuosa.",
    dangerTip: "Risco alto de perda de freios por superaquecimento se descer em ponto morto.",
    economyTip: "Descer engatado poupa 100% de freio e combustível."
  },
  {
    id: "rad-05",
    name: "Radar Anchieta km 23 (São Bernardo)",
    highway: "SP-150 Rodovia Anchieta",
    km: "km 23",
    category: "radar",
    lat: -23.7250,
    lng: -46.5520,
    speed: "80 km/h",
    desc: "Radar fixo no trecho urbano de São Bernardo do Campo.",
    dangerTip: "Pedestres e ônibus em manobra.",
    economyTip: "Respeite os 80 km/h e aproveite para abastecer no posto próximo."
  },
  {
    id: "rad-06",
    name: "Radar Ayrton Senna km 22 (Acesso Cumbica)",
    highway: "SP-070 Ayrton Senna",
    km: "km 22",
    category: "radar",
    lat: -23.4750,
    lng: -46.4520,
    speed: "100 km/h",
    desc: "A rodovia vem a 120 km/h e o limite cai para 100 km/h neste trecho urbano!",
    dangerTip: "QUEDA ABRUPTA DE VELOCIDADE: Reduza antes de avistar o pórtico.",
    economyTip: "Tire o pé 500 metros antes para desacelerar com inércia natural."
  },
  {
    id: "rad-07",
    name: "Radar Tamoios km 68 (Novos Túneis Expressos)",
    highway: "SP-099 Rodovia dos Tamoios",
    km: "km 68",
    category: "radar",
    lat: -23.4850,
    lng: -45.5820,
    speed: "80 km/h (Controle Rígido)",
    desc: "Câmeras de controle de velocidade e monitoramento 24h dentro do maior túnel rodoviário do Brasil.",
    dangerTip: "Proibido parar no acostamento do túnel a menos que seja emergência extrema.",
    economyTip: "Mantenha o Kwid/Onix em 4ª marcha a 80 km/h cravados."
  },
  {
    id: "rad-08",
    name: "Radar Serra de Jundiaí km 58 (Anhanguera)",
    highway: "SP-330 Anhanguera",
    km: "km 58",
    category: "radar",
    lat: -23.1950,
    lng: -46.9020,
    speed: "80 km/h (ARMADILHA CLÁSSICA)",
    desc: "A rodovia permite 110 km/h e cai repentinamente para 80 km/h na descida da serra de Jundiaí!",
    dangerTip: "ALTA INCIDÊNCIA DE AUTUAÇÕES: Reduza imediatamente ao avistar a sinalização de 80 km/h.",
    economyTip: "Não espere ver o radar: viu a placa de 80 km/h, reduza imediatamente."
  },
  {
    id: "rad-09",
    name: "Radar Granja Viana km 23 (Raposo Tavares)",
    highway: "SP-270 Raposo Tavares",
    km: "km 23",
    category: "radar",
    lat: -23.5910,
    lng: -46.8520,
    speed: "60 km/h",
    desc: "Trecho urbano movimentado com múltiplos semáforos e comércio.",
    dangerTip: "Câmeras fiscalizam também avanço de sinal vermelho.",
    economyTip: "Respeite os 60 km/h para não ter que frear bruscamente nos semáforos."
  },
  {
    id: "rad-10",
    name: "Radar Descida Mogi-Bertioga km 85",
    highway: "SP-098 Mogi-Bertioga",
    km: "km 85",
    category: "radar",
    lat: -23.8050,
    lng: -46.1550,
    speed: "40 km/h (Curva Perigosa)",
    desc: "Radar instalado estrategicamente na curva mais fechada da descida da serra.",
    dangerTip: "Curva com histórico de tombamento de veículos se ultrapassar 45 km/h.",
    economyTip: "Passe em 2ª marcha com o freio-motor atuando para não queimar as pastilhas."
  },
  {
    id: "rad-11",
    name: "Radar Rio-Santos km 116 (São Sebastião)",
    highway: "SP-055 Rodovia Rio-Santos",
    km: "km 116",
    category: "radar",
    lat: -23.7850,
    lng: -45.5250,
    speed: "60 km/h",
    desc: "Fiscalização em travessia de pedestres de praias.",
    dangerTip: "Atenção constante a ciclistas e banhistas na pista.",
    economyTip: "Mantenha velocidade moderada constante."
  },

  // 8. POSTOS BARATOS COM PARADAS ESTRATÉGICAS
  {
    id: "gas-01",
    name: "Auto Posto Campeão Imigrantes (São Bernardo do Campo)",
    highway: "SP-160 Imigrantes",
    km: "km 19",
    category: "gas",
    lat: -23.7120,
    lng: -46.5750,
    fuelPrice: "Etanol: R$ 3,49 | Gasolina: R$ 5,39",
    desc: "Último posto com combustível a preço de atacado antes da serra. R$ 0,70 mais barato por litro que na praia!",
    economyTip: "Encha o tanque aqui e economize até R$ 35,00 por abastecimento antes de chegar em Santos/Litoral."
  },
  {
    id: "gas-02",
    name: "Auto Posto Graal 56 Anhanguera (Jundiaí)",
    highway: "SP-330 Anhanguera",
    km: "km 56",
    category: "gas",
    lat: -23.2350,
    lng: -46.8650,
    fuelPrice: "Etanol: R$ 3,39 | Gasolina: R$ 5,29",
    desc: "Combustível mais barato do corredor norte com ampla estrutura de lanchonete e banheiros limpos.",
    economyTip: "Excelente ponto para tomar um café e abastecer com o menor preço do estado."
  },
  {
    id: "gas-03",
    name: "Posto Petrobras Mogi-Dutra (Mogi das Cruzes)",
    highway: "SP-088 Mogi-Dutra",
    km: "km 41",
    category: "gas",
    lat: -23.4850,
    lng: -46.2350,
    fuelPrice: "Etanol: R$ 3,42 | Gasolina: R$ 5,32",
    desc: "Ponto estratégico da Rota Econômica antes da descida da serra de Mogi-Bertioga.",
    economyTip: "No litoral norte o combustível custa mais de R$ 4,19 (Etanol). Abasteça aqui!"
  },
  {
    id: "gas-04",
    name: "Posto Ipiranga Dutra km 214 (Guarulhos)",
    highway: "BR-116 Presidente Dutra",
    km: "km 214",
    category: "gas",
    lat: -23.4620,
    lng: -46.5120,
    fuelPrice: "Etanol: R$ 3,45 | Gasolina: R$ 5,35",
    desc: "Grande posto 24 horas seguro e bem iluminado com loja de conveniência completa.",
    economyTip: "Evite paradas no acostamento escuro: faça tudo aqui com segurança."
  },
  {
    id: "gas-05",
    name: "Frango Assado Carvalho Pinto km 94 (São José dos Campos)",
    highway: "SP-070 Carvalho Pinto",
    km: "km 94",
    category: "gas",
    lat: -23.2820,
    lng: -45.8820,
    fuelPrice: "Etanol: R$ 3,69 | Gasolina: R$ 5,59",
    desc: "Parada clássica de viajantes com praça de alimentação completa e segurança privada 24h.",
    economyTip: "Parada ideal para esticar as pernas e checar a pressão dos pneus gratuitamente."
  }
];

// Base rápida de geocodificação offline para municípios e pontos de SP
const LOCAL_GEOCODE_CACHE = {
  "sao paulo": [-23.5505, -46.6333],
  "sp": [-23.5505, -46.6333],
  "centro": [-23.5505, -46.6333],
  "se": [-23.5505, -46.6333],
  "paulista": [-23.5615, -46.6559],
  "av paulista": [-23.5615, -46.6559],
  "tatuape": [-23.5385, -46.5760],
  "santana": [-23.5040, -46.6270],
  "pinheiros": [-23.5670, -46.6930],
  "guarulhos": [-23.4628, -46.5333],
  "santo andre": [-23.6638, -46.5383],
  "sao bernardo": [-23.6914, -46.5646],
  "diadema": [-23.6865, -46.6228],
  "osasco": [-23.5325, -46.7917],
  "caragua": [-23.6229, -45.4128],
  "caraguatatuba": [-23.6229, -45.4128],
  "ubatuba": [-23.4339, -45.0839],
  "sao sebastiao": [-23.8050, -45.4050],
  "ilhabela": [-23.7780, -45.3580],
  "bertioga": [-23.8540, -46.1380],
  "santos": [-23.9535, -46.3350],
  "praia grande": [-24.0058, -46.4028],
  "guaruja": [-23.9930, -46.2564],
  "mongagua": [-24.0930, -46.6210],
  "itanhaem": [-24.1830, -46.7890],
  "peruibe": [-24.3210, -46.9980],
  "campinas": [-22.9099, -47.0626],
  "sorocaba": [-23.5015, -47.4521],
  "itu": [-23.2640, -47.2990],
  "sao roque": [-23.5280, -47.1350],
  "cotia": [-23.6030, -46.9180],
  "jundiai": [-23.1857, -46.8978],
  "atibaia": [-23.1170, -46.5560],
  "braganca paulista": [-22.9520, -46.5410],
  "extrema": [-22.8550, -46.3200],
  "sao jose dos campos": [-23.1896, -45.8841],
  "sjc": [-23.1896, -45.8841],
  "taubate": [-23.0264, -45.5553],
  "aparecida": [-22.8465, -45.2289],
  "campos do jordao": [-22.7394, -45.5914]
};

// ================= CORREDORES RODOVIÁRIOS REAIS DE FALLBACK (OFFLINE) =================
// Geometrias com nós reais pelas rodovias de SP para garantir que mesmo offline
// o traçado NUNCA corte montanhas ou gere curvas matemáticas falsas!
const REAL_HIGHWAY_CORRIDORS = {
  // Rota Expressa para Caraguatatuba via Ayrton Senna, Carvalho Pinto e Tamoios
  sp_to_caragua_fast: [
    [-23.5505, -46.6333], [-23.5250, -46.5950], [-23.5050, -46.5450], [-23.4750, -46.4650],
    [-23.4730, -46.3310], [-23.4450, -46.2250], [-23.4080, -46.1420], [-23.3650, -46.0650],
    [-23.3120, -46.0250], [-23.2840, -45.8940], [-23.2450, -45.8520], [-23.3150, -45.7520],
    [-23.3850, -45.6550], [-23.4450, -45.6150], [-23.4850, -45.5820], [-23.5450, -45.5150],
    [-23.5850, -45.4650], [-23.6229, -45.4128]
  ],
  // Rota Econômica Fuga de Pedágio para Caraguatatuba via Mogi das Cruzes, SP-098 Mogi-Bertioga e SP-055 Rio-Santos
  sp_to_caragua_econ: [
    [-23.5505, -46.6333], [-23.5350, -46.5450], [-23.5250, -46.4350], [-23.5350, -46.3150],
    [-23.5250, -46.1850], [-23.6150, -46.1850], [-23.6650, -46.1820], [-23.7250, -46.1720],
    [-23.7850, -46.1650], [-23.8250, -46.1550], [-23.8540, -46.1380], [-23.8450, -46.0150],
    [-23.8150, -45.8550], [-23.7950, -45.6850], [-23.7850, -45.5250], [-23.7650, -45.4350],
    [-23.6229, -45.4128]
  ],
  // Rota Expressa Santos via Imigrantes
  sp_to_santos_fast: [
    [-23.5505, -46.6333], [-23.5950, -46.6350], [-23.6680, -46.6250], [-23.7050, -46.5820],
    [-23.7710, -46.5620], [-23.8210, -46.5410], [-23.8750, -46.5250], [-23.9150, -46.5150],
    [-23.9450, -46.4350], [-23.9535, -46.3350]
  ],
  // Rota Econômica Santos via Anchieta (SBC e Abastecimento Barato)
  sp_to_santos_econ: [
    [-23.5505, -46.6333], [-23.5850, -46.6150], [-23.6650, -46.5750], [-23.7120, -46.5750],
    [-23.7760, -46.5370], [-23.8450, -46.5150], [-23.8850, -46.4150], [-23.9450, -46.3650],
    [-23.9535, -46.3350]
  ],
  // Rota Expressa Sorocaba via Castelo Branco
  sp_to_sorocaba_fast: [
    [-23.5505, -46.6333], [-23.5250, -46.7250], [-23.5180, -46.8120], [-23.5080, -46.8850],
    [-23.4980, -46.9620], [-23.4650, -47.1250], [-23.4150, -47.2850], [-23.4450, -47.3850],
    [-23.5015, -47.4521]
  ],
  // Rota Econômica Sorocaba via Raposo Tavares (Apenas 1 pedágio)
  sp_to_sorocaba_econ: [
    [-23.5505, -46.6333], [-23.5780, -46.7450], [-23.5910, -46.8520], [-23.6020, -46.9150],
    [-23.6150, -46.9620], [-23.5850, -47.0510], [-23.5450, -47.2150], [-23.5250, -47.3550],
    [-23.5015, -47.4521]
  ]
};

// ================= ESTADO GLOBAL DA APLICAÇÃO =================
const AppState = {
  map: null,
  activeLayerKey: "roadmap",
  tileLayers: {},
  markersLayer: null,
  routePolyline: null,
  originMarker: null,
  destMarker: null,
  simVehicleMarker: null,
  
  originCoords: [-23.5505, -46.6333],
  destCoords: [-23.6229, -45.4128],
  originText: "São Paulo, SP",
  destText: "Caraguatatuba, SP",
  
  routesData: {
    economy: { waypoints: [], distanceKm: 168, baseDurationMin: 155, durationMin: 155, tollsCost: 5.60, wazeDelayMin: 0, description: "Via Mogi-Bertioga e Rio-Santos (Fuga dos 3 pedágios da Carvalho Pinto e Tamoios!)", color: "#10b981", onRoutePoints: [] },
    fast: { waypoints: [], distanceKm: 176, baseDurationMin: 125, durationMin: 155, tollsCost: 30.30, wazeDelayMin: 30, description: "Via Ayrton Senna, Carvalho Pinto e Nova Tamoios (Pistas duplas, túneis e pedágios cheios)", color: "#4285f4", onRoutePoints: [] },
    eco: { waypoints: [], distanceKm: 172, baseDurationMin: 140, durationMin: 140, tollsCost: 11.20, wazeDelayMin: 0, description: "Via Dutra e cruzeiro constante a 85 km/h (Mínima emissão de CO2)", color: "#22c55e", onRoutePoints: [] }
  },

  currentWaypoints: [],
  routeDistanceKm: 168,
  routeDurationMin: 155,
  
  driverName: "Condutor",
  currentUser: null,
  vehicleData: null,
  licensePlate: "BRA2E19",
  licensePlateEnd: "9",
  
  selectedStrategy: "economy",
  fuelType: "ethanol",
  activeFilter: "all",
  searchQuery: "",
  audioEnabled: true,
  audioContext: null,
  simulationRunning: false,
  simulationInterval: null,
  simStepIndex: 0
};

// ================= INICIALIZAÇÃO =================
document.addEventListener("DOMContentLoaded", () => {
  initMapWithGoogleLayers();
  initDriverAndCarInputs();
  initAuthSystem();
  renderPointsList();
  setupEventListeners();
  updateQuickStatsBar();
  evaluateRodizioStatus();

  // Traçado inicial das rotas contextuais com ruas do mapa
  calculateContextualRoutes();

  // GPS silencioso na inicialização
  requestUserGeolocation(false);
});

// ================= MAPA GOOGLE =================
function initMapWithGoogleLayers() {
  const mapElement = document.getElementById("map");
  if (!mapElement || typeof L === "undefined") return;

  try {
    AppState.map = L.map("map", {
      center: [-23.5505, -46.6333],
      zoom: 9,
      zoomControl: true
    });

    Object.keys(GOOGLE_TILE_LAYERS).forEach((key) => {
      const cfg = GOOGLE_TILE_LAYERS[key];
      AppState.tileLayers[key] = L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        maxZoom: cfg.options?.maxZoom ?? 19,
        subdomains: cfg.options?.subdomains ?? "abc"
      });
    });

    AppState.tileLayers["roadmap"].addTo(AppState.map);
    AppState.markersLayer = L.layerGroup().addTo(AppState.map);
    renderMapMarkers();
  } catch (err) {
    console.error("Erro mapa:", err);
  }
}

function switchGoogleLayer(layerKey) {
  if (!AppState.map || !AppState.tileLayers[layerKey]) return;

  Object.keys(AppState.tileLayers).forEach((k) => {
    AppState.map.removeLayer(AppState.tileLayers[k]);
  });

  AppState.tileLayers[layerKey].addTo(AppState.map);
  AppState.activeLayerKey = layerKey;

  document.querySelectorAll(".layer-switch-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-layer") === layerKey);
  });

  playNotificationBeep(520, 0.05);
}

// ================= PUXADOR DE DADOS DO VEÍCULO PELA PLACA (SEM DADOS CRÍTICOS / CHASSI / LGPD) =================
function processPlateLookup(rawPlate) {
  const v = lookupVehicleByPlate(rawPlate);
  if (!v) return;

  AppState.vehicleData = v;
  AppState.licensePlate = v.plate;

  // Extrai dígito final para o Rodízio de SP
  const matchNumbers = v.plate.match(/\d/g);
  if (matchNumbers && matchNumbers.length > 0) {
    AppState.licensePlateEnd = matchNumbers[matchNumbers.length - 1];
  }

  // Preenche campos visuais na tela
  const brandInput = document.getElementById("carBrandInput");
  const modelInput = document.getElementById("carModelInput");
  const effInput = document.getElementById("calcEfficiency");
  const plateInput = document.getElementById("licensePlateInput");

  if (brandInput) brandInput.value = v.brand;
  if (modelInput) modelInput.value = v.model;
  if (plateInput) plateInput.value = v.plate;

  if (effInput) {
    effInput.value = (AppState.fuelType === "ethanol" ? v.ethanolKmPerL : v.gasolineKmPerL);
  }

  // Atualizar Placa Mercosul visual na tela
  const plateDisplayEl = document.getElementById("mercosulPlateNumber");
  if (plateDisplayEl) {
    plateDisplayEl.textContent = v.plate.length === 7 ? `${v.plate.slice(0, 3)}-${v.plate.slice(3)}` : v.plate;
  }

  // Atualizar Card de Resultados com Dados Puxados (SEM CHASSI NEM RENAVAM!)
  const consultResultEl = document.getElementById("vehicleConsultResult");
  if (consultResultEl) {
    consultResultEl.innerHTML = `
      <div class="vehicle-data-grid">
        <div class="vehicle-data-item">
          <strong>Marca / Fabricante</strong>
          <span>${v.brand}</span>
        </div>
        <div class="vehicle-data-item">
          <strong>Modelo & Versão</strong>
          <span>${v.model}</span>
        </div>
        <div class="vehicle-data-item">
          <strong>Ano de Fabricação</strong>
          <span>${v.year}</span>
        </div>
        <div class="vehicle-data-item">
          <strong>Cor do Veículo</strong>
          <span>${v.color}</span>
        </div>
        <div class="vehicle-data-item">
          <strong>Motorização / Potência</strong>
          <span>${v.engine}</span>
        </div>
        <div class="vehicle-data-item">
          <strong>Município de Registro</strong>
          <span>${v.city}</span>
        </div>
        <div class="vehicle-data-item">
          <strong>Combustível Homologado</strong>
          <span>${v.fuel}</span>
        </div>
        <div class="vehicle-data-item">
          <strong>Consumo Inmetro Estrada</strong>
          <span>${v.ethanolKmPerL} km/L (Et.) | ${v.gasolineKmPerL} km/L (Gas.)</span>
        </div>
      </div>
      <div class="lgpd-security-badge">
        <span><strong>Consulta Segura:</strong> Chassi, Renavam e CPF protegidos conforme diretrizes da LGPD.</span>
      </div>
    `;
  }

  updateDriverPillDisplay();
  evaluateRodizioStatus();
  recalculateRoutePlan();
  playNotificationBeep(620, 0.1);
}

function updateDriverPillDisplay() {
  const pill = document.getElementById("headerDriverPill");
  if (pill) {
    const label = AppState.currentUser ? AppState.driverName : "Visitante";
    pill.innerHTML = `Condutor: <strong>${label}</strong>`;
  }
}

// ================= CÁLCULO DE DISTÂNCIA E DETECÇÃO DE PONTOS NO TRAJETO =================
function distanceToSegmentKm(pLat, pLng, aLat, aLng, bLat, bLng) {
  const px = (pLng - aLng) * 102.0;
  const py = (pLat - aLat) * 111.0;
  const bx = (bLng - aLng) * 102.0;
  const by = (bLat - aLat) * 111.0;

  const bLenSq = bx * bx + by * by;
  if (bLenSq === 0) return Math.hypot(px, py);

  let t = (px * bx + py * by) / bLenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = t * bx;
  const projY = t * by;
  return Math.hypot(px - projX, py - projY);
}

function minDistanceToPolylineKm(pLat, pLng, waypoints) {
  if (!waypoints || waypoints.length === 0) return 9999;
  if (waypoints.length === 1) {
    return Math.hypot((pLng - waypoints[0][1]) * 102, (pLat - waypoints[0][0]) * 111);
  }

  let minD = 9999;
  const step = waypoints.length > 1500 ? 2 : 1;
  for (let i = 0; i < waypoints.length - 1; i += step) {
    const a = waypoints[i];
    const b = waypoints[Math.min(i + step, waypoints.length - 1)];
    const d = distanceToSegmentKm(pLat, pLng, a[0], a[1], b[0], b[1]);
    if (d < minD) minD = d;
    if (minD < 0.2) break;
  }
  return minD;
}

// Analisa os pontos e alertas Waze que estão genuinamente no trajeto
function analyzeRouteAgainstPoints(waypoints) {
  const onRoute = [];
  let totalTollsCost = 0;
  let totalJamDelayMin = 0;

  let hazardCount = 0;
  let jamCount = 0;
  let worksCount = 0;
  let policeCount = 0;
  let weatherCount = 0;
  let tollCount = 0;
  let radarCount = 0;
  let gasCount = 0;

  POINTS_DATA.forEach(p => {
    const dist = minDistanceToPolylineKm(p.lat, p.lng, waypoints);
    // Pontos dentro de 2.2 km da rodovia considerada pertencentes à rota
    if (dist <= 2.2) {
      onRoute.push(p);
      if (p.category === "toll") {
        totalTollsCost += (p.priceNum || parseFloat((p.price || "0").replace(/[^0-9,.]/g, "").replace(",", ".")) || 0);
        tollCount++;
      } else if (p.category === "radar") {
        radarCount++;
      } else if (p.category === "gas") {
        gasCount++;
      } else if (p.category === "waze_hazard") {
        hazardCount++;
      } else if (p.category === "waze_jam") {
        jamCount++;
        totalJamDelayMin += (p.delayMinutes || parseInt((p.delay || "0").replace(/[^0-9]/g, "")) || 20);
      } else if (p.category === "waze_works") {
        worksCount++;
      } else if (p.category === "waze_police") {
        policeCount++;
      } else if (p.category === "waze_weather") {
        weatherCount++;
      }
    }
  });

  return {
    onRoute,
    totalTollsCost: Math.round(totalTollsCost * 100) / 100,
    totalJamDelayMin,
    hazardCount,
    jamCount,
    worksCount,
    policeCount,
    weatherCount,
    tollCount,
    radarCount,
    gasCount
  };
}

// ================= MOTOR DE ROTEAMENTO PELAS RUAS DO MAPS (OSRM ENGINE) =================
async function fetchStreetRoute(coordinatesList) {
  const coordString = coordinatesList.map(c => `${c[1].toFixed(6)},${c[0].toFixed(6)}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson&steps=false&alternatives=false`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`OSRM status ${res.status}`);
    const data = await res.json();
    if (!data || data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      throw new Error("No route in OSRM");
    }

    const route = data.routes[0];
    const waypoints = route.geometry.coordinates.map(pt => [pt[1], pt[0]]);
    const distanceKm = Math.round(route.distance / 1000);
    const durationMin = Math.round(route.duration / 60);

    return { waypoints, distanceKm, durationMin, success: true };
  } catch (e) {
    clearTimeout(timeoutId);
    console.warn("OSRM falhou ou timeout, usando geometria real de corredor:", e.message);
    return { success: false };
  }
}

// ================= CÁLCULO DAS ROTAS CONTEXTUAIS PELAS RUAS =================
async function calculateContextualRoutes() {
  const originInput = document.getElementById("originInput");
  const destInput = document.getElementById("destInput");

  const origText = originInput ? originInput.value.trim() : AppState.originText;
  const destText = destInput ? destInput.value.trim() : AppState.destText;

  AppState.originText = origText || "São Paulo";
  AppState.destText = destText || "Caraguatatuba";

  const btnCalc = document.getElementById("btnCalcRoute");
  if (btnCalc) btnCalc.textContent = "Calculando rota rodoviária...";

  try {
    const origCoords = await geocodeAddress(AppState.originText);
    const destCoords = await geocodeAddress(AppState.destText);

    AppState.originCoords = origCoords;
    AppState.destCoords = destCoords;

    updateOriginDestMarkers(origCoords, destCoords);

    // Constrói as 3 rotas reais pelas ruas e rodovias
    await buildStreetRoutesForDestination(origCoords, destCoords, AppState.destText.toLowerCase());

    applySelectedStrategy(AppState.selectedStrategy);
    updateGoogleMapsLink();

  } catch (err) {
    console.error("Erro rota:", err);
  } finally {
    if (btnCalc) btnCalc.textContent = "Calcular Rota Rodoviária";
  }
}

async function buildStreetRoutesForDestination(orig, dest, destName) {
  const isLitoralNorte = destName.includes("caragua") || destName.includes("ubatuba") || destName.includes("sebastiao") || destName.includes("ilhabela");
  const isLitoralSul = destName.includes("santos") || destName.includes("praia grande") || destName.includes("guaruja") || destName.includes("mongagua") || destName.includes("itanhaem");
  const isSorocaba = destName.includes("sorocaba") || destName.includes("itu") || destName.includes("roque") || destName.includes("salto");
  const isCampinas = destName.includes("campinas") || destName.includes("jundiai") || destName.includes("vinhedo") || destName.includes("valinhos");

  // Definição de waypoints contextuais por estratégia
  let fastWaypointsQuery = [orig, dest];
  let econWaypointsQuery = [orig, dest];
  let ecoWaypointsQuery = [orig, dest];

  let fastFallbackCorridor = null;
  let econFallbackCorridor = null;
  let ecoFallbackCorridor = null;

  if (isLitoralNorte) {
    // Expressa: Ayrton Senna + Carvalho Pinto + Tamoios
    fastWaypointsQuery = [orig, [-23.3250, -45.9800], [-23.3500, -45.6800], dest];
    fastFallbackCorridor = REAL_HIGHWAY_CORRIDORS.sp_to_caragua_fast;

    // Econômica: Mogi das Cruzes (SP-098 Mogi-Bertioga + Rio-Santos SP-055) - ZERO pedágio após Itaquaquecetuba!
    econWaypointsQuery = [orig, [-23.5350, -46.1850], [-23.8540, -46.1380], dest];
    econFallbackCorridor = REAL_HIGHWAY_CORRIDORS.sp_to_caragua_econ;

    // Eco: Dutra até Jacareí e descida suave
    ecoWaypointsQuery = [orig, [-23.3850, -46.3150], [-23.2350, -45.8620], dest];
    ecoFallbackCorridor = REAL_HIGHWAY_CORRIDORS.sp_to_caragua_fast;

  } else if (isLitoralSul) {
    // Expressa: Imigrantes
    fastWaypointsQuery = [orig, [-23.7500, -46.5600], [-23.8750, -46.5250], dest];
    fastFallbackCorridor = REAL_HIGHWAY_CORRIDORS.sp_to_santos_fast;

    // Econômica: Anchieta com posto barato em SBC
    econWaypointsQuery = [orig, [-23.7120, -46.5750], [-23.8550, -46.5050], dest];
    econFallbackCorridor = REAL_HIGHWAY_CORRIDORS.sp_to_santos_econ;

    // Eco: Anchieta em velocidade de cruzeiro
    ecoWaypointsQuery = [orig, [-23.7050, -46.5650], dest];
    ecoFallbackCorridor = REAL_HIGHWAY_CORRIDORS.sp_to_santos_econ;

  } else if (isSorocaba) {
    // Expressa: Castelo Branco (3 pedágios cheios)
    fastWaypointsQuery = [orig, [-23.5080, -46.8850], [-23.4980, -46.9620], dest];
    fastFallbackCorridor = REAL_HIGHWAY_CORRIDORS.sp_to_sorocaba_fast;

    // Econômica: Raposo Tavares (Apenas 1 pedágio R$ 12,20)
    econWaypointsQuery = [orig, [-23.5850, -46.8520], [-23.5850, -47.0510], dest];
    econFallbackCorridor = REAL_HIGHWAY_CORRIDORS.sp_to_sorocaba_econ;

    // Eco: Raposo Tavares
    ecoWaypointsQuery = [orig, [-23.6020, -46.9150], dest];
    ecoFallbackCorridor = REAL_HIGHWAY_CORRIDORS.sp_to_sorocaba_econ;

  } else if (isCampinas) {
    // Expressa: Bandeirantes
    fastWaypointsQuery = [orig, [-23.3500, -46.8500], dest];
    // Econômica: Anhanguera (com Graal 56)
    econWaypointsQuery = [orig, [-23.2350, -46.8650], dest];
    ecoWaypointsQuery = [orig, [-23.1950, -46.9020], dest];
  }

  // Consulta do OSRM para traçar as ruas exatas
  const [fastRes, econRes, ecoRes] = await Promise.all([
    fetchStreetRoute(fastWaypointsQuery),
    fetchStreetRoute(econWaypointsQuery),
    fetchStreetRoute(ecoWaypointsQuery)
  ]);

  // Se o OSRM falhar em alguma das rotas, usa o corredor rodoviário real como fallback seguro
  const fastWp = fastRes.success ? fastRes.waypoints : (fastFallbackCorridor || [orig, dest]);
  const econWp = econRes.success ? econRes.waypoints : (econFallbackCorridor || [orig, dest]);
  const ecoWp = ecoRes.success ? ecoRes.waypoints : (ecoFallbackCorridor || fastWp);

  const fastDist = fastRes.success ? fastRes.distanceKm : Math.round(fastWp.length * 9.5);
  const econDist = econRes.success ? econRes.distanceKm : Math.round(econWp.length * 9.2);
  const ecoDist = ecoRes.success ? ecoRes.distanceKm : Math.round(ecoWp.length * 9.4);

  const fastDur = fastRes.success ? fastRes.durationMin : Math.round(fastDist * 0.72);
  const econDur = econRes.success ? econRes.durationMin : Math.round(econDist * 0.90);
  const ecoDur = ecoRes.success ? ecoRes.durationMin : Math.round(ecoDist * 0.82);

  // Análise precisa de incidentes Waze e Pedágios para cada uma das 3 rotas
  const fastAnalysis = analyzeRouteAgainstPoints(fastWp);
  const econAnalysis = analyzeRouteAgainstPoints(econWp);
  const ecoAnalysis = analyzeRouteAgainstPoints(ecoWp);

  // Descrições e custos de pedágio ajustados
  let fastToll = fastAnalysis.totalTollsCost > 0 ? fastAnalysis.totalTollsCost : 30.30;
  let econToll = econAnalysis.totalTollsCost > 0 ? econAnalysis.totalTollsCost : 5.60;
  let ecoToll = ecoAnalysis.totalTollsCost > 0 ? ecoAnalysis.totalTollsCost : 11.20;

  let fastDesc = `Via Autoestradas Expressas pelas ruas do Maps (${fastAnalysis.hazardCount} riscos Waze, ${fastAnalysis.jamCount} lentidões)`;
  let econDesc = `Via Estradas Alternativas (Fuga de R$ ${(fastToll - econToll).toFixed(2)} em pedágios e postos mais baratos!)`;
  let ecoDesc = `Via Pista Nivelada em cruzeiro a 85 km/h (Mínima emissão de CO2)`;

  if (isLitoralNorte) {
    fastDesc = "Via Ayrton Senna, Carvalho Pinto e Nova Tamoios (Túneis expressos e pedágios cheios)";
    econDesc = "Via Mogi-Bertioga e Rio-Santos (Fuga dos pedágios caros da Carvalho Pinto e Tamoios: economia de mais de R$ 24,00!)";
    ecoDesc = "Via Dutra e Carvalho Pinto em velocidade constante sem acelerações bruscas";
  } else if (isSorocaba) {
    fastDesc = "Via Castelo Branco (3 pedágios: Barueri, Itapevi e Itu = R$ 32,90)";
    econDesc = "Via Raposo Tavares (Apenas 1 pedágio São Roque = R$ 12,20. Economia de R$ 20,70!)";
  } else if (isLitoralSul) {
    fastDesc = "Via Rodovia dos Imigrantes (Túneis expressos e descida rápida)";
    econDesc = "Via Rodovia Anchieta (Abastecimento barato com Etanol a R$ 3,49 em SBC)";
  }

  AppState.routesData = {
    fast: {
      waypoints: fastWp,
      distanceKm: fastDist,
      baseDurationMin: fastDur,
      durationMin: fastDur + fastAnalysis.totalJamDelayMin,
      tollsCost: fastToll,
      wazeDelayMin: fastAnalysis.totalJamDelayMin,
      description: fastDesc,
      color: "#4285f4",
      analysis: fastAnalysis,
      onRoutePoints: fastAnalysis.onRoute
    },
    economy: {
      waypoints: econWp,
      distanceKm: econDist,
      baseDurationMin: econDur,
      durationMin: econDur + econAnalysis.totalJamDelayMin,
      tollsCost: econToll,
      wazeDelayMin: econAnalysis.totalJamDelayMin,
      description: econDesc,
      color: "#10b981",
      analysis: econAnalysis,
      onRoutePoints: econAnalysis.onRoute
    },
    eco: {
      waypoints: ecoWp,
      distanceKm: ecoDist,
      baseDurationMin: ecoDur,
      durationMin: ecoDur + ecoAnalysis.totalJamDelayMin,
      tollsCost: ecoToll,
      wazeDelayMin: ecoAnalysis.totalJamDelayMin,
      description: ecoDesc,
      color: "#22c55e",
      analysis: ecoAnalysis,
      onRoutePoints: ecoAnalysis.onRoute
    }
  };
}

// ================= APLICAÇÃO DA ESTRATÉGIA SELECIONADA =================
function applySelectedStrategy(strategyKey) {
  AppState.selectedStrategy = strategyKey;
  const currentRoute = AppState.routesData[strategyKey] || AppState.routesData.economy;

  AppState.currentWaypoints = currentRoute.waypoints;
  AppState.routeDistanceKm = currentRoute.distanceKm;
  AppState.routeDurationMin = currentRoute.durationMin;

  // Marca os pontos como pertencentes à rota ativa
  POINTS_DATA.forEach(p => {
    p.isOnActiveRoute = (currentRoute.onRoutePoints || []).some(rp => rp.id === p.id);
  });

  // Desenha a rota real sobre as ruas do Google Maps
  if (AppState.map && typeof L !== "undefined" && currentRoute.waypoints.length > 0) {
    if (AppState.routePolyline) {
      AppState.map.removeLayer(AppState.routePolyline);
    }

    AppState.routePolyline = L.polyline(currentRoute.waypoints, {
      color: currentRoute.color,
      weight: 6,
      opacity: 0.94,
      lineJoin: "round"
    }).addTo(AppState.map);

    AppState.map.fitBounds(AppState.routePolyline.getBounds(), { padding: [40, 40] });
  }

  // Atualiza painel e barra de alertas Waze
  updateRouteWazeAlertsBar(currentRoute);

  // Recalcula custos e emissões de carbono
  recalculateRoutePlan();

  // Atualiza marcadores e lista se o filtro for no trajeto
  renderMapMarkers();
  renderPointsList();
}

function updateRouteWazeAlertsBar(route) {
  const bar = document.getElementById("routeWazeAlertsBar");
  const statsEl = document.getElementById("wazeRouteStats");
  const detailsEl = document.getElementById("wazeRouteDetails");
  if (!bar || !statsEl) return;

  const a = route.analysis || { hazardCount: 0, jamCount: 0, worksCount: 0, policeCount: 0, totalJamDelayMin: 0 };
  const pointsOnRoute = route.onRoutePoints || [];

  const wazeTotal = a.hazardCount + a.jamCount + a.worksCount + a.policeCount + (a.weatherCount || 0);

  if (wazeTotal === 0 && a.totalJamDelayMin === 0) {
    bar.className = "route-waze-bar safe";
    statsEl.innerHTML = `Trajeto livre de ocorrências críticas`;
    if (detailsEl) {
      detailsEl.innerHTML = `<span style="color:#86efac;">Nenhuma ocorrência de risco ou retenção detectada nesta rota.</span>`;
    }
  } else {
    bar.className = "route-waze-bar";
    const delayTxt = a.totalJamDelayMin > 0 ? ` • +${a.totalJamDelayMin} min retenção` : "";
    statsEl.innerHTML = `<strong>${a.hazardCount}</strong> Risco • <strong>${a.jamCount}</strong> Lentidão${delayTxt} • <strong>${a.worksCount}</strong> Obras • <strong>${a.policeCount}</strong> Fiscalização`;

    if (detailsEl) {
      const pills = pointsOnRoute
        .filter(p => p.category.startsWith("waze_"))
        .map(p => {
          let catClass = "hazard";
          if (p.category === "waze_jam") catClass = "jam";
          else if (p.category === "waze_works") catClass = "works";
          else if (p.category === "waze_police") catClass = "police";
          else if (p.category === "waze_weather") catClass = "weather";

          return `
            <span class="waze-alert-pill ${catClass}" onclick="focusOnPoint('${p.id}')" style="cursor:pointer;" title="Clique para centralizar no mapa">
              [${getCategoryIcon(p.category)}] ${p.name.split(':')[0]} (${p.km || p.delay || 'Trecho'})
            </span>
          `;
        })
        .join("");

      detailsEl.innerHTML = `
        <div style="margin-bottom:6px;"><strong>Ocorrências mapeadas no trajeto:</strong></div>
        <div>${pills || 'Nenhuma ocorrência crítica ativa.'}</div>
      `;
    }
  }
}

async function geocodeAddress(query) {
  const clean = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  for (const key in LOCAL_GEOCODE_CACHE) {
    if (clean.includes(key)) return LOCAL_GEOCODE_CACHE[key];
  }
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ", Brasil")}&limit=1`;
    const resp = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
    if (resp.ok) {
      const results = await resp.json();
      if (results && results.length > 0) {
        return [parseFloat(results[0].lat), parseFloat(results[0].lon)];
      }
    }
  } catch (e) {
    console.warn("Geocode error:", e);
  }
  return [-23.5505, -46.6333];
}

function updateOriginDestMarkers(origCoords, destCoords) {
  if (!AppState.map || typeof L === "undefined") return;

  if (AppState.originMarker) AppState.map.removeLayer(AppState.originMarker);
  if (AppState.destMarker) AppState.map.removeLayer(AppState.destMarker);

  const origIcon = L.divIcon({
    className: "orig-marker-icon",
    html: `<div class="map-badge-marker" style="background:#2563eb;">O</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });

  const destIcon = L.divIcon({
    className: "dest-marker-icon",
    html: `<div class="map-badge-marker" style="background:#16a34a;">D</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });

  AppState.originMarker = L.marker(origCoords, { icon: origIcon }).addTo(AppState.map)
    .bindPopup(`<strong>Origem:</strong><br>${AppState.originText}`);

  AppState.destMarker = L.marker(destCoords, { icon: destIcon }).addTo(AppState.map)
    .bindPopup(`<strong>Destino:</strong><br>${AppState.destText}`);
}

function updateGoogleMapsLink() {
  const gmapsLink = document.getElementById("btnOpenGmapsExternal");
  if (gmapsLink) {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(AppState.originText)}&destination=${encodeURIComponent(AppState.destText)}&travelmode=driving`;
    gmapsLink.href = url;
  }
}

// ================= CÁLCULO FINANCEIRO, EMISSÃO DE CO2 E DICAS WAZE =================
function recalculateRoutePlan() {
  const currentRoute = AppState.routesData[AppState.selectedStrategy] || AppState.routesData.economy;
  const fuelType = AppState.fuelType;
  const v = AppState.vehicleData || { ethanolKmPerL: 10.8, gasolineKmPerL: 15.3, brand: "Renault", model: "Kwid" };
  const fuelEfficiency = parseFloat(document.getElementById("calcEfficiency")?.value) || (fuelType === "ethanol" ? v.ethanolKmPerL : v.gasolineKmPerL);
  const customFuelPrice = parseFloat(document.getElementById("calcFuelPrice")?.value) || (fuelType === "ethanol" ? 3.49 : 5.39);

  const distanceKm = currentRoute.distanceKm;
  const tollsCost = currentRoute.tollsCost;

  const litersNeeded = (distanceKm / fuelEfficiency);
  const fuelCost = litersNeeded * customFuelPrice;
  const totalCost = fuelCost + tollsCost;

  const co2Factor = fuelType === "ethanol" ? 0.65 : 2.28;
  const totalCo2Kg = litersNeeded * co2Factor;
  const savedCo2VsGasoline = (litersNeeded * 2.28) - totalCo2Kg;

  const delayText = currentRoute.wazeDelayMin > 0 ? ` (+${currentRoute.wazeDelayMin}m trânsito)` : "";
  document.getElementById("calcDistanceDisplay").textContent = `${Math.round(distanceKm)} km (${currentRoute.durationMin} min${delayText})`;
  document.getElementById("calcFuelCostDisplay").textContent = `R$ ${fuelCost.toFixed(2)}`;
  document.getElementById("calcTollsDisplay").textContent = `R$ ${tollsCost.toFixed(2)}`;
  document.getElementById("calcTotalDisplay").textContent = `R$ ${totalCost.toFixed(2)}`;

  const carbonEl = document.getElementById("carbonFootprintValue");
  if (carbonEl) {
    if (fuelType === "ethanol") {
      carbonEl.innerHTML = `<strong>${totalCo2Kg.toFixed(1)} kg CO2</strong> <span style="font-size:0.75rem; color:#86efac;">Etanol (-${savedCo2VsGasoline.toFixed(1)} kg vs gasolina)</span>`;
    } else {
      carbonEl.innerHTML = `<strong>${totalCo2Kg.toFixed(1)} kg CO2</strong> <span style="font-size:0.75rem; color:#fde68a;">Gasolina Comum</span>`;
    }
  }

  const tipsEl = document.getElementById("calcEconomyTips");
  if (tipsEl) {
    const diffToll = (AppState.routesData.fast.tollsCost - currentRoute.tollsCost);
    const a = currentRoute.analysis || { hazardCount: 0, jamCount: 0, worksCount: 0, policeCount: 0 };

    tipsEl.innerHTML = `
      <strong>Resumo da ${AppState.selectedStrategy === 'economy' ? 'Rota Econômica' : (AppState.selectedStrategy === 'fast' ? 'Rota Expressa' : 'Rota Eficiente')}:</strong><br>
      ${currentRoute.description}<br>
      ${diffToll > 0 ? `<div style="margin-top:6px; color:#86efac; font-weight:700;">Redução de Tarifa: Economia de R$ ${diffToll.toFixed(2)} em pedágios comparada à Expressa.</div>` : ""}
      <div style="margin-top:6px; font-size:0.74rem; color:#cbd5e1;">
        <strong>Ocorrências no trajeto:</strong> ${a.hazardCount} pontos de atenção | ${a.jamCount} retenções | ${a.worksCount} obras | ${a.policeCount} bases policiais.
      </div>
    `;
  }
}

// ================= RODÍZIO MUNICIPAL DE SÃO PAULO (GERAL DO DIA) =================
function evaluateRodizioStatus() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTimeDec = hours + minutes / 60;

  let dayLabel = "";
  let restrictedPlates = [];

  switch (dayOfWeek) {
    case 1: dayLabel = "Segunda-feira"; restrictedPlates = ["1", "2"]; break;
    case 2: dayLabel = "Terça-feira"; restrictedPlates = ["3", "4"]; break;
    case 3: dayLabel = "Quarta-feira"; restrictedPlates = ["5", "6"]; break;
    case 4: dayLabel = "Quinta-feira"; restrictedPlates = ["7", "8"]; break;
    case 5: dayLabel = "Sexta-feira"; restrictedPlates = ["9", "0"]; break;
    default: dayLabel = "Fim de Semana"; restrictedPlates = []; break;
  }

  const isWeekday = restrictedPlates.length > 0;
  const isMorningPeak = (currentTimeDec >= 7 && currentTimeDec <= 10);
  const isEveningPeak = (currentTimeDec >= 17 && currentTimeDec <= 20);
  const isInRestrictedHours = (isMorningPeak || isEveningPeak);

  const headerPill = document.getElementById("headerRodizioPill");
  const cardResult = document.getElementById("rodizioResultBox");

  if (!isWeekday) {
    if (headerPill) {
      headerPill.className = "rodizio-status-pill free";
      headerPill.innerHTML = `Rodízio SP: Liberado (${dayLabel})`;
    }
    if (cardResult) {
      cardResult.className = "rodizio-checker-result free";
      cardResult.innerHTML = `<strong>RODÍZIO SUSPENSO HOJE (${dayLabel.toUpperCase()}):</strong> Circulação livre para todos os veículos no Centro Expandido de São Paulo.`;
    }
  } else {
    const finalsStr = `${restrictedPlates[0]} e ${restrictedPlates[1]}`;
    if (isInRestrictedHours) {
      if (headerPill) {
        headerPill.className = "rodizio-status-pill danger";
        headerPill.innerHTML = `Rodízio Ativo Agora (${dayLabel}: Finais ${finalsStr})`;
      }
      if (cardResult) {
        cardResult.className = "rodizio-checker-result danger";
        cardResult.innerHTML = `<strong>RESTRIÇÃO ATIVA AGORA (${dayLabel.toUpperCase()}):</strong> Veículos com placas de final <strong>${finalsStr}</strong> estão restritos no Centro Expandido das 07h às 10h e das 17h às 20h.`;
      }
    } else {
      if (headerPill) {
        headerPill.className = "rodizio-status-pill restricted";
        headerPill.innerHTML = `Rodízio Hoje (${dayLabel}): Finais ${finalsStr} nos horários de pico`;
      }
      if (cardResult) {
        cardResult.className = "rodizio-checker-result restricted";
        cardResult.innerHTML = `<strong>RODÍZIO DE HOJE (${dayLabel.toUpperCase()}):</strong> Restrição para finais <strong>${finalsStr}</strong> das 07h00 às 10h00 e das 17h00 às 20h00 no Centro Expandido.`;
      }
    }
  }
}

// ================= MARCADORES LEAFLET NO MAPA =================
function createMarkerIcon(category, extra) {
  if (typeof L === "undefined") return null;

  let bg = "#16a34a";
  let symbol = "C";

  if (category === "toll") { bg = "#dc2626"; symbol = "P"; }
  else if (category === "radar") { bg = "#d97706"; symbol = "R"; }
  else if (category === "gas") { bg = "#16a34a"; symbol = "C"; }
  else if (category === "waze_hazard") { bg = "#be123c"; symbol = "!"; }
  else if (category === "waze_jam") { bg = "#ea580c"; symbol = "T"; }
  else if (category === "waze_works") { bg = "#ca8a04"; symbol = "O"; }
  else if (category === "waze_police") { bg = "#2563eb"; symbol = "F"; }
  else if (category === "waze_weather") { bg = "#0891b2"; symbol = "N"; }

  return L.divIcon({
    className: "custom-div-icon",
    html: `<div class="map-badge-marker" style="background:${bg}; cursor:pointer;">${symbol}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14]
  });
}

function renderMapMarkers() {
  if (!AppState.map || !AppState.markersLayer) return;
  AppState.markersLayer.clearLayers();

  const filteredPoints = getFilteredPoints();

  filteredPoints.forEach((point) => {
    const icon = createMarkerIcon(point.category, point.speed || point.price);
    const marker = L.marker([point.lat, point.lng], { icon: icon });
    marker.bindPopup(buildPopupHtml(point));
    AppState.markersLayer.addLayer(marker);
  });
}

function buildPopupHtml(p) {
  let categoryLabel = "";
  let tagClass = p.category;
  let priceOrAlert = "";

  if (p.category === "toll") {
    categoryLabel = "Praça de Pedágio";
    priceOrAlert = `<div class="popup-highlight" style="color:#dc2626;">Tarifa: ${p.price}</div>`;
  } else if (p.category === "radar") {
    categoryLabel = `Radar Fixo: ${p.speed}`;
    priceOrAlert = `<div class="popup-highlight" style="color:#d97706;">Fiscalização Eletrônica</div>`;
  } else if (p.category === "gas") {
    categoryLabel = "Posto de Abastecimento";
    priceOrAlert = `<div class="popup-highlight" style="color:#16a34a;">${p.fuelPrice}</div>`;
  } else if (p.category === "waze_hazard") {
    categoryLabel = "Ocorrência: Atenção / Segurança";
    priceOrAlert = `<div class="popup-highlight" style="color:#be123c;">${p.wazeType || 'Área de Atenção'}</div>`;
  } else if (p.category === "waze_jam") {
    categoryLabel = "Ocorrência: Retenção Viária";
    priceOrAlert = `<div class="popup-highlight" style="color:#ea580c;">Atraso estimado: ${p.delay || '+25 min'}</div>`;
  } else if (p.category === "waze_works") {
    categoryLabel = "Ocorrência: Obras na Via";
    priceOrAlert = `<div class="popup-highlight" style="color:#ca8a04;">Redução de Faixa / Operários</div>`;
  } else if (p.category === "waze_police") {
    categoryLabel = "Polícia Rodoviária";
    priceOrAlert = `<div class="popup-highlight" style="color:#2563eb;">Base de Fiscalização</div>`;
  } else if (p.category === "waze_weather") {
    categoryLabel = "Condição Climática / Neblina";
    priceOrAlert = `<div class="popup-highlight" style="color:#0891b2;">Baixa Visibilidade</div>`;
  }

  const tip = p.dangerTip ? `<div style="font-size:0.74rem; color:#991b1b; margin-top:6px;">${p.dangerTip}</div>` : "";
  const econTip = p.economyTip ? `<div style="font-size:0.74rem; color:#166534; margin-top:4px;">Nota: ${p.economyTip}</div>` : "";

  return `
    <div class="popup-custom-card">
      <span class="popup-tag ${tagClass}">${categoryLabel}</span>
      <h3>${p.name}</h3>
      <div style="font-size:0.74rem; color:#475569; margin-bottom:6px;">${p.highway} (${p.km})</div>
      ${priceOrAlert}
      <p class="popup-body">${p.desc}</p>
      ${tip}
      ${econTip}
    </div>
  `;
}

// ================= LISTAGEM LATERAL E FILTROS =================
function getFilteredPoints() {
  return POINTS_DATA.filter((p) => {
    let matchesCategory = true;
    if (AppState.activeFilter === "route") matchesCategory = p.isOnActiveRoute;
    else if (AppState.activeFilter === "toll") matchesCategory = (p.category === "toll");
    else if (AppState.activeFilter === "radar") matchesCategory = (p.category === "radar");
    else if (AppState.activeFilter === "gas") matchesCategory = (p.category === "gas");
    else if (AppState.activeFilter === "waze") matchesCategory = p.category.startsWith("waze_");

    const matchesSearch = AppState.searchQuery === "" || 
      p.name.toLowerCase().includes(AppState.searchQuery.toLowerCase()) ||
      p.highway.toLowerCase().includes(AppState.searchQuery.toLowerCase()) ||
      p.desc.toLowerCase().includes(AppState.searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });
}

function renderPointsList() {
  const container = document.getElementById("pointsList");
  if (!container) return;

  const points = getFilteredPoints();

  if (points.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:20px; color:#94a3b8; font-size:0.8rem;">
        Nenhum ponto ou alerta encontrado para o filtro selecionado.
      </div>
    `;
    return;
  }

  container.innerHTML = points.map(p => {
    let priceBadge = "";
    let tipBlock = "";

    if (p.category === "toll") {
      priceBadge = `<span class="point-price-tag toll">${p.price}</span>`;
      tipBlock = `<div class="point-economy-tip">Economia: ${p.economyTip}</div>`;
    } else if (p.category === "radar") {
      priceBadge = `<span class="point-price-tag fine">Limite: ${p.speed}</span>`;
      tipBlock = `<div class="point-danger-tip">Atenção: ${p.dangerTip}</div>`;
    } else if (p.category === "gas") {
      priceBadge = `<span class="point-price-tag cheap">${p.fuelPrice.split('|')[0].trim()}</span>`;
      tipBlock = `<div class="point-economy-tip">Abastecimento: ${p.economyTip}</div>`;
    } else if (p.category === "waze_hazard") {
      priceBadge = `<span class="point-price-tag waze">Segurança / Risco</span>`;
      tipBlock = `<div class="point-waze-tip">${p.dangerTip || p.desc}</div>`;
    } else if (p.category === "waze_jam") {
      priceBadge = `<span class="point-price-tag waze" style="color:#fdba74;">Retenção ${p.delay || ''}</span>`;
      tipBlock = `<div class="point-waze-tip" style="border-color:rgba(249,115,22,0.4);">${p.desc}</div>`;
    } else if (p.category === "waze_works") {
      priceBadge = `<span class="point-price-tag waze" style="color:#fde047;">Obras na Via</span>`;
      tipBlock = `<div class="point-waze-tip" style="border-color:rgba(234,179,8,0.4);">${p.dangerTip || p.desc}</div>`;
    } else if (p.category === "waze_police") {
      priceBadge = `<span class="point-price-tag waze" style="color:#93c5fd;">Polícia Rodoviária</span>`;
      tipBlock = `<div class="point-waze-tip" style="border-color:rgba(59,130,246,0.4);">${p.dangerTip || p.desc}</div>`;
    } else if (p.category === "waze_weather") {
      priceBadge = `<span class="point-price-tag waze" style="color:#a5f3fc;">Neblina / Clima</span>`;
      tipBlock = `<div class="point-waze-tip" style="border-color:rgba(6,182,212,0.4);">${p.dangerTip || p.desc}</div>`;
    }

    const routeTag = p.isOnActiveRoute ? `<span style="font-size:0.65rem; background:rgba(37,99,235,0.22); color:#93c5fd; padding:2px 6px; border-radius:3px; margin-left:6px;">Na Rota</span>` : "";

    return `
      <div class="point-card cat-${p.category}" onclick="focusOnPoint('${p.id}')">
        <div class="point-card-header">
          <div class="point-title">
            [${getCategoryIcon(p.category)}] ${p.name} ${routeTag}
          </div>
          <span class="point-highway">${p.highway}</span>
        </div>
        <div class="point-meta">
          <span>Trecho: ${p.km}</span>
          ${priceBadge}
        </div>
        <div class="point-desc">${p.desc}</div>
        ${tipBlock}
      </div>
    `;
  }).join("");
}

function getCategoryIcon(cat) {
  if (cat === "toll") return "PED";
  if (cat === "radar") return "RAD";
  if (cat === "gas") return "POS";
  if (cat === "waze_hazard") return "SEG";
  if (cat === "waze_jam") return "RET";
  if (cat === "waze_works") return "OBR";
  if (cat === "waze_police") return "POL";
  if (cat === "waze_weather") return "CLI";
  return "PTO";
}

function focusOnPoint(id) {
  const point = POINTS_DATA.find(p => p.id === id);
  if (!point || !AppState.map) return;

  if (window.innerWidth <= 900) {
    const mapCanvas = document.getElementById("mapCanvasWrapper");
    if (mapCanvas) {
      mapCanvas.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    document.querySelectorAll(".mobile-nav-btn").forEach(b => {
      b.classList.toggle("active", b.getAttribute("data-mobile-target") === "map");
    });
  }

  AppState.map.setView([point.lat, point.lng], 14, { animate: true });
  AppState.markersLayer.eachLayer(layer => {
    if (layer.getLatLng && 
        Math.abs(layer.getLatLng().lat - point.lat) < 0.0001 && 
        Math.abs(layer.getLatLng().lng - point.lng) < 0.0001) {
      layer.openPopup();
    }
  });

  playNotificationBeep(520, 0.08);
}

function updateQuickStatsBar() {
  const tollsCount = POINTS_DATA.filter(p => p.category === "toll").length;
  const radarsCount = POINTS_DATA.filter(p => p.category === "radar").length;
  const wazeCount = POINTS_DATA.filter(p => p.category.startsWith("waze_")).length;

  const tEl = document.getElementById("statTollsCount");
  const rEl = document.getElementById("statRadarsCount");
  const wEl = document.getElementById("statWazeCount");

  if (tEl) tEl.textContent = `${tollsCount} Pedágios`;
  if (rEl) rEl.textContent = `${radarsCount} Radares`;
  if (wEl) wEl.textContent = `${wazeCount} Ocorrências`;
}

// ================= SIMULAÇÃO DE VIAGEM PELAS RUAS =================
function startSimulation() {
  if (AppState.simulationRunning) {
    stopSimulation();
    return;
  }

  if (!AppState.currentWaypoints || AppState.currentWaypoints.length < 2) {
    alert("Calcule uma rota antes de iniciar a simulação.");
    return;
  }

  AppState.simulationRunning = true;
  AppState.simStepIndex = 0;

  const hudCard = document.getElementById("hudSimulationCard");
  const simToggleBtn = document.getElementById("btnToggleSim");
  if (hudCard) hudCard.classList.add("active");
  if (simToggleBtn) {
    simToggleBtn.textContent = "Parar Simulação";
    simToggleBtn.classList.add("active");
  }

  if (AppState.simVehicleMarker && AppState.map) {
    AppState.map.removeLayer(AppState.simVehicleMarker);
  }

  if (AppState.map && typeof L !== "undefined") {
    const carIcon = L.divIcon({
      className: "sim-car-icon",
      html: `<div class="map-badge-marker" style="background:#2563eb; width:30px; height:30px;">V</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    AppState.simVehicleMarker = L.marker(AppState.currentWaypoints[0], { icon: carIcon }).addTo(AppState.map);
  }

  playNotificationBeep(440, 0.2);

  const totalWaypoints = AppState.currentWaypoints.length;
  const stepJump = Math.max(1, Math.floor(totalWaypoints / 40));

  AppState.simulationInterval = setInterval(() => {
    if (AppState.simStepIndex >= totalWaypoints) {
      stopSimulation();
      alert(`Simulação concluída: chegada em ${AppState.destText}.`);
      return;
    }

    const coords = AppState.currentWaypoints[AppState.simStepIndex];
    if (AppState.simVehicleMarker) {
      AppState.simVehicleMarker.setLatLng(coords);
      AppState.map.panTo(coords, { animate: true });
    }

    // Detecta pontos reais a menos de 2.5 km de proximidade na simulação
    const nearby = findPointsNearCoords(coords[0], coords[1], 0.025);
    updateHudDisplay(nearby);

    AppState.simStepIndex += stepJump;
  }, 850);
}

function findPointsNearCoords(lat, lng, threshold) {
  return POINTS_DATA.filter(p => {
    const dLat = Math.abs(p.lat - lat);
    const dLng = Math.abs(p.lng - lng);
    return Math.sqrt(dLat * dLat + dLng * dLng) <= threshold;
  });
}

function updateHudDisplay(nearby) {
  const alertEl = document.getElementById("hudAlertText");
  const descEl = document.getElementById("hudDescText");
  const speedEl = document.getElementById("hudSpeedValue");

  if (!alertEl || !descEl) return;

  const wazeHazard = nearby.find(p => p.category === "waze_hazard");
  const wazeJam = nearby.find(p => p.category === "waze_jam");
  const wazeWorks = nearby.find(p => p.category === "waze_works");
  const wazePolice = nearby.find(p => p.category === "waze_police");
  const wazeWeather = nearby.find(p => p.category === "waze_weather");
  const radar = nearby.find(p => p.category === "radar");
  const toll = nearby.find(p => p.category === "toll");

  if (wazeHazard) {
    alertEl.className = "hud-next-alert waze";
    alertEl.innerHTML = `ATENÇÃO: ÁREA DE RISCO VIÁRIO`;
    descEl.textContent = `${wazeHazard.name}. ${wazeHazard.dangerTip}`;
    if (speedEl) speedEl.textContent = "75";
    playNotificationBeep(850, 0.25);
  } else if (wazeJam) {
    alertEl.className = "hud-next-alert waze";
    alertEl.innerHTML = `RETENÇÃO NA VIA (${wazeJam.delay || '+25 min'})`;
    descEl.textContent = `${wazeJam.name}. Reduza a velocidade e mantenha distância.`;
    if (speedEl) speedEl.textContent = "25";
    playNotificationBeep(650, 0.15);
  } else if (wazeWorks) {
    alertEl.className = "hud-next-alert waze";
    alertEl.innerHTML = `OBRAS NA PISTA`;
    descEl.textContent = `${wazeWorks.name}. Faixa estreitada e operários na via.`;
    if (speedEl) speedEl.textContent = "50";
    playNotificationBeep(600, 0.15);
  } else if (wazePolice) {
    alertEl.className = "hud-next-alert waze";
    alertEl.innerHTML = `FISCALIZAÇÃO POLICIAL RODOVIÁRIA`;
    descEl.textContent = `${wazePolice.name}. ${wazePolice.dangerTip}`;
    if (speedEl) speedEl.textContent = "80";
    playNotificationBeep(700, 0.15);
  } else if (wazeWeather) {
    alertEl.className = "hud-next-alert waze";
    alertEl.innerHTML = `NEBLINA DENSA NO TRECHO`;
    descEl.textContent = `${wazeWeather.name}. Mantenha farol baixo aceso.`;
    if (speedEl) speedEl.textContent = "45";
    playNotificationBeep(550, 0.15);
  } else if (radar) {
    alertEl.className = "hud-next-alert radar";
    alertEl.innerHTML = `RADAR FIXO: LIMITE ${radar.speed}`;
    descEl.textContent = `${radar.name}. Controle a velocidade.`;
    if (speedEl) speedEl.textContent = radar.speed.replace(/[^0-9]/g, "") || "80";
    playNotificationBeep(880, 0.25);
  } else if (toll) {
    alertEl.className = "hud-next-alert toll";
    alertEl.innerHTML = `PRAÇA DE PEDÁGIO: ${toll.price}`;
    descEl.textContent = `${toll.name}. Reduza para 40 km/h na cabine automática.`;
    if (speedEl) speedEl.textContent = "40";
    playNotificationBeep(330, 0.2);
  } else {
    alertEl.className = "hud-next-alert good";
    alertEl.innerHTML = `Trecho Livre (${AppState.selectedStrategy === 'economy' ? 'Rota Econômica' : 'Rota Expressa'})`;
    descEl.textContent = `Tráfego fluindo normalmente pelo corredor rodoviário.`;
    if (speedEl) speedEl.textContent = "90";
  }
}

function stopSimulation() {
  AppState.simulationRunning = false;
  if (AppState.simulationInterval) {
    clearInterval(AppState.simulationInterval);
    AppState.simulationInterval = null;
  }

  const hudCard = document.getElementById("hudSimulationCard");
  const simToggleBtn = document.getElementById("btnToggleSim");
  if (hudCard) hudCard.classList.remove("active");
  if (simToggleBtn) {
    simToggleBtn.textContent = "Simular Trajeto";
    simToggleBtn.classList.remove("active");
  }

  if (AppState.simVehicleMarker && AppState.map) {
    AppState.map.removeLayer(AppState.simVehicleMarker);
    AppState.simVehicleMarker = null;
  }
}

// ================= REGISTRAR OCORRÊNCIA =================
function reportWazeAlert() {
  const type = prompt("Selecione o tipo de ocorrência:\n1 - Área de Risco / Segurança\n2 - Retenção / Congestionamento\n3 - Obras na Pista\n4 - Fiscalização Policial\n5 - Neblina / Chuva Intensa", "1");
  if (!type) return;

  const desc = prompt("Informe a rodovia, km e descrição da ocorrência:", "Retenção na faixa da direita");
  if (!desc) return;

  let cat = "waze_hazard";
  if (type === "2") cat = "waze_jam";
  else if (type === "3") cat = "waze_works";
  else if (type === "4") cat = "waze_police";
  else if (type === "5") cat = "waze_weather";

  const newPoint = {
    id: "waze-user-" + Date.now(),
    name: "Ocorrência Registrada: " + desc,
    highway: "Trecho Informado",
    km: "Recente",
    category: cat,
    lat: AppState.originCoords[0] + (Math.random() - 0.5) * 0.05,
    lng: AppState.originCoords[1] + (Math.random() - 0.5) * 0.05,
    desc: desc,
    dangerTip: "Ocorrência registrada por condutor no sistema EconoSP.",
    isOnActiveRoute: true
  };

  POINTS_DATA.unshift(newPoint);
  renderMapMarkers();
  renderPointsList();
  updateQuickStatsBar();
  focusOnPoint(newPoint.id);
  alert("Ocorrência registrada e adicionada ao mapa.");
}

// ================= ÁUDIO BEEP NATIVO =================
function playNotificationBeep(frequency = 440, duration = 0.15) {
  if (!AppState.audioEnabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!AppState.audioContext) AppState.audioContext = new AudioContext();
    if (AppState.audioContext.state === "suspended") AppState.audioContext.resume();
    const osc = AppState.audioContext.createOscillator();
    const gain = AppState.audioContext.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, AppState.audioContext.currentTime);
    gain.gain.setValueAtTime(0.12, AppState.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, AppState.audioContext.currentTime + duration);
    osc.connect(gain);
    gain.connect(AppState.audioContext.destination);
    osc.start();
    osc.stop(AppState.audioContext.currentTime + duration);
  } catch (e) {
    console.warn("Áudio indisponível", e);
  }
}

// ================= GEOLOCALIZAÇÃO =================
function requestUserGeolocation(userTriggered = true) {
  const btnLocate = document.getElementById("btnLocateMe");
  const originInput = document.getElementById("originInput");

  if (!navigator.geolocation) {
    if (userTriggered) alert("Geolocalização não é suportada pelo seu navegador.");
    return;
  }

  if (btnLocate) btnLocate.textContent = "Buscando...";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      AppState.originCoords = [lat, lng];
      AppState.originText = "Minha Localização Atual";

      if (originInput) originInput.value = "Minha Localização Atual";
      if (btnLocate) btnLocate.textContent = "Usar GPS";

      calculateContextualRoutes();
      playNotificationBeep(650, 0.1);
    },
    (error) => {
      if (btnLocate) btnLocate.textContent = "Usar GPS";
      if (userTriggered) alert("Não foi possível acessar seu GPS. Digite o local de origem manualmente.");
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// ================= CONFIGURAÇÃO DE EVENTOS =================
function initDriverAndCarInputs() {
  const nameInput = document.getElementById("driverNameInput");
  const plateInput = document.getElementById("licensePlateInput");
  const btnSearchPlate = document.getElementById("btnSearchPlate");

  if (nameInput) {
    nameInput.value = AppState.driverName;
    nameInput.addEventListener("input", (e) => {
      AppState.driverName = e.target.value || "Condutor";
      updateDriverPillDisplay();
      recalculateRoutePlan();
    });
  }

  if (plateInput) {
    plateInput.value = AppState.licensePlate;
    plateInput.addEventListener("input", (e) => {
      const val = e.target.value.toUpperCase();
      AppState.licensePlate = val;
      if (val.length >= 7) {
        processPlateLookup(val);
      }
    });

    plateInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        processPlateLookup(plateInput.value);
      }
    });
  }

  if (btnSearchPlate) {
    btnSearchPlate.addEventListener("click", () => {
      if (plateInput) processPlateLookup(plateInput.value);
    });
  }
}

function setupEventListeners() {
  const layerButtons = document.querySelectorAll(".layer-switch-btn");
  layerButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const layerKey = btn.getAttribute("data-layer");
      switchGoogleLayer(layerKey);
    });
  });

  const btnCalcRoute = document.getElementById("btnCalcRoute");
  if (btnCalcRoute) btnCalcRoute.addEventListener("click", calculateContextualRoutes);

  ["originInput", "destInput"].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") calculateContextualRoutes();
      });
    }
  });

  const btnLocateMe = document.getElementById("btnLocateMe");
  if (btnLocateMe) btnLocateMe.addEventListener("click", () => requestUserGeolocation(true));

  const strategyBtns = document.querySelectorAll(".strategy-btn");
  strategyBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      strategyBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const strat = btn.getAttribute("data-strategy");
      applySelectedStrategy(strat);
      playNotificationBeep(520, 0.08);
    });
  });

  const chips = document.querySelectorAll(".filter-chip");
  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      chips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      AppState.activeFilter = chip.getAttribute("data-category");
      renderMapMarkers();
      renderPointsList();
      playNotificationBeep(480, 0.05);
    });
  });

  const btnToggleWaze = document.getElementById("btnToggleWazeList");
  if (btnToggleWaze) {
    btnToggleWaze.addEventListener("click", () => {
      const details = document.getElementById("wazeRouteDetails");
      if (details) {
        details.classList.toggle("active");
        btnToggleWaze.textContent = details.classList.contains("active") ? "Ocultar" : "Detalhes";
      }
    });
  }

  const searchInput = document.getElementById("searchPointsInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      AppState.searchQuery = e.target.value;
      renderPointsList();
    });
  }

  const tabBtns = document.querySelectorAll(".tab-btn");
  const mobileNavBtns = document.querySelectorAll(".mobile-nav-btn");
  const sidebarEl = document.getElementById("appSidebar");
  const btnToggleDrawer = document.getElementById("btnToggleDrawer");
  const btnMapDrawerHandle = document.getElementById("btnMapDrawerHandle");
  const btnCloseSidebar = document.getElementById("btnCloseSidebar");
  const drawerHandleLabel = document.getElementById("drawerHandleLabel");

  function setSidebarOpen(isOpen) {
    if (!sidebarEl) return;
    sidebarEl.classList.toggle("collapsed", !isOpen);
    if (drawerHandleLabel) {
      drawerHandleLabel.textContent = isOpen
        ? "Fechar Painel (Ocorrências e Rodízio)"
        : "Abrir Painel (Ocorrências e Rodízio)";
    }
    if (btnToggleDrawer) {
      btnToggleDrawer.textContent = isOpen
        ? "Fechar Ocorrências / Rodízio"
        : "Abrir Ocorrências / Rodízio";
    }
    setTimeout(() => {
      if (AppState.map) AppState.map.invalidateSize();
    }, 240);
  }

  function toggleSidebarDrawer() {
    if (!sidebarEl) return;
    const currentlyCollapsed = sidebarEl.classList.contains("collapsed");
    setSidebarOpen(currentlyCollapsed);
    playNotificationBeep(500, 0.04);
  }

  if (btnToggleDrawer) btnToggleDrawer.addEventListener("click", toggleSidebarDrawer);
  if (btnMapDrawerHandle) btnMapDrawerHandle.addEventListener("click", toggleSidebarDrawer);
  if (btnCloseSidebar) btnCloseSidebar.addEventListener("click", () => setSidebarOpen(false));

  function activateSidebarTab(targetTab) {
    setSidebarOpen(true);
    tabBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-tab") === targetTab));
    document.querySelectorAll(".tab-pane").forEach(pane => pane.style.display = "none");
    const activePane = document.getElementById(`tab-${targetTab}`);
    if (activePane) activePane.style.display = "block";
    mobileNavBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-mobile-target") === targetTab));
  }

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      activateSidebarTab(targetTab);
      playNotificationBeep(500, 0.04);
    });
  });

  mobileNavBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-mobile-target");
      mobileNavBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      if (target === "map") {
        setSidebarOpen(false);
        const mapSection = document.getElementById("mapSection");
        if (mapSection) mapSection.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        activateSidebarTab(target);
        if (sidebarEl) sidebarEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      playNotificationBeep(500, 0.04);
    });
  });

  const btnTogglePlanner = document.getElementById("btnTogglePlanner");
  const plannerInputs = document.getElementById("plannerInputsCollapse");
  if (btnTogglePlanner && plannerInputs) {
    btnTogglePlanner.addEventListener("click", () => {
      const isCollapsed = plannerInputs.classList.toggle("collapsed");
      btnTogglePlanner.textContent = isCollapsed ? "Expandir" : "Recolher";
      setTimeout(() => {
        if (AppState.map) AppState.map.invalidateSize();
      }, 200);
    });
  }

  const fuelTypeSelect = document.getElementById("calcFuelType");
  if (fuelTypeSelect) {
    fuelTypeSelect.addEventListener("change", (e) => {
      AppState.fuelType = e.target.value;
      if (AppState.vehicleData) {
        const effInput = document.getElementById("calcEfficiency");
        if (effInput) {
          effInput.value = (e.target.value === "ethanol" ? AppState.vehicleData.ethanolKmPerL : AppState.vehicleData.gasolineKmPerL);
        }
      }
      recalculateRoutePlan();
    });
  }

  ["calcEfficiency", "calcFuelPrice"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", recalculateRoutePlan);
      el.addEventListener("change", recalculateRoutePlan);
    }
  });

  const btnToggleAudio = document.getElementById("btnToggleAudio");
  if (btnToggleAudio) {
    btnToggleAudio.addEventListener("click", () => {
      AppState.audioEnabled = !AppState.audioEnabled;
      btnToggleAudio.textContent = AppState.audioEnabled ? "Som: Ativo" : "Som: Mudo";
      if (AppState.audioEnabled) playNotificationBeep(550, 0.1);
    });
  }

  const btnToggleSim = document.getElementById("btnToggleSim");
  if (btnToggleSim) btnToggleSim.addEventListener("click", startSimulation);

  const btnHudStop = document.getElementById("btnHudStop");
  if (btnHudStop) btnHudStop.addEventListener("click", stopSimulation);

  const btnReportWaze = document.getElementById("btnReportWaze");
  if (btnReportWaze) btnReportWaze.addEventListener("click", reportWazeAlert);

  const btnOpenManual = document.getElementById("btnOpenManual");
  const modalManual = document.getElementById("modalManual");
  const btnCloseModal = document.getElementById("btnCloseModal");

  if (btnOpenManual && modalManual) {
    btnOpenManual.addEventListener("click", () => modalManual.classList.add("active"));
  }
  if (btnCloseModal && modalManual) {
    btnCloseModal.addEventListener("click", () => modalManual.classList.remove("active"));
  }
}

// ================= SISTEMA DE CONTAS (LOGIN E CADASTRO RÁPIDO) =================
const AUTH_STORAGE_USERS_KEY = "econosp_users_v1";
const AUTH_STORAGE_SESSION_KEY = "econosp_session_v1";

function getStoredUsers() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveStoredUsers(users) {
  try {
    localStorage.setItem(AUTH_STORAGE_USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.warn("Não foi possível salvar usuários:", e);
  }
}

function getActiveSessionUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setActiveSessionUser(user) {
  try {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_SESSION_KEY);
    }
  } catch (e) {
    console.warn("Erro ao salvar sessão:", e);
  }
}

function applyLoggedUserState(user) {
  const btnOpenAuth = document.getElementById("btnOpenAuth");
  const btnLogoutHeader = document.getElementById("btnLogoutHeader");

  if (user) {
    AppState.currentUser = user;
    AppState.driverName = user.name || "Condutor";
    updateDriverPillDisplay();

    if (btnOpenAuth) {
      btnOpenAuth.textContent = `Conta: ${user.name.split(" ")[0]}`;
    }
    if (btnLogoutHeader) {
      btnLogoutHeader.style.display = "inline-block";
    }
  } else {
    AppState.currentUser = null;
    AppState.driverName = "Visitante";
    if (btnOpenAuth) {
      btnOpenAuth.textContent = "Entrar / Criar Conta";
    }
    if (btnLogoutHeader) {
      btnLogoutHeader.style.display = "none";
    }
    updateDriverPillDisplay();
  }
}

function showAuthFeedback(msg, type = "error") {
  const box = document.getElementById("authFeedbackMsg");
  if (!box) return;
  if (!msg) {
    box.style.display = "none";
    box.textContent = "";
    return;
  }
  box.textContent = msg;
  box.className = `auth-feedback ${type}`;
  box.style.display = "block";
}

function initAuthSystem() {
  const modalAuth = document.getElementById("modalAuth");
  const btnOpenAuth = document.getElementById("btnOpenAuth");
  const btnCloseAuthModal = document.getElementById("btnCloseAuthModal");
  const btnLogoutHeader = document.getElementById("btnLogoutHeader");
  const authTabs = document.querySelectorAll(".auth-tab-btn");
  const formLogin = document.getElementById("formAuthLogin");
  const formRegister = document.getElementById("formAuthRegister");

  // Restaura sessão se existir
  const savedSession = getActiveSessionUser();
  if (savedSession) {
    applyLoggedUserState(savedSession);
  }

  function switchAuthTab(mode) {
    showAuthFeedback("");
    authTabs.forEach(t => t.classList.toggle("active", t.getAttribute("data-auth-tab") === mode));
    if (formLogin) formLogin.style.display = mode === "login" ? "flex" : "none";
    if (formRegister) formRegister.style.display = mode === "register" ? "flex" : "none";
  }

  authTabs.forEach(btn => {
    btn.addEventListener("click", () => {
      switchAuthTab(btn.getAttribute("data-auth-tab"));
    });
  });

  if (btnOpenAuth && modalAuth) {
    btnOpenAuth.addEventListener("click", () => {
      showAuthFeedback("");
      modalAuth.classList.add("active");
    });
  }

  if (btnCloseAuthModal && modalAuth) {
    btnCloseAuthModal.addEventListener("click", () => {
      modalAuth.classList.remove("active");
    });
  }

  if (modalAuth) {
    modalAuth.addEventListener("click", (e) => {
      if (e.target === modalAuth) modalAuth.classList.remove("active");
    });
  }

  if (btnLogoutHeader) {
    btnLogoutHeader.addEventListener("click", () => {
      setActiveSessionUser(null);
      applyLoggedUserState(null);
    });
  }

  if (formRegister) {
    formRegister.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = (document.getElementById("regName")?.value || "").trim();
      const email = (document.getElementById("regEmail")?.value || "").trim().toLowerCase();
      const password = document.getElementById("regPassword")?.value || "";
      const plate = (document.getElementById("regPlate")?.value || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

      if (!name || !email || password.length < 4) {
        showAuthFeedback("Preencha nome, e-mail válido e senha com no mínimo 4 caracteres.", "error");
        return;
      }

      const users = getStoredUsers();
      if (users.some(u => u.email === email)) {
        showAuthFeedback("Já existe uma conta cadastrada com este e-mail. Use a aba Entrar.", "error");
        return;
      }

      const newUser = {
        id: "usr_" + Date.now(),
        name,
        email,
        password
      };

      users.push(newUser);
      saveStoredUsers(users);

      const sessionUser = { id: newUser.id, name: newUser.name, email: newUser.email };
      setActiveSessionUser(sessionUser);
      applyLoggedUserState(sessionUser);

      showAuthFeedback("Conta criada com sucesso. Redirecionando...", "success");
      formRegister.reset();
      setTimeout(() => {
        if (modalAuth) modalAuth.classList.remove("active");
      }, 600);
    });
  }

  if (formLogin) {
    formLogin.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = (document.getElementById("loginEmail")?.value || "").trim().toLowerCase();
      const password = document.getElementById("loginPassword")?.value || "";

      const users = getStoredUsers();
      const found = users.find(u => u.email === email && u.password === password);

      if (!found) {
        showAuthFeedback("E-mail ou senha incorretos. Caso ainda não tenha cadastro, clique em Criar Conta.", "error");
        return;
      }

      const sessionUser = { id: found.id, name: found.name, email: found.email };
      setActiveSessionUser(sessionUser);
      applyLoggedUserState(sessionUser);

      showAuthFeedback("Acesso realizado com sucesso.", "success");
      formLogin.reset();
      setTimeout(() => {
        if (modalAuth) modalAuth.classList.remove("active");
      }, 500);
    });
  }
}

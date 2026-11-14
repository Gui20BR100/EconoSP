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
// Mega Base de Dados Atualizada do EconoSP: Pedágios Oficiais, Radares Fixos e Postos
const POINTS_DATA = [
  // ================= 1. PRAÇAS DE PEDÁGIO OFICIAIS DE SÃO PAULO =================
  // Sistema Anchieta-Imigrantes (Ecovias)
  {
    id: "toll-imigrantes-piratininga",
    name: "Pedágio Piratininga - Rod. dos Imigrantes",
    highway: "SP-160 Rodovia dos Imigrantes",
    km: "km 32",
    category: "toll",
    lat: -23.7710,
    lng: -46.5620,
    price: "R$ 36,80",
    priceNum: 36.80,
    concessionaire: "Ecovias",
    desc: "Praça principal de descida para a Baixada Santista. Cobrança unidirecional sentido litoral.",
    economyTip: "Na volta (sentido SP), o trecho não cobra pedágio. Pagamento por Sem Parar, ConectCar ou aproximação.",
    dangerTip: "Reduza a velocidade para 40 km/h ao transitar pelas pistas de cobrança automática."
  },
  {
    id: "toll-anchieta-riacho-grande",
    name: "Pedágio Riacho Grande - Rod. Anchieta",
    highway: "SP-150 Rodovia Anchieta",
    km: "km 31",
    category: "toll",
    lat: -23.7760,
    lng: -46.5370,
    price: "R$ 36,80",
    priceNum: 36.80,
    concessionaire: "Ecovias",
    desc: "Praça de cobrança da Via Anchieta sentido Litoral. Pista expressa com cabines manuais e automáticas.",
    economyTip: "Cobrança apenas na descida rumo a Santos e Cubatão. Subida para a capital é isenta.",
    dangerTip: "Neblina frequente no planalto antes da serra; redobre a atenção com caminhões."
  },
  {
    id: "toll-imigrantes-diadema",
    name: "Pedágio Bloqueio Diadema - Imigrantes",
    highway: "SP-160 Rodovia dos Imigrantes",
    km: "km 16",
    category: "toll",
    lat: -23.6840,
    lng: -46.6110,
    price: "R$ 4,20",
    priceNum: 4.20,
    concessionaire: "Ecovias",
    desc: "Praça de bloqueio no acesso municipal a Diadema.",
    economyTip: "Utilize acessos urbanos pela Av. Cupecê para evitar o bloqueio em deslocamentos curtos.",
    dangerTip: "Fique atento ao afunilamento de pista na aproximação das cabines."
  },
  {
    id: "toll-imigrantes-eldorado",
    name: "Pedágio Bloqueio Eldorado - Imigrantes",
    highway: "SP-160 Rodovia dos Imigrantes",
    km: "km 20",
    category: "toll",
    lat: -23.7120,
    lng: -46.5920,
    price: "R$ 4,20",
    priceNum: 4.20,
    concessionaire: "Ecovias",
    desc: "Praça de bloqueio no entroncamento do bairro Eldorado.",
    economyTip: "Cobrança pontual de acesso regional.",
    dangerTip: "Trecho com entrada e saída rápida de veículos."
  },
  {
    id: "toll-cubatao-piacaguera",
    name: "Pedágio Santos / Piaçaguera - Guarujá",
    highway: "SP-055 Rodovia Cônego Domênico Rangoni",
    km: "km 250",
    category: "toll",
    lat: -23.8850,
    lng: -46.4150,
    price: "R$ 16,40",
    priceNum: 16.40,
    concessionaire: "Ecovias",
    desc: "Praça de pedágio de ligação Cubatão / Santos / Guarujá.",
    economyTip: "Para o centro histórico de Santos pela Anchieta, não se passa por esta praça.",
    dangerTip: "Tráfego intenso de carretas de contêineres e produtos químicos."
  },

  // Sistema Ayrton Senna / Carvalho Pinto (Ecopistas)
  {
    id: "toll-ayrton-itaqua",
    name: "Pedágio Itaquaquecetuba - Rod. Ayrton Senna",
    highway: "SP-070 Rodovia Ayrton Senna",
    km: "km 32",
    category: "toll",
    lat: -23.4730,
    lng: -46.3310,
    price: "R$ 5,30",
    priceNum: 5.30,
    concessionaire: "Ecopistas",
    desc: "Praça bidirecional da Ayrton Senna na Região Metropolitana Leste.",
    economyTip: "Rota expressa mais segura que a Dutra, compensa pelo menor tempo e asfalto de primeira.",
    dangerTip: "Respeite o limite de 40 km/h nas cancelas automáticas 'Sem Parar'."
  },
  {
    id: "toll-ayrton-guararema",
    name: "Pedágio Guararema - Rod. Ayrton Senna / Carvalho Pinto",
    highway: "SP-070 Rodovia Ayrton Senna",
    km: "km 57",
    category: "toll",
    lat: -23.4080,
    lng: -46.1420,
    price: "R$ 4,90",
    priceNum: 4.90,
    concessionaire: "Ecopistas",
    desc: "Praça no entroncamento entre a Ayrton Senna e o início da Carvalho Pinto.",
    economyTip: "Excelente fluidez para quem segue ao Vale do Paraíba, Campos do Jordão ou Litoral Norte.",
    dangerTip: "Atenção à divisão de pistas para Mogi das Cruzes e São José dos Campos."
  },
  {
    id: "toll-carvalho-cacapava",
    name: "Pedágio Caçapava / SJC - Rod. Carvalho Pinto",
    highway: "SP-070 Rodovia Carvalho Pinto",
    km: "km 92",
    category: "toll",
    lat: -23.2450,
    lng: -45.8520,
    price: "R$ 4,70",
    priceNum: 4.70,
    concessionaire: "Ecopistas",
    desc: "Praça de pedágio no trecho de Caçapava da Carvalho Pinto.",
    economyTip: "Pistas largas e sem semáforos, excelente rendimento de combustível.",
    dangerTip: "Atenção ao vento lateral forte nos viadutos da região."
  },
  {
    id: "toll-carvalho-taubate",
    name: "Pedágio Taubaté - Rod. Carvalho Pinto",
    highway: "SP-070 Rodovia Carvalho Pinto",
    km: "km 114",
    category: "toll",
    lat: -23.0550,
    lng: -45.6120,
    price: "R$ 4,90",
    priceNum: 4.90,
    concessionaire: "Ecopistas",
    desc: "Última praça da Carvalho Pinto antes do entroncamento com a Rodovia Floriano Rodrigues Pinheiro e Dutra.",
    economyTip: "Acesso direto para Taubaté, Tremembé e serra de Campos do Jordão.",
    dangerTip: "Trânsito de retorno de feriados pode formar filas nas cabines manuais."
  },

  // Rodovia dos Tamoios (Concessionária Tamoios)
  {
    id: "toll-tamoios-jambeiro",
    name: "Pedágio Jambeiro - Rod. dos Tamoios",
    highway: "SP-099 Rodovia dos Tamoios",
    km: "km 16",
    category: "toll",
    lat: -23.3150,
    lng: -45.7520,
    price: "R$ 10,20",
    priceNum: 10.20,
    concessionaire: "Concessionária Tamoios",
    desc: "Primeira praça da Tamoios sentido Caraguatatuba e São Sebastião.",
    economyTip: "Pista duplicada do planalto garante velocidade constante de 80 km/h sem frear.",
    dangerTip: "Trecho com curvas abertas e fiscalização eletrônica por radares fixos."
  },
  {
    id: "toll-tamoios-paraibuna",
    name: "Pedágio Paraibuna - Rod. dos Tamoios",
    highway: "SP-099 Rodovia dos Tamoios",
    km: "km 59",
    category: "toll",
    lat: -23.4450,
    lng: -45.6150,
    price: "R$ 15,20",
    priceNum: 15.20,
    concessionaire: "Concessionária Tamoios",
    desc: "Segunda praça da Tamoios logo antes da entrada nos novos túneis da Serra do Mar.",
    economyTip: "A serra nova duplicada reduziu o tempo de descida em mais de 35 minutos.",
    dangerTip: "Mantenha faróis acesos e velocidade máxima de 80 km/h nos complexos de túneis."
  },

  // Sistema Castello Branco / Raposo Tavares (CCR Viaoeste)
  {
    id: "toll-castello-osasco",
    name: "Pedágio Osasco - Rod. Castello Branco",
    highway: "SP-280 Rodovia Castello Branco",
    km: "km 18",
    category: "toll",
    lat: -23.5180,
    lng: -46.8120,
    price: "R$ 6,20",
    priceNum: 6.20,
    concessionaire: "CCR Viaoeste",
    desc: "Praça de saída da capital rumo a Barueri, Alphaville e interior oeste.",
    economyTip: "Cobrança unidirecional interior; na volta para a capital não há cobrança nesta praça.",
    dangerTip: "Faixas expressas centrais têm tráfego rápido; evite mudanças bruscas de faixa."
  },
  {
    id: "toll-castello-barueri",
    name: "Pedágio Barueri / Tamboré - Castello Branco",
    highway: "SP-280 Rodovia Castello Branco",
    km: "km 20",
    category: "toll",
    lat: -23.5080,
    lng: -46.8450,
    price: "R$ 6,20",
    priceNum: 6.20,
    concessionaire: "CCR Viaoeste",
    desc: "Praça lateral de acesso às marginais de Alphaville e Tamboré.",
    economyTip: "Se seguir direto para o interior, use as pistas centrais sem passar pelas cabines laterais.",
    dangerTip: "Horário de pico entre 17h e 19h com retenções nas saídas para Alphaville."
  },
  {
    id: "toll-castello-itapevi",
    name: "Pedágio Itapevi - Rod. Castello Branco",
    highway: "SP-280 Rodovia Castello Branco",
    km: "km 32",
    category: "toll",
    lat: -23.4980,
    lng: -46.9620,
    price: "R$ 11,80",
    priceNum: 11.80,
    concessionaire: "CCR Viaoeste",
    desc: "Praça principal de cobrança da Castello Branco antes de São Roque e Sorocaba.",
    economyTip: "Via expressa de altíssima qualidade; permite cruzeiro a 120 km/h economizando tempo.",
    dangerTip: "Radares fixos de 120 km/h logo após a praça de cobrança."
  },
  {
    id: "toll-castello-itu",
    name: "Pedágio Itu - Rod. Senador José Ermírio de Moraes",
    highway: "SP-075 Rod. Castelinho",
    km: "km 15",
    category: "toll",
    lat: -23.3650,
    lng: -47.3450,
    price: "R$ 8,60",
    priceNum: 8.60,
    concessionaire: "Rodovias das Colinas",
    desc: "Ligação rápida entre a Castello Branco, Itu e Sorocaba Norte.",
    economyTip: "Pista plana e com baixo fluxo de caminhões pesados.",
    dangerTip: "Fique atento ao acesso à Rodovia do Açúcar."
  },
  {
    id: "toll-raposo-saoroque",
    name: "Pedágio São Roque - Rod. Raposo Tavares",
    highway: "SP-270 Rodovia Raposo Tavares",
    km: "km 46",
    category: "toll",
    lat: -23.5850,
    lng: -47.0510,
    price: "R$ 12,20",
    priceNum: 12.20,
    concessionaire: "CCR Viaoeste",
    desc: "Praça da Raposo Tavares no trecho montanhoso entre Vargem Grande Paulista e São Roque.",
    economyTip: "Rota alternativa à Castello Branco para Sorocaba com 1 pedágio a menos.",
    dangerTip: "Trecho sinuoso com velocidade controlada a 80 km/h."
  },
  {
    id: "toll-raposo-aluminio",
    name: "Pedágio Alumínio - Rod. Raposo Tavares",
    highway: "SP-270 Rodovia Raposo Tavares",
    km: "km 79",
    category: "toll",
    lat: -23.5450,
    lng: -47.2150,
    price: "R$ 11,60",
    priceNum: 11.60,
    concessionaire: "CCR Viaoeste",
    desc: "Praça de pedágio entre São Roque, Alumínio e Sorocaba.",
    economyTip: "Alternativa econômica para o centro e zona sul de Sorocaba.",
    dangerTip: "Cruzamento com áreas urbanas exige velocidade reduzida."
  },

  // Sistema Anhanguera / Bandeirantes (CCR AutoBAn)
  {
    id: "toll-bandeirantes-caieiras",
    name: "Pedágio Caieiras - Rod. dos Bandeirantes",
    highway: "SP-348 Rodovia dos Bandeirantes",
    km: "km 36",
    category: "toll",
    lat: -23.3500,
    lng: -46.8500,
    price: "R$ 11,80",
    priceNum: 11.80,
    concessionaire: "CCR AutoBAn",
    desc: "Primeira praça da Bandeirantes no sentido interior.",
    economyTip: "Rodovia com traçado perfeito e 120 km/h; mantém consumo eficiente em marcha alta.",
    dangerTip: "Cabines automáticas exigem transitar a 40 km/h sem parar."
  },
  {
    id: "toll-bandeirantes-itupeva",
    name: "Pedágio Itupeva - Rod. dos Bandeirantes",
    highway: "SP-348 Rodovia dos Bandeirantes",
    km: "km 77",
    category: "toll",
    lat: -23.1150,
    lng: -47.0150,
    price: "R$ 11,80",
    priceNum: 11.80,
    concessionaire: "CCR AutoBAn",
    desc: "Segunda praça da Bandeirantes antes da entrada de Campinas.",
    economyTip: "Ao lado dos postos Serrazul e Hopi Hari com opções completas de parada.",
    dangerTip: "Forte movimentação de veículos aos fins de semana e feriados."
  },
  {
    id: "toll-bandeirantes-sumare",
    name: "Pedágio Sumaré - Rod. dos Bandeirantes",
    highway: "SP-348 Rodovia dos Bandeirantes",
    km: "km 115",
    category: "toll",
    lat: -22.8450,
    lng: -47.2850,
    price: "R$ 10,90",
    priceNum: 10.90,
    concessionaire: "CCR AutoBAn",
    desc: "Praça de continuação rumo a Limeira, Americana e interior norte.",
    economyTip: "Pistas triplas e asfalto de alto padrão.",
    dangerTip: "Atenção às placas de acesso à Rodovia Anhanguera."
  },
  {
    id: "toll-anhanguera-perus",
    name: "Pedágio Perus - Rod. Anhanguera",
    highway: "SP-330 Rodovia Anhanguera",
    km: "km 26",
    category: "toll",
    lat: -23.4150,
    lng: -46.7850,
    price: "R$ 11,80",
    priceNum: 11.80,
    concessionaire: "CCR AutoBAn",
    desc: "Primeira praça da Anhanguera saindo da capital para Jundiaí e Campinas.",
    economyTip: "Trecho com postos de combustível com preços competitivos nas pistas marginais.",
    dangerTip: "Tráfego intenso de caminhões e veículos comerciais na faixa da direita."
  },
  {
    id: "toll-anhanguera-valinhos",
    name: "Pedágio Valinhos - Rod. Anhanguera",
    highway: "SP-330 Rodovia Anhanguera",
    km: "km 82",
    category: "toll",
    lat: -22.9950,
    lng: -47.0450,
    price: "R$ 11,60",
    priceNum: 11.60,
    concessionaire: "CCR AutoBAn",
    desc: "Praça da Anhanguera no acesso a Valinhos e Campinas Sul.",
    economyTip: "Acesso rápido ao anel viário Magalhães Teixeira e à Dom Pedro I.",
    dangerTip: "Reduza na aproximação das faixas de cobrança manual e automática."
  },
  {
    id: "toll-anhanguera-novaodessa",
    name: "Pedágio Nova Odessa - Rod. Anhanguera",
    highway: "SP-330 Rodovia Anhanguera",
    km: "km 118",
    category: "toll",
    lat: -22.7850,
    lng: -47.3150,
    price: "R$ 10,90",
    priceNum: 10.90,
    concessionaire: "CCR AutoBAn",
    desc: "Praça entre Americana, Santa Bárbara d'Oeste e Nova Odessa.",
    economyTip: "Trecho plano com excelente rendimento de combustível.",
    dangerTip: "Radares de velocidade em pontos estratégicos do canteiro central."
  },
  {
    id: "toll-anhanguera-limeira",
    name: "Pedágio Limeira - Rod. Anhanguera",
    highway: "SP-330 Rodovia Anhanguera",
    km: "km 152",
    category: "toll",
    lat: -22.5850,
    lng: -47.4250,
    price: "R$ 8,80",
    priceNum: 8.80,
    concessionaire: "CCR AutoBAn",
    desc: "Praça de transição para o interior centro-norte (Ribeirão Preto e São Carlos).",
    economyTip: "Conexão direta com a Rodovia Washington Luís (SP-310).",
    dangerTip: "Mantenha distância de segurança dos veículos pesados."
  },

  // Rodoanel Mário Covas (SP-021)
  {
    id: "toll-rodoanel-padroeira",
    name: "Pedágio Rodoanel Oeste - Padroeira / Barueri",
    highway: "SP-021 Rodoanel Mário Covas",
    km: "km 13",
    category: "toll",
    lat: -23.5420,
    lng: -46.8020,
    price: "R$ 4,90",
    priceNum: 4.90,
    concessionaire: "CCR RodoAnel",
    desc: "Praça do Trecho Oeste com conexão para Castello Branco e Raposo Tavares.",
    economyTip: "Excelente via expressa para desviar do trânsito das Marginais de SP.",
    dangerTip: "Velocidade máxima de 100 km/h rigidamente fiscalizada por radares."
  },
  {
    id: "toll-rodoanel-raposo",
    name: "Pedágio Rodoanel Oeste - Raposo Tavares",
    highway: "SP-021 Rodoanel Mário Covas",
    km: "km 24",
    category: "toll",
    lat: -23.5950,
    lng: -46.8250,
    price: "R$ 4,90",
    priceNum: 4.90,
    concessionaire: "CCR RodoAnel",
    desc: "Praça de entroncamento do Trecho Oeste com a Rodovia Raposo Tavares.",
    economyTip: "Permite contornar Carapicuíba e Osasco rapidamente.",
    dangerTip: "Cuidado com retenções nas alças de acesso nos horários de pico."
  },
  {
    id: "toll-rodoanel-embu",
    name: "Pedágio Rodoanel Sul - Embu das Artes",
    highway: "SP-021 Rodoanel Mário Covas",
    km: "km 30",
    category: "toll",
    lat: -23.6650,
    lng: -46.8350,
    price: "R$ 4,70",
    priceNum: 4.70,
    concessionaire: "SPMar",
    desc: "Início do Trecho Sul conectando a Régis Bittencourt ao sistema Anchieta/Imigrantes.",
    economyTip: "Evita completamente as avenidas Francisco Morato e Giovanni Gronchi.",
    dangerTip: "Pista moderna com viadutos altos sobre a represa."
  },
  {
    id: "toll-rodoanel-grajau",
    name: "Pedágio Rodoanel Sul - Grajaú / Parelheiros",
    highway: "SP-021 Rodoanel Mário Covas",
    km: "km 47",
    category: "toll",
    lat: -23.7550,
    lng: -46.7150,
    price: "R$ 4,70",
    priceNum: 4.70,
    concessionaire: "SPMar",
    desc: "Praça central do Trecho Sul do Rodoanel sobre a Represa Billings.",
    economyTip: "Rota expressa para o Litoral Sul e Porto de Santos vindo do interior.",
    dangerTip: "Área sujeita a neblina densa nas primeiras horas da manhã."
  },
  {
    id: "toll-rodoanel-imigrantes",
    name: "Pedágio Rodoanel Sul - Acesso Imigrantes",
    highway: "SP-021 Rodoanel Mário Covas",
    km: "km 60",
    category: "toll",
    lat: -23.7420,
    lng: -46.5920,
    price: "R$ 4,70",
    priceNum: 4.70,
    concessionaire: "SPMar",
    desc: "Interligação direta entre o Rodoanel Sul e as rodovias Imigrantes e Anchieta.",
    economyTip: "Acesso sem semáforos direto para o planalto de descida da serra.",
    dangerTip: "Atenção às placas indicativas para não errar a saída Imigrantes / Anchieta."
  },
  {
    id: "toll-rodoanel-maua",
    name: "Pedágio Rodoanel Leste - Mauá / Suzano",
    highway: "SP-021 Rodoanel Mário Covas",
    km: "km 86",
    category: "toll",
    lat: -23.6450,
    lng: -46.4250,
    price: "R$ 3,80",
    priceNum: 3.80,
    concessionaire: "SPMar",
    desc: "Trecho Leste ligando o ABC Paulista ao Alto Tietê e Ayrton Senna.",
    economyTip: "Tarifa reduzida e excelente conexão sem semáforos.",
    dangerTip: "Trecho com curvas longas e limite de 100 km/h."
  },
  {
    id: "toll-rodoanel-itaqua",
    name: "Pedágio Rodoanel Leste - Itaquaquecetuba / Dutra",
    highway: "SP-021 Rodoanel Mário Covas",
    km: "km 115",
    category: "toll",
    lat: -23.4550,
    lng: -46.3550,
    price: "R$ 3,80",
    priceNum: 3.80,
    concessionaire: "SPMar",
    desc: "Entroncamento do Trecho Leste com as rodovias Ayrton Senna e Presidente Dutra.",
    economyTip: "Evita o trânsito da Marginal Tietê para quem cruza do Vale do Paraíba para o ABC.",
    dangerTip: "Reduza na aproximação do entroncamento com a BR-116."
  },

  // Rodovia Presidente Dutra (CCR RioSP / ANTT)
  {
    id: "toll-dutra-aruja",
    name: "Pedágio Arujá - Rod. Presidente Dutra",
    highway: "BR-116 Presidente Dutra",
    km: "km 204",
    category: "toll",
    lat: -23.3850,
    lng: -46.3150,
    price: "R$ 4,10",
    priceNum: 4.10,
    concessionaire: "CCR RioSP",
    desc: "Primeira praça da Via Dutra saindo de SP/Guarulhos rumo ao Vale do Paraíba e Rio.",
    economyTip: "Cobrança com desconto progressivo para quem usa TAG eletrônica frequente.",
    dangerTip: "Tráfego intenso de veículos pesados nas saídas para Arujá e Mogi das Cruzes."
  },
  {
    id: "toll-dutra-guararema",
    name: "Pedágio Guararema / Jacareí - Rod. Presidente Dutra",
    highway: "BR-116 Presidente Dutra",
    km: "km 165",
    category: "toll",
    lat: -23.2850,
    lng: -46.0150,
    price: "R$ 7,90",
    priceNum: 7.90,
    concessionaire: "CCR RioSP",
    desc: "Praça da Dutra na divisa entre Guararema e Jacareí.",
    economyTip: "Alternativa gratuita paralela não compensa em relação à segurança da via duplicada.",
    dangerTip: "Radares fixos nos dois sentidos antes e depois da praça."
  },
  {
    id: "toll-dutra-moreiracesar",
    name: "Pedágio Moreira César - Rod. Presidente Dutra",
    highway: "BR-116 Presidente Dutra",
    km: "km 88",
    category: "toll",
    lat: -22.9550,
    lng: -45.3850,
    price: "R$ 16,40",
    priceNum: 16.40,
    concessionaire: "CCR RioSP",
    desc: "Praça no trecho de Pindamonhangaba / Aparecida do Norte.",
    economyTip: "Fique atento às faixas automáticas Free Flow / Sem Parar.",
    dangerTip: "Movimento intenso de romeiros e peregrinos no acostamento em períodos religiosos."
  },
  {
    id: "toll-dutra-itatiaia",
    name: "Pedágio Itatiaia - Rod. Presidente Dutra",
    highway: "BR-116 Presidente Dutra",
    km: "km 318",
    category: "toll",
    lat: -22.4950,
    lng: -44.5750,
    price: "R$ 16,40",
    priceNum: 16.40,
    concessionaire: "CCR RioSP",
    desc: "Praça na divisa de SP com o Estado do Rio de Janeiro.",
    economyTip: "Controle a velocidade antes da descida da Serra das Araras.",
    dangerTip: "Trecho montanhoso com curvas perigosas e fiscalização por radar."
  },

  // Rodovia Dom Pedro I (Rota das Bandeiras)
  {
    id: "toll-dompedro-igarata",
    name: "Pedágio Igaratá - Rod. Dom Pedro I",
    highway: "SP-065 Rodovia Dom Pedro I",
    km: "km 26",
    category: "toll",
    lat: -23.2150,
    lng: -46.1250,
    price: "R$ 11,70",
    priceNum: 11.70,
    concessionaire: "Rota das Bandeiras",
    desc: "Praça entre a Carvalho Pinto/Dutra e Atibaia.",
    economyTip: "Excelente ligação leste-norte entre o Vale do Paraíba e a região de Campinas.",
    dangerTip: "Curvas em descida exigem atenção com veículos lentos."
  },
  {
    id: "toll-dompedro-atibaia",
    name: "Pedágio Atibaia - Rod. Dom Pedro I",
    highway: "SP-065 Rodovia Dom Pedro I",
    km: "km 79",
    category: "toll",
    lat: -23.1350,
    lng: -46.6150,
    price: "R$ 9,80",
    priceNum: 9.80,
    concessionaire: "Rota das Bandeiras",
    desc: "Praça no cruzamento com a Rodovia Fernão Dias.",
    economyTip: "Permite fácil acesso ao sul de Minas Gerais e Bragança Paulista.",
    dangerTip: "Trecho com alto tráfego nos fins de semana turísticos."
  },
  {
    id: "toll-dompedro-itatiba",
    name: "Pedágio Itatiba - Rod. Dom Pedro I",
    highway: "SP-065 Rodovia Dom Pedro I",
    km: "km 110",
    category: "toll",
    lat: -22.9950,
    lng: -46.8850,
    price: "R$ 12,60",
    priceNum: 12.60,
    concessionaire: "Rota das Bandeiras",
    desc: "Praça no trecho final da Dom Pedro I antes de Campinas.",
    economyTip: "Acesso direto aos grandes shoppings e universidades de Campinas.",
    dangerTip: "Fique atento ao afunilamento de pistas no anel viário de Campinas."
  },

  // Rodovia Fernão Dias (Arteris)
  {
    id: "toll-fernao-mairipora",
    name: "Pedágio Mairiporã - Rod. Fernão Dias",
    highway: "BR-381 Rodovia Fernão Dias",
    km: "km 65",
    category: "toll",
    lat: -23.3150,
    lng: -46.5850,
    price: "R$ 2,90",
    priceNum: 2.90,
    concessionaire: "Arteris Fernão Dias",
    desc: "Praça federal de tarifa baixa saindo de SP para o norte do estado e BH.",
    economyTip: "Uma das tarifas mais econômicas do estado por ser concessão federal.",
    dangerTip: "Trecho de serra da Cantareira com curvas fechadas e neblina noturna."
  },
  {
    id: "toll-fernao-vargem",
    name: "Pedágio Vargem / Bragança - Rod. Fernão Dias",
    highway: "BR-381 Rodovia Fernão Dias",
    km: "km 7",
    category: "toll",
    lat: -22.8850,
    lng: -46.4250,
    price: "R$ 2,90",
    priceNum: 2.90,
    concessionaire: "Arteris Fernão Dias",
    desc: "Praça na divisa com Minas Gerais (próximo a Extrema).",
    economyTip: "Excelente fluidez para turismo gastronômico na serra da Mantiqueira.",
    dangerTip: "Tráfego de carretas pesadas subindo a serra; mantenha a esquerda se estiver em carro de passeio."
  },

  // Rodovia Régis Bittencourt (Arteris)
  {
    id: "toll-regis-saolourenco",
    name: "Pedágio São Lourenço da Serra - Régis Bittencourt",
    highway: "BR-116 Régis Bittencourt",
    km: "km 298",
    category: "toll",
    lat: -23.8650,
    lng: -46.9450,
    price: "R$ 4,00",
    priceNum: 4.00,
    concessionaire: "Arteris Régis Bittencourt",
    desc: "Primeira praça da Régis sentido Curitiba e Sul do país.",
    economyTip: "Tarifa federal moderada com pistas totalmente duplicadas.",
    dangerTip: "Pista com curvas e descida acentuada rumo ao Vale do Ribeira."
  },
  {
    id: "toll-regis-miracatu",
    name: "Pedágio Miracatu - Régis Bittencourt",
    highway: "BR-116 Régis Bittencourt",
    km: "km 370",
    category: "toll",
    lat: -24.2850,
    lng: -47.4550,
    price: "R$ 4,00",
    priceNum: 4.00,
    concessionaire: "Arteris Régis Bittencourt",
    desc: "Praça no trecho central do Vale do Ribeira após a Serra do Cafezal.",
    economyTip: "Serra do Cafezal duplicada garante descida segura e sem congestionamentos crônicos.",
    dangerTip: "Cuidado com animais silvestres e chuva torrencial frequente."
  },

  // Rodovia Washington Luís (Ecorodovias)
  {
    id: "toll-washington-rioclaro",
    name: "Pedágio Rio Claro - Rod. Washington Luís",
    highway: "SP-310 Rodovia Washington Luís",
    km: "km 181",
    category: "toll",
    lat: -22.4250,
    lng: -47.5650,
    price: "R$ 10,60",
    priceNum: 10.60,
    concessionaire: "Ecorodovias",
    desc: "Praça de ligação entre Cordeirópolis, Rio Claro e São Carlos.",
    economyTip: "Rodovia plana e com limite de 110 km/h, excelente rendimento de combustível.",
    dangerTip: "Radares fixos nos dois sentidos nos trechos de passagem urbana."
  },
  {
    id: "toll-washington-itirapina",
    name: "Pedágio Itirapina - Rod. Washington Luís",
    highway: "SP-310 Rodovia Washington Luís",
    km: "km 217",
    category: "toll",
    lat: -22.2550,
    lng: -47.8250,
    price: "R$ 6,80",
    priceNum: 6.80,
    concessionaire: "Ecorodovias",
    desc: "Praça antes da serra de São Carlos e acesso a Brotas.",
    economyTip: "Tarifa reduzida no trecho de transição.",
    dangerTip: "Fique atento à fiscalização eletrônica antes da serra."
  },

  // Rodovia Mogi-Dutra (SP-088)
  {
    id: "toll-mogidutra-aruja",
    name: "Pedágio Mogi-Dutra - Arujá",
    highway: "SP-088 Rodovia Pedro Eroles (Mogi-Dutra)",
    km: "km 40",
    category: "toll",
    lat: -23.4150,
    lng: -46.2850,
    price: "R$ 4,80",
    priceNum: 4.80,
    concessionaire: "DER-SP",
    desc: "Praça de ligação entre a Via Dutra e o centro de Mogi das Cruzes.",
    economyTip: "Conexão rápida com a Mogi-Bertioga para evitar os pedágios da Carvalho Pinto.",
    dangerTip: "Pista com tráfego urbano pesado nos horários de entrada e saída comercial."
  },

  // ================= 2. BANCO AMPLIADO DE RADARES FIXOS EM SÃO PAULO =================
  // Marginais e Expressas da Capital SP
  {
    id: "rad-marg-tiete-01",
    name: "Radar Fixo 70 km/h - Marginal Tietê (Ponte das Bandeiras)",
    highway: "Marginal Tietê (Pista Expressa, km 12)",
    km: "km 12",
    category: "radar",
    lat: -23.5175,
    lng: -46.6275,
    speed: "70 km/h",
    dangerTip: "Câmera de fiscalização de velocidade instalada na estrutura da passarela.",
    economyTip: "Mantenha velocidade constante para poupar combustível na pista expressa."
  },
  {
    id: "rad-marg-tiete-02",
    name: "Radar Fixo 50 km/h - Marginal Tietê (Pista Local / Ponte da Casa Verde)",
    highway: "Marginal Tietê (Pista Local, km 14)",
    km: "km 14",
    category: "radar",
    lat: -23.5135,
    lng: -46.6540,
    speed: "50 km/h",
    dangerTip: "Fiscalização rigorosa de velocidade e faixa exclusiva de ônibus.",
    economyTip: "Prefira a pista central ou expressa para cruzar a cidade com menos paradas."
  },
  {
    id: "rad-marg-tiete-03",
    name: "Radar Fixo 90 km/h - Marginal Tietê (Pista Central / Vila Maria)",
    highway: "Marginal Tietê (Pista Central, km 8)",
    km: "km 8",
    category: "radar",
    lat: -23.5180,
    lng: -46.5950,
    speed: "90 km/h",
    dangerTip: "Câmeras de alta resolução nos dois sentidos (Castello e Ayrton Senna).",
    economyTip: "Evite aceleradas bruscas nos acessos entre as pistas central e expressa."
  },
  {
    id: "rad-marg-tiete-04",
    name: "Radar Fixo 70 km/h - Marginal Tietê (Ponte do Piqueri / Lapa)",
    highway: "Marginal Tietê (Pista Expressa, km 20)",
    km: "km 20",
    category: "radar",
    lat: -23.5120,
    lng: -46.7080,
    speed: "70 km/h",
    dangerTip: "Fiscalização antes da bifurcação para a Rodovia Castello Branco e Cebolão.",
    economyTip: "Posicione-se com antecedência na faixa correspondente ao seu destino."
  },
  {
    id: "rad-marg-pinheiros-01",
    name: "Radar Fixo 70 km/h - Marginal Pinheiros (Ponte Eusébio Matoso)",
    highway: "Marginal Pinheiros (Pista Expressa, km 5)",
    km: "km 5",
    category: "radar",
    lat: -23.5685,
    lng: -46.7020,
    speed: "70 km/h",
    dangerTip: "Câmeras suspensas em pórtico metálico sentido Interlagos.",
    economyTip: "Controle suave de acelerador economiza até 12% na pista expressa."
  },
  {
    id: "rad-marg-pinheiros-02",
    name: "Radar Fixo 70 km/h - Marginal Pinheiros (Ponte Cidade Jardim)",
    highway: "Marginal Pinheiros (Pista Expressa, km 7)",
    km: "km 7",
    category: "radar",
    lat: -23.5890,
    lng: -46.6960,
    speed: "70 km/h",
    dangerTip: "Fiscalização eletrônica sob a ponte nos dois sentidos.",
    economyTip: "Cruzeiro suave sem frear bruscamente evita colisões traseiras."
  },
  {
    id: "rad-marg-pinheiros-03",
    name: "Radar Fixo 70 km/h - Marginal Pinheiros (Ponte Estaiada / Berrini)",
    highway: "Marginal Pinheiros (Pista Expressa, km 11)",
    km: "km 11",
    category: "radar",
    lat: -23.6120,
    lng: -46.6980,
    speed: "70 km/h",
    dangerTip: "Pórtico eletrônico com leitura de placas e velocidade.",
    economyTip: "Acesso direto à Ponte Estaiada e Av. Jornalista Roberto Marinho."
  },
  {
    id: "rad-marg-pinheiros-04",
    name: "Radar Fixo 70 km/h - Marginal Pinheiros (Ponte João Dias)",
    highway: "Marginal Pinheiros (Pista Expressa, km 15)",
    km: "km 15",
    category: "radar",
    lat: -23.6480,
    lng: -46.7210,
    speed: "70 km/h",
    dangerTip: "Fiscalização antes da chegada a Santo Amaro e Interlagos.",
    economyTip: "Pista ampla e com sinalização clara de velocidade máxima."
  },
  {
    id: "rad-av-23maio-01",
    name: "Radar Fixo 60 km/h - Av. 23 de Maio (Viaduto Santa Generosa)",
    highway: "Corredor Norte-Sul (km 3)",
    km: "km 3",
    category: "radar",
    lat: -23.5780,
    lng: -46.6430,
    speed: "60 km/h",
    dangerTip: "Radar de velocidade e rodízio municipal instalado sob o viaduto.",
    economyTip: "Respeite os 60 km/h contínuos para sincronizar a onda verde dos semáforos adiante."
  },
  {
    id: "rad-av-23maio-02",
    name: "Radar Fixo 60 km/h - Av. 23 de Maio (Túnel Ayrton Senna)",
    highway: "Corredor Norte-Sul (km 5)",
    km: "km 5",
    category: "radar",
    lat: -23.5860,
    lng: -46.6540,
    speed: "60 km/h",
    dangerTip: "Fiscalização rigorosa na entrada e saída do complexo viário.",
    economyTip: "Mantenha faróis baixos acesos no interior do túnel."
  },
  {
    id: "rad-av-bandeirantes-01",
    name: "Radar Fixo 50 km/h - Av. dos Bandeirantes (Aeroporto Congonhas)",
    highway: "Av. dos Bandeirantes (km 6)",
    km: "km 6",
    category: "radar",
    lat: -23.6080,
    lng: -46.6690,
    speed: "50 km/h",
    dangerTip: "Fiscalização em ambos os sentidos com grande fluxo de táxis e transfers.",
    economyTip: "Avenida com muitos semáforos; evite arrancadas rápidas."
  },
  {
    id: "rad-av-radial-01",
    name: "Radar Fixo 60 km/h - Radial Leste (Metrô Tatuapé)",
    highway: "Av. Radial Leste (km 6)",
    km: "km 6",
    category: "radar",
    lat: -23.5390,
    lng: -46.5780,
    speed: "60 km/h",
    dangerTip: "Pórtico sobre a via expressa com fiscalização de velocidade e rodízio.",
    economyTip: "Mantenha velocidade constante para fluidez no trajeto Leste-Centro."
  },
  {
    id: "rad-av-salim-01",
    name: "Radar Fixo 60 km/h - Av. Salim Farah Maluf",
    highway: "Av. Salim Farah Maluf (km 4)",
    km: "km 4",
    category: "radar",
    lat: -23.5580,
    lng: -46.5740,
    speed: "60 km/h",
    dangerTip: "Radar fixo nos dois sentidos na ligação Anchieta-Tietê.",
    economyTip: "Crucial conexão de quem vem da Anchieta rumo à Dutra e Ayrton Senna."
  },
  {
    id: "rad-av-morato-01",
    name: "Radar Fixo 50 km/h - Av. Prof. Francisco Morato (Caxingui)",
    highway: "Av. Prof. Francisco Morato (km 3)",
    km: "km 3",
    category: "radar",
    lat: -23.5780,
    lng: -46.7180,
    speed: "50 km/h",
    dangerTip: "Radar de velocidade e corredor de ônibus à direita.",
    economyTip: "Prefira a pista central para evitar desacelerações de ônibus."
  },

  // Rodovia dos Imigrantes (SP-160)
  {
    id: "rad-imigrantes-km16",
    name: "Radar Fixo 100 km/h - Rod. Imigrantes (Diadema)",
    highway: "SP-160 Rodovia dos Imigrantes",
    km: "km 16",
    category: "radar",
    lat: -23.6820,
    lng: -46.6120,
    speed: "100 km/h",
    dangerTip: "Radar em pórtico no trecho de transição da capital para o ABC.",
    economyTip: "Pista com pavimento de concreto plano; excelente para pilotagem suave."
  },
  {
    id: "rad-imigrantes-km21",
    name: "Radar Fixo 110 km/h - Rod. Imigrantes (São Bernardo)",
    highway: "SP-160 Rodovia dos Imigrantes",
    km: "km 21",
    category: "radar",
    lat: -23.7180,
    lng: -46.5820,
    speed: "110 km/h",
    dangerTip: "Radar fixo antes do entroncamento com o Rodoanel Sul.",
    economyTip: "Velocidade constante em 5ª/6ª marcha gera menor gasto de etanol/gasolina."
  },
  {
    id: "rad-imigrantes-km41",
    name: "Radar Fixo 110 km/h - Rod. Imigrantes (Planalto)",
    highway: "SP-160 Rodovia dos Imigrantes",
    km: "km 41",
    category: "radar",
    lat: -23.8210,
    lng: -46.5410,
    speed: "110 km/h",
    dangerTip: "Último radar do planalto antes da entrada nos túneis de descida.",
    economyTip: "Verifique temperatura do motor e freios antes de iniciar a descida da serra."
  },
  {
    id: "rad-imigrantes-km58",
    name: "Radar Fixo 80 km/h - Rod. Imigrantes (Descida da Serra / Túnel)",
    highway: "SP-160 Rodovia dos Imigrantes",
    km: "km 58",
    category: "radar",
    lat: -23.9150,
    lng: -46.5150,
    speed: "80 km/h",
    dangerTip: "Fiscalização no complexo de túneis da Serra do Mar. Limite reduzido!",
    economyTip: "Use freio-motor engrenado em 3ª ou 4ª marcha para não superaquecer as pastilhas."
  },

  // Rodovia Anchieta (SP-150)
  {
    id: "rad-anchieta-km18",
    name: "Radar Fixo 90 km/h - Rod. Anchieta (SBC Centro)",
    highway: "SP-150 Rodovia Anchieta",
    km: "km 18",
    category: "radar",
    lat: -23.6950,
    lng: -46.5680,
    speed: "90 km/h",
    dangerTip: "Radar instalado no canteiro central em trecho de pista expressa.",
    economyTip: "Ao lado de grandes polos industriais e postos com preços em conta."
  },
  {
    id: "rad-anchieta-km29",
    name: "Radar Fixo 90 km/h - Rod. Anchieta (Riacho Grande)",
    highway: "SP-150 Rodovia Anchieta",
    km: "km 29",
    category: "radar",
    lat: -23.7650,
    lng: -46.5450,
    speed: "90 km/h",
    dangerTip: "Fiscalização antes da aproximação da praça de pedágio.",
    economyTip: "Atenção à sinalização de caminhões obrigados à pista da direita."
  },
  {
    id: "rad-anchieta-km43",
    name: "Radar Fixo 60 km/h - Rod. Anchieta (Serra Antiga)",
    highway: "SP-150 Rodovia Anchieta",
    km: "km 43",
    category: "radar",
    lat: -23.8450,
    lng: -46.5050,
    speed: "60 km/h",
    dangerTip: "Curvas muito sinuosas na serra antiga; limite de 60 km/h para veículos de passeio e 40 km/h pesados.",
    economyTip: "Desça com calma mantendo distância de segurança das carretas."
  },

  // Rodovia Ayrton Senna (SP-070)
  {
    id: "rad-ayrton-km19",
    name: "Radar Fixo 120 km/h - Rod. Ayrton Senna (Guarulhos / Cumbica)",
    highway: "SP-070 Rodovia Ayrton Senna",
    km: "km 19",
    category: "radar",
    lat: -23.4880,
    lng: -46.4650,
    speed: "120 km/h",
    dangerTip: "Pórtico eletrônico com câmeras para automóveis (120 km/h) e pesados (90 km/h).",
    economyTip: "Pista quádrupla ampla; use a terceira faixa para cruzeiro tranquilo."
  },
  {
    id: "rad-ayrton-km28",
    name: "Radar Fixo 120 km/h - Rod. Ayrton Senna (Itaquaquecetuba)",
    highway: "SP-070 Rodovia Ayrton Senna",
    km: "km 28",
    category: "radar",
    lat: -23.4750,
    lng: -46.3650,
    speed: "120 km/h",
    dangerTip: "Radar de velocidade antes da praça de pedágio de Itaquaquecetuba.",
    economyTip: "Reduza suavemente a velocidade até o pedágio para não desperdiçar energia cinética."
  },
  {
    id: "rad-ayrton-km45",
    name: "Radar Fixo 120 km/h - Rod. Ayrton Senna (Mogi das Cruzes)",
    highway: "SP-070 Rodovia Ayrton Senna",
    km: "km 45",
    category: "radar",
    lat: -23.4450,
    lng: -46.2250,
    speed: "120 km/h",
    dangerTip: "Pórtico no entroncamento com a Mogi-Dutra.",
    economyTip: "Pista com excelente asfalto e curvas abertas."
  },

  // Rodovia Carvalho Pinto (SP-070)
  {
    id: "rad-carvalho-km72",
    name: "Radar Fixo 120 km/h - Rod. Carvalho Pinto (São José dos Campos)",
    highway: "SP-070 Rodovia Carvalho Pinto",
    km: "km 72",
    category: "radar",
    lat: -23.3250,
    lng: -45.9800,
    speed: "120 km/h",
    dangerTip: "Câmera no canteiro central em reta longa e com vento cruzado.",
    economyTip: "Rota excelente com baixo consumo em velocidade de cruzeiro."
  },
  {
    id: "rad-carvalho-km98",
    name: "Radar Fixo 120 km/h - Rod. Carvalho Pinto (Caçapava)",
    highway: "SP-070 Rodovia Carvalho Pinto",
    km: "km 98",
    category: "radar",
    lat: -23.2150,
    lng: -45.7850,
    speed: "120 km/h",
    dangerTip: "Fiscalização nos dois sentidos da rodovia.",
    economyTip: "Evite passar de 120 km/h para não disparar a resistência aerodinâmica e o consumo."
  },

  // Rodovia dos Tamoios (SP-099)
  {
    id: "rad-tamoios-km14",
    name: "Radar Fixo 80 km/h - Rod. dos Tamoios (Jambeiro)",
    highway: "SP-099 Rodovia dos Tamoios",
    km: "km 14",
    category: "radar",
    lat: -23.2850,
    lng: -45.7850,
    speed: "80 km/h",
    dangerTip: "Radar fixo no trecho inicial duplicado antes da primeira praça de pedágio.",
    economyTip: "Velocidade padrão de 80 km/h garante máxima segurança e economia na Tamoios."
  },
  {
    id: "rad-tamoios-km28",
    name: "Radar Fixo 80 km/h - Rod. dos Tamoios (Paraibuna)",
    highway: "SP-099 Rodovia dos Tamoios",
    km: "km 28",
    category: "radar",
    lat: -23.3650,
    lng: -45.6850,
    speed: "80 km/h",
    dangerTip: "Fiscalização em descida leve próximo à represa de Paraibuna.",
    economyTip: "Aproveite a inércia do veículo sem acelerar nas descidas suaves."
  },
  {
    id: "rad-tamoios-km64",
    name: "Radar Fixo 80 km/h - Rod. dos Tamoios (Túneis Serra Nova)",
    highway: "SP-099 Rodovia dos Tamoios",
    km: "km 64",
    category: "radar",
    lat: -23.5450,
    lng: -45.5150,
    speed: "80 km/h",
    dangerTip: "Fiscalização contínua nos túneis mais longos do Brasil. Não ultrapasse 80 km/h!",
    economyTip: "Sinal de rádio FM e ventilação inteligente ativa dentro dos túneis."
  },

  // Rodovia Castello Branco (SP-280)
  {
    id: "rad-castello-km15",
    name: "Radar Fixo 100 km/h - Rod. Castello Branco (Osasco)",
    highway: "SP-280 Rodovia Castello Branco",
    km: "km 15",
    category: "radar",
    lat: -23.5250,
    lng: -46.7750,
    speed: "100 km/h",
    dangerTip: "Radar de pórtico logo após a saída do Cebolão / Marginal Tietê.",
    economyTip: "Pistas marginais têm limite menor (70 km/h); atenção às placas."
  },
  {
    id: "rad-castello-km24",
    name: "Radar Fixo 100 km/h - Rod. Castello Branco (Alphaville)",
    highway: "SP-280 Rodovia Castello Branco",
    km: "km 24",
    category: "radar",
    lat: -23.5050,
    lng: -46.8650,
    speed: "100 km/h",
    dangerTip: "Câmeras de controle na saída para Barueri e Alphaville.",
    economyTip: "Pista central é mais rápida e livre de gargalos comerciais."
  },
  {
    id: "rad-castello-km45",
    name: "Radar Fixo 120 km/h - Rod. Castello Branco (Araçariguama)",
    highway: "SP-280 Rodovia Castello Branco",
    km: "km 45",
    category: "radar",
    lat: -23.4650,
    lng: -47.1250,
    speed: "120 km/h",
    dangerTip: "Fiscalização em reta com declive acentuado.",
    economyTip: "Excelente ponto para manter velocidade em piloto automático."
  },
  {
    id: "rad-castello-km68",
    name: "Radar Fixo 120 km/h - Rod. Castello Branco (Itu / Sorocaba)",
    highway: "SP-280 Rodovia Castello Branco",
    km: "km 68",
    category: "radar",
    lat: -23.4150,
    lng: -47.2850,
    speed: "120 km/h",
    dangerTip: "Pórtico antes do acesso à Castelinho (SP-075) para Sorocaba.",
    economyTip: "Mantenha a faixa correta com antecedência para entrar na alça."
  },

  // Rodovia Raposo Tavares (SP-270)
  {
    id: "rad-raposo-km12",
    name: "Radar Fixo 60 km/h - Rod. Raposo Tavares (Butantã)",
    highway: "SP-270 Rodovia Raposo Tavares",
    km: "km 12",
    category: "radar",
    lat: -23.5780,
    lng: -46.7450,
    speed: "60 km/h",
    dangerTip: "Radar de velocidade e fiscalização de rodízio na saída da capital.",
    economyTip: "Tráfego urbano pesado nos horários de pico; dirija com suavidade."
  },
  {
    id: "rad-raposo-km22",
    name: "Radar Fixo 80 km/h - Rod. Raposo Tavares (Granja Viana)",
    highway: "SP-270 Rodovia Raposo Tavares",
    km: "km 22",
    category: "radar",
    lat: -23.5950,
    lng: -46.8520,
    speed: "80 km/h",
    dangerTip: "Fiscalização em trecho com travessia de pedestres e shoppings.",
    economyTip: "Use as faixas centrais para evitar frenagens de veículos acessando comércios."
  },
  {
    id: "rad-raposo-km38",
    name: "Radar Fixo 80 km/h - Rod. Raposo Tavares (Cotia)",
    highway: "SP-270 Rodovia Raposo Tavares",
    km: "km 38",
    category: "radar",
    lat: -23.6150,
    lng: -46.9620,
    speed: "80 km/h",
    dangerTip: "Radar no canteiro central antes de Vargem Grande Paulista.",
    economyTip: "Início do trecho com menos semáforos e melhor consumo."
  },

  // Rodovia dos Bandeirantes (SP-348)
  {
    id: "rad-bandeirantes-km22",
    name: "Radar Fixo 120 km/h - Rod. Bandeirantes (Rodoanel)",
    highway: "SP-348 Rodovia dos Bandeirantes",
    km: "km 22",
    category: "radar",
    lat: -23.4450,
    lng: -46.7650,
    speed: "120 km/h",
    dangerTip: "Pórtico eletrônico no entroncamento com o Rodoanel Oeste.",
    economyTip: "Pistas quádruplas e asfalto perfeito; mantenha velocidade regular."
  },
  {
    id: "rad-bandeirantes-km58",
    name: "Radar Fixo 120 km/h - Rod. Bandeirantes (Jundiaí)",
    highway: "SP-348 Rodovia dos Bandeirantes",
    km: "km 58",
    category: "radar",
    lat: -23.2350,
    lng: -46.9250,
    speed: "120 km/h",
    dangerTip: "Câmera no trecho sinuoso da serra do Japi.",
    economyTip: "Parada excelente nos postos temáticos ao lado da rodovia."
  },
  {
    id: "rad-bandeirantes-km88",
    name: "Radar Fixo 120 km/h - Rod. Bandeirantes (Campinas Sul)",
    highway: "SP-348 Rodovia dos Bandeirantes",
    km: "km 88",
    category: "radar",
    lat: -23.0150,
    lng: -47.1250,
    speed: "120 km/h",
    dangerTip: "Fiscalização antes da bifurcação para o Aeroporto de Viracopos.",
    economyTip: "Sinalização excelente para conexão rápida com a Santos Dumont."
  },

  // Rodovia Anhanguera (SP-330)
  {
    id: "rad-anhanguera-km14",
    name: "Radar Fixo 100 km/h - Rod. Anhanguera (São Paulo / Lapa)",
    highway: "SP-330 Rodovia Anhanguera",
    km: "km 14",
    category: "radar",
    lat: -23.4950,
    lng: -46.7450,
    speed: "100 km/h",
    dangerTip: "Pórtico logo após a saída da Marginal Tietê.",
    economyTip: "Atenção ao limite de 100 km/h nos primeiros quilômetros urbanos."
  },
  {
    id: "rad-anhanguera-km52",
    name: "Radar Fixo 100 km/h - Rod. Anhanguera (Jundiaí)",
    highway: "SP-330 Rodovia Anhanguera",
    km: "km 52",
    category: "radar",
    lat: -23.2150,
    lng: -46.8850,
    speed: "100 km/h",
    dangerTip: "Radar próximo ao Posto Graal 56.",
    economyTip: "Excelente ponto para abastecimento e calibragem de pneus."
  },
  {
    id: "rad-anhanguera-km80",
    name: "Radar Fixo 100 km/h - Rod. Anhanguera (Vinhedo)",
    highway: "SP-330 Rodovia Anhanguera",
    km: "km 80",
    category: "radar",
    lat: -23.0250,
    lng: -47.0150,
    speed: "100 km/h",
    dangerTip: "Fiscalização em trecho com aclive e entrada de caminhões.",
    economyTip: "Mantenha a faixa central para velocidade homogênea."
  },

  // Rodovia Dom Pedro I (SP-065)
  {
    id: "rad-dompedro-km72",
    name: "Radar Fixo 110 km/h - Rod. Dom Pedro I (Atibaia)",
    highway: "SP-065 Rodovia Dom Pedro I",
    km: "km 72",
    category: "radar",
    lat: -23.1250,
    lng: -46.5750,
    speed: "110 km/h",
    dangerTip: "Radar de velocidade nos dois sentidos próximo ao trevo de Atibaia.",
    economyTip: "Pista duplicada de excelente qualidade."
  },
  {
    id: "rad-dompedro-km105",
    name: "Radar Fixo 110 km/h - Rod. Dom Pedro I (Itatiba)",
    highway: "SP-065 Rodovia Dom Pedro I",
    km: "km 105",
    category: "radar",
    lat: -23.0150,
    lng: -46.8450,
    speed: "110 km/h",
    dangerTip: "Fiscalização eletrônica no trecho de curvas longas.",
    economyTip: "Mantenha marcha alta para otimizar o consumo."
  },

  // Rodoanel Mário Covas (SP-021)
  {
    id: "rad-rodoanel-km12",
    name: "Radar Fixo 100 km/h - Rodoanel Oeste (Barueri)",
    highway: "SP-021 Rodoanel Mário Covas",
    km: "km 12",
    category: "radar",
    lat: -23.5350,
    lng: -46.8150,
    speed: "100 km/h",
    dangerTip: "Pórtico com controle de velocidade a 100 km/h.",
    economyTip: "Via expressa ampla com 4 faixas por sentido."
  },
  {
    id: "rad-rodoanel-km48",
    name: "Radar Fixo 100 km/h - Rodoanel Sul (Represa Billings)",
    highway: "SP-021 Rodoanel Mário Covas",
    km: "km 48",
    category: "radar",
    lat: -23.7620,
    lng: -46.6850,
    speed: "100 km/h",
    dangerTip: "Fiscalização em viaduto sobre as águas da represa.",
    economyTip: "Sem semáforos nem pedestres; padrão ideal de rodovia."
  },
  {
    id: "rad-rodoanel-km75",
    name: "Radar Fixo 100 km/h - Rodoanel Leste (Ribeirão Pires)",
    highway: "SP-021 Rodoanel Mário Covas",
    km: "km 75",
    category: "radar",
    lat: -23.6850,
    lng: -46.4850,
    speed: "100 km/h",
    dangerTip: "Radar de velocidade em curva suave do trecho leste.",
    economyTip: "Excelente ligação do litoral para o interior sem entrar na capital."
  },

  // Rodovia Presidente Dutra (BR-116)
  {
    id: "rad-dutra-km224",
    name: "Radar Fixo 90 km/h - Rod. Pres. Dutra (Guarulhos / Cecap)",
    highway: "BR-116 Presidente Dutra",
    km: "km 224",
    category: "radar",
    lat: -23.4550,
    lng: -46.4950,
    speed: "90 km/h",
    dangerTip: "Radar de velocidade nos dois sentidos próximo ao acesso ao aeroporto.",
    economyTip: "Trecho com tráfego intenso; mantenha distância segura."
  },
  {
    id: "rad-dutra-km175",
    name: "Radar Fixo 110 km/h - Rod. Pres. Dutra (Jacareí)",
    highway: "BR-116 Presidente Dutra",
    km: "km 175",
    category: "radar",
    lat: -23.3150,
    lng: -45.9850,
    speed: "110 km/h",
    dangerTip: "Fiscalização eletrônica no planalto do Vale do Paraíba.",
    economyTip: "Pista reta e bem sinalizada."
  },

  // Rodovia Régis Bittencourt (BR-116)
  {
    id: "rad-regis-km279",
    name: "Radar Fixo 80 km/h - Rod. Régis Bittencourt (Taboão da Serra)",
    highway: "BR-116 Régis Bittencourt",
    km: "km 279",
    category: "radar",
    lat: -23.6150,
    lng: -46.7750,
    speed: "80 km/h",
    dangerTip: "Radar em trecho urbano da saída de São Paulo.",
    economyTip: "Fique atento às paradas de transporte coletivo no acostamento."
  },
  {
    id: "rad-regis-km287",
    name: "Radar Fixo 80 km/h - Rod. Régis Bittencourt (Embu das Artes)",
    highway: "BR-116 Régis Bittencourt",
    km: "km 287",
    category: "radar",
    lat: -23.6750,
    lng: -46.8550,
    speed: "80 km/h",
    dangerTip: "Câmera instalada em curva de descida.",
    economyTip: "Trecho com postos de abastecimento expressos."
  },

  // ================= 3. POSTOS ESTRATÉGICOS COM COMBUSTÍVEL ECONÔMICO =================
  {
    id: "gas-graal-56",
    name: "Posto Graal 56 - Anhanguera km 56 (Jundiaí)",
    highway: "SP-330 Rodovia Anhanguera",
    km: "km 56",
    category: "gas",
    lat: -23.2180,
    lng: -46.8820,
    fuelPrice: "Etanol: R$ 3,29 | Gasolina: R$ 5,39",
    desc: "Posto tradicional com ampla infraestrutura, calibrador digital e preços de combustível competitivos.",
    economyTip: "Etanol 7% mais barato que a média da capital. Calibre os pneus antes de subir a serra.",
    dangerTip: "Pátio amplo e bem iluminado com vigilância 24h."
  },
  {
    id: "gas-graal-anchieta",
    name: "Posto Graal Anchieta - km 21 (São Bernardo do Campo)",
    highway: "SP-150 Rodovia Anchieta",
    km: "km 21",
    category: "gas",
    lat: -23.7120,
    lng: -46.5750,
    fuelPrice: "Etanol: R$ 3,34 | Gasolina: R$ 5,45",
    desc: "Parada estratégica para abastecer antes de descer para Santos ou Litoral Sul.",
    economyTip: "Economize até R$ 0,40 por litro em comparação aos postos da orla de Santos.",
    dangerTip: "Atenção ao fluxo rápido de veículos na alça de desaceleração."
  },
  {
    id: "gas-posto-campeao-mogi",
    name: "Posto Campeão - Mogi das Cruzes / Bertioga (km 58)",
    highway: "SP-098 Rodovia Mogi-Bertioga",
    km: "km 58",
    category: "gas",
    lat: -23.5350,
    lng: -46.1850,
    fuelPrice: "Etanol: R$ 3,25 | Gasolina: R$ 5,29",
    desc: "Último ponto com combustível barato antes de descer a serra de Bertioga.",
    economyTip: "Abasteça tanque cheio aqui para não pagar valores inflacionados no litoral norte.",
    dangerTip: "Cheque água do radiador e fluido de freio antes do trecho de serra."
  },
  {
    id: "gas-frango-assado-carvalho",
    name: "Frango Assado - Rod. Carvalho Pinto (km 94)",
    highway: "SP-070 Rodovia Carvalho Pinto",
    km: "km 94",
    category: "gas",
    lat: -23.2350,
    lng: -45.8250,
    fuelPrice: "Etanol: R$ 3,42 | Gasolina: R$ 5,55",
    desc: "Complexo de conveniência com combustível aditivado e suporte mecânico de emergência.",
    economyTip: "Ótima parada para checagem rápida de pneus e descanso de viagem.",
    dangerTip: "Estacionamento seguro com monitoramento por câmeras."
  },
  {
    id: "gas-graal-castello",
    name: "Posto Graal Castello Branco - km 30 (Barueri / Itapevi)",
    highway: "SP-280 Rodovia Castello Branco",
    km: "km 30",
    category: "gas",
    lat: -23.5010,
    lng: -46.9420,
    fuelPrice: "Etanol: R$ 3,32 | Gasolina: R$ 5,42",
    desc: "Grande posto de rodovia com combustível de distribuidora oficial e calibragem precisa.",
    economyTip: "Preço de combustível vantajoso antes da praça de pedágio de Itapevi.",
    dangerTip: "Fique atento aos caminhões manobrando no pátio dos fundos."
  },
  {
    id: "gas-ipiranga-aracariguama",
    name: "Posto Ipiranga Castelo - km 44 (Araçariguama)",
    highway: "SP-280 Rodovia Castello Branco",
    km: "km 44",
    category: "gas",
    lat: -23.4680,
    lng: -47.1180,
    fuelPrice: "Etanol: R$ 3,28 | Gasolina: R$ 5,38",
    desc: "Ponto de apoio com preços econômicos e loja de conveniência 24h.",
    economyTip: "Abastecimento com desconto via aplicativo de fidelidade.",
    dangerTip: "Cuidado na entrada e saída da pista expressa."
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
  userMarker: null,
  userAccuracyCircle: null,
  isGpsOrigin: false,
  userLocation: null,
  
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

// ================= GERENCIADOR DE TEMAS E CORES HARMONIZADAS =================
const ThemeManager = {
  STORAGE_KEY: "econosp_theme_settings_v2",
  current: {
    theme: "dark_obsidian",
    accent: "#2563eb",
    preset: "blue"
  },
  syncTimer: null,

  // Derivação harmônica: calcula tons suaves, borda, glow e contraste garantido
  deriveHarmonicShades(hexColor) {
    let cleanHex = (hexColor || "#2563eb").replace("#", "").trim();
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split("").map(c => c + c).join("");
    }
    const r = parseInt(cleanHex.substring(0, 2), 16) || 37;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 99;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 235;

    // Cálculo de luminância para contraste de leitura AAA
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const contrastText = luminance > 0.65 ? "#0f172a" : "#ffffff";

    // Variação suave de hover
    const hoverR = Math.max(0, Math.min(255, Math.round(luminance > 0.5 ? r * 0.85 : r * 1.15)));
    const hoverG = Math.max(0, Math.min(255, Math.round(luminance > 0.5 ? g * 0.85 : g * 1.15)));
    const hoverB = Math.max(0, Math.min(255, Math.round(luminance > 0.5 ? b * 0.85 : b * 1.15)));
    const hoverHex = "#" + [hoverR, hoverG, hoverB].map(v => v.toString(16).padStart(2, "0")).join("");

    return {
      primary: hexColor,
      primaryHover: hoverHex,
      primarySoft: "rgba(" + r + ", " + g + ", " + b + ", 0.14)",
      primaryBorder: "rgba(" + r + ", " + g + ", " + b + ", 0.38)",
      primaryGlow: "0 0 16px rgba(" + r + ", " + g + ", " + b + ", 0.28)",
      primaryContrast: contrastText
    };
  },

  applyCSSVariables() {
    const shades = this.deriveHarmonicShades(this.current.accent);
    const root = document.documentElement;
    root.style.setProperty("--primary", shades.primary);
    root.style.setProperty("--primary-hover", shades.primaryHover);
    root.style.setProperty("--primary-soft", shades.primarySoft);
    root.style.setProperty("--primary-border", shades.primaryBorder);
    root.style.setProperty("--primary-glow", shades.primaryGlow);
    root.style.setProperty("--primary-contrast", shades.primaryContrast);

    document.body.setAttribute("data-theme", this.current.theme);

    // Atualiza o ponto indicador de cor ativa no cabeçalho
    const dot = document.getElementById("headerAccentDot");
    if (dot) dot.style.backgroundColor = shades.primary;
  },

  setTheme(themeId, autoSave = true) {
    this.current.theme = themeId;
    this.applyCSSVariables();
    this.updateUI();
    if (autoSave) this.save();
  },

  setAccent(hexColor, presetKey = "custom", autoSave = true) {
    this.current.accent = hexColor;
    this.current.preset = presetKey;
    this.applyCSSVariables();
    this.updateUI();
    if (autoSave) this.save();
  },

  updateUI() {
    // Atualiza cards de tema
    document.querySelectorAll(".theme-preset-card").forEach(c => {
      c.classList.toggle("active", c.getAttribute("data-theme-id") === this.current.theme);
    });

    // Atualiza swatches de cores
    document.querySelectorAll(".accent-swatch-btn").forEach(s => {
      const swatchPreset = s.getAttribute("data-preset");
      const swatchColor = s.getAttribute("data-color");
      const isActive = (this.current.preset === swatchPreset) || (this.current.accent.toLowerCase() === (swatchColor || "").toLowerCase());
      s.classList.toggle("active", isActive);
    });

    // Atualiza color picker nativo
    const colorPicker = document.getElementById("themeCustomColorPicker");
    if (colorPicker) {
      colorPicker.value = this.current.accent;
    }

    this.updateSyncBadge();
  },

  updateSyncBadge() {
    const badgeText = document.getElementById("themeSyncStatusText");
    if (!badgeText) return;
    if (AppState.currentUser && AppState.currentUser.id) {
      badgeText.textContent = "Sincronizado na sua conta EconoSP";
    } else {
      badgeText.textContent = "Salvo no navegador (entre para sincronizar)";
    }
  },

  save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.current));
    } catch (e) {
      console.warn("Aviso ao salvar tema localmente:", e);
    }

    this.updateSyncBadge();

    // Sincronização automática com Supabase se usuário estiver conectado
    if (supabaseClient && AppState.currentUser && AppState.currentUser.id) {
      clearTimeout(this.syncTimer);
      this.syncTimer = setTimeout(async () => {
        try {
          await supabaseClient
            .from("profiles")
            .update({
              theme_settings: this.current,
              updated_at: new Date().toISOString()
            })
            .eq("id", AppState.currentUser.id);
          
          const badgeText = document.getElementById("themeSyncStatusText");
          if (badgeText) badgeText.textContent = "Salvo na nuvem com sucesso";
        } catch (err) {
          console.warn("Aviso ao sincronizar tema no Supabase:", err);
        }
      }, 400);
    }
  },

  applyFromCloud(cloudSettings) {
    if (!cloudSettings || typeof cloudSettings !== "object") return;
    if (cloudSettings.theme) this.current.theme = cloudSettings.theme;
    if (cloudSettings.accent) this.current.accent = cloudSettings.accent;
    if (cloudSettings.preset) this.current.preset = cloudSettings.preset;
    this.applyCSSVariables();
    this.updateUI();
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.current));
    } catch (e) {}
  },

  resetDefault(saveToCloud = true) {
    clearTimeout(this.syncTimer);
    this.current = {
      theme: "dark_obsidian",
      accent: "#2563eb",
      preset: "blue"
    };
    this.applyCSSVariables();
    this.updateUI();
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.current));
    } catch (e) {}
    if (saveToCloud) {
      this.save();
    }
  },

  applyEarlyTheme() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.theme) this.current.theme = parsed.theme;
        if (parsed.accent) this.current.accent = parsed.accent;
        if (parsed.preset) this.current.preset = parsed.preset;
      }
    } catch (e) {}
    this.applyCSSVariables();
  },

  init() {
    this.applyEarlyTheme();
    this.updateUI();

    const btnOpenTheme = document.getElementById("btnOpenThemeModal");
    const modalTheme = document.getElementById("modalThemeSettings");
    const btnCloseTheme = document.getElementById("btnCloseThemeModal");
    const btnResetDefault = document.getElementById("btnResetThemeDefault");
    const colorPicker = document.getElementById("themeCustomColorPicker");

    if (btnOpenTheme && modalTheme) {
      btnOpenTheme.addEventListener("click", () => {
        this.updateUI();
        modalTheme.classList.add("active");
      });
    }

    if (btnCloseTheme && modalTheme) {
      btnCloseTheme.addEventListener("click", () => {
        modalTheme.classList.remove("active");
      });
    }

    if (modalTheme) {
      modalTheme.addEventListener("click", (e) => {
        if (e.target === modalTheme) modalTheme.classList.remove("active");
      });
    }

    // Clique nos cards de tema pré-definido
    document.querySelectorAll(".theme-preset-card").forEach(card => {
      card.addEventListener("click", () => {
        const tId = card.getAttribute("data-theme-id");
        if (tId) this.setTheme(tId, true);
      });
    });

    // Clique nos swatches de cores pré-curadas
    document.querySelectorAll(".accent-swatch-btn").forEach(swatch => {
      swatch.addEventListener("click", () => {
        const color = swatch.getAttribute("data-color");
        const preset = swatch.getAttribute("data-preset") || "preset";
        if (color) this.setAccent(color, preset, true);
      });
    });

    // Mudança no seletor livre de cor
    if (colorPicker) {
      colorPicker.addEventListener("input", (e) => {
        this.setAccent(e.target.value, "custom", true);
      });
      colorPicker.addEventListener("change", (e) => {
        this.setAccent(e.target.value, "custom", true);
      });
    }

    // Botão de restaurar padrão
    if (btnResetDefault) {
      btnResetDefault.addEventListener("click", () => {
        this.resetDefault();
      });
    }
  }
};

// Aplicação instantânea antes de renderizar para zero FOUC
ThemeManager.applyEarlyTheme();

// ================= INICIALIZAÇÃO =================
document.addEventListener("DOMContentLoaded", () => {
  ThemeManager.init();
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

    const q = (AppState.searchQuery || "").toLowerCase();
    const matchesSearch = q === "" || 
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.highway && p.highway.toLowerCase().includes(q)) ||
      (p.desc && p.desc.toLowerCase().includes(q));

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
        Nenhum pedágio, radar ou posto encontrado para o filtro selecionado.
      </div>
    `;
    return;
  }

  container.innerHTML = points.map(p => {
    let priceBadge = "";
    let tipBlock = "";

    if (p.category === "toll") {
      priceBadge = `<span class="point-price-tag toll">${p.price}</span>`;
      tipBlock = `<div class="point-economy-tip">${p.economyTip || p.concessionaire || ''}</div>`;
    } else if (p.category === "radar") {
      priceBadge = `<span class="point-price-tag fine">Limite: ${p.speed}</span>`;
      tipBlock = `<div class="point-danger-tip">${p.dangerTip || 'Fiscalização eletrônica de velocidade.'}</div>`;
    } else if (p.category === "gas") {
      priceBadge = `<span class="point-price-tag cheap">${(p.fuelPrice || '').split('|')[0].trim()}</span>`;
      tipBlock = `<div class="point-economy-tip">${p.economyTip || ''}</div>`;
    }

    const routeTag = p.isOnActiveRoute ? `<span style="font-size:0.65rem; background:rgba(37,99,235,0.12); color:#2563eb; padding:2px 6px; border-radius:3px; margin-left:6px; font-weight:600;">Na Rota</span>` : "";

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
  if (AppState.markersLayer) {
    AppState.markersLayer.eachLayer(layer => {
      if (layer.getLatLng && 
          Math.abs(layer.getLatLng().lat - point.lat) < 0.0001 && 
          Math.abs(layer.getLatLng().lng - point.lng) < 0.0001) {
        layer.openPopup();
      }
    });
  }

  playNotificationBeep(520, 0.08);
}

function updateQuickStatsBar() {
  const tollsCount = POINTS_DATA.filter(p => p.category === "toll").length;
  const radarsCount = POINTS_DATA.filter(p => p.category === "radar").length;
  const gasCount = POINTS_DATA.filter(p => p.category === "gas").length;

  const tEl = document.getElementById("statTollsCount");
  const rEl = document.getElementById("statRadarsCount");
  const gEl = document.getElementById("statGasCount");

  if (tEl) tEl.textContent = `${tollsCount} Pedágios`;
  if (rEl) rEl.textContent = `${radarsCount} Radares`;
  if (gEl) gEl.textContent = `${gasCount} Postos`;
}

// ================= SIMULAÃ‡ÃƒO DE VIAGEM PELAS RUAS =================
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

  const radar = nearby.find(p => p.category === "radar");
  const toll = nearby.find(p => p.category === "toll");
  const gas = nearby.find(p => p.category === "gas");

  if (radar) {
    alertEl.className = "hud-next-alert radar";
    alertEl.innerHTML = `RADAR FIXO: LIMITE ${radar.speed}`;
    descEl.textContent = `${radar.name}. Mantenha a velocidade regulamentada na via.`;
    if (speedEl) speedEl.textContent = radar.speed.replace(/[^0-9]/g, "") || "80";
    playNotificationBeep(880, 0.25);
  } else if (toll) {
    alertEl.className = "hud-next-alert toll";
    alertEl.innerHTML = `PRAÇA DE PEDÁGIO: ${toll.price}`;
    descEl.textContent = `${toll.name}. Reduza para 40 km/h nas cabines de cobrança automática.`;
    if (speedEl) speedEl.textContent = "40";
    playNotificationBeep(330, 0.2);
  } else if (gas) {
    alertEl.className = "hud-next-alert good";
    alertEl.innerHTML = `POSTO DE SERVIÇO PRÓXIMO`;
    descEl.textContent = `${gas.name} • ${gas.fuelPrice}`;
    if (speedEl) speedEl.textContent = "80";
  } else {
    alertEl.className = "hud-next-alert good";
    alertEl.innerHTML = `Trecho Livre (${AppState.selectedStrategy === 'economy' ? 'Rota Econômica' : 'Rota Expressa'})`;
    descEl.textContent = `Tráfego fluindo pelas rodovias monitoradas.`;
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
// ================= ÃUDIO BEEP NATIVO =================
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
    console.warn("Ãudio indisponível", e);
  }
}

// ================= GEOLOCALIZAÃ‡ÃƒO COM NOME DA RUA E MARCADOR PULSANTE =================
async function reverseGeocodeStreet(lat, lng) {
  try {
    const url = "https://nominatim.openstreetmap.org/reverse?format=json&lat=" + lat.toFixed(6) + "&lon=" + lng.toFixed(6) + "&zoom=18&addressdetails=1";
    const res = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const a = data.address;
        const street = a.road || a.street || a.pedestrian || a.footway || a.avenue || a.square || a.suburb || "";
        const num = a.house_number ? (", " + a.house_number) : "";
        const b = a.suburb || a.neighbourhood || a.city_district || "";
        const c = a.city || a.town || a.municipality || "São Paulo";
        if (street) {
          let s = street + num;
          if (b && !street.includes(b)) s += " - " + b;
          s += ", " + c;
          return s;
        } else if (data.display_name) {
          return data.display_name.split(",").slice(0, 3).join(", ").trim();
        }
      }
    }
  } catch (e) {
    console.warn("Reverse geocode falhou:", e);
  }
  return "Minha Localização (" + lat.toFixed(4) + ", " + lng.toFixed(4) + ")";
}

function showUserCurrentPosition(lat, lng, accuracy, streetName) {
  if (!AppState.map || typeof L === "undefined") return;

  if (AppState.userMarker) {
    AppState.map.removeLayer(AppState.userMarker);
    AppState.userMarker = null;
  }
  if (AppState.userAccuracyCircle) {
    AppState.map.removeLayer(AppState.userAccuracyCircle);
    AppState.userAccuracyCircle = null;
  }

  // Círculo de precisão do GPS (halo suave)
  AppState.userAccuracyCircle = L.circle([lat, lng], {
    radius: Math.min(Math.max(accuracy || 30, 20), 200),
    color: "#2563eb",
    fillColor: "#3b82f6",
    fillOpacity: 0.16,
    weight: 1.5,
    dashArray: "4, 4"
  }).addTo(AppState.map);

  // Marcador pulsante no estilo moderno
  const pulseIcon = L.divIcon({
    className: "user-gps-pulse-icon",
    html: '<div class="user-gps-dot"></div><div class="user-gps-pulse"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  AppState.userMarker = L.marker([lat, lng], { icon: pulseIcon, zIndexOffset: 1000 }).addTo(AppState.map);

  AppState.userMarker.bindPopup(
    '<div style="font-size:0.82rem; font-family:sans-serif; min-width:180px;">' +
      '<strong style="color:var(--primary, #2563eb); font-weight:700;">Você está aqui</strong>' +
      '<div style="color:#1e293b; margin-top:4px; font-weight:600;">' + streetName + '</div>' +
      '<div style="font-size:0.72rem; color:#64748b; margin-top:2px;">Precisão GPS: ~' + Math.round(accuracy || 20) + 'm</div>' +
    '</div>'
  ).openPopup();

  AppState.map.setView([lat, lng], 16, { animate: true });
}

function requestUserGeolocation(userTriggered = true) {
  const btnLocate = document.getElementById("btnLocateMe");
  const originInput = document.getElementById("originInput");

  if (!navigator.geolocation) {
    if (userTriggered) alert("Geolocalização não é suportada pelo seu navegador.");
    return;
  }

  if (btnLocate) btnLocate.textContent = "Obtendo rua...";

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy || 25;

      AppState.originCoords = [lat, lng];
      AppState.isGpsOrigin = true;

      // Obtém o nome da rua exata
      const streetFormatted = await reverseGeocodeStreet(lat, lng);
      AppState.originText = streetFormatted;

      if (originInput) originInput.value = streetFormatted;
      if (btnLocate) btnLocate.textContent = "GPS Conectado";

      // Mostra o marcador com pulso e centraliza o mapa
      showUserCurrentPosition(lat, lng, accuracy, streetFormatted);

      // Traça rotas iniciando diretamente da rua do usuário
      await calculateContextualRoutes();
      playNotificationBeep(650, 0.1);
    },
    (error) => {
      if (btnLocate) btnLocate.textContent = "Usar GPS";
      if (userTriggered) {
        alert("Não foi possível acessar seu GPS. Verifique a permissão de localização do navegador ou digite a rua manualmente.");
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
  );
}

// ================= CONFIGURAÃ‡ÃƒO DE EVENTOS =================
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
      recalculateRoutePlan();
      syncUserPreferencesToSupabase();
    });
  }

  ["calcEfficiency", "calcFuelPrice"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", recalculateRoutePlan);
      el.addEventListener("change", () => {
        recalculateRoutePlan();
        syncUserPreferencesToSupabase();
      });
    }
  });

  const btnSaveCurrentRoute = document.getElementById("btnSaveCurrentRoute");
  if (btnSaveCurrentRoute) {
    btnSaveCurrentRoute.addEventListener("click", saveCurrentRouteToSupabase);
  }

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

  // Waze reporting removido conforme solicitação

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

// ================= INTEGRAÇÃO SUPABASE (AUTH, PROFILES, ROAD_POINTS, SAVED_ROUTES) =================
const SUPABASE_URL = "https://pogacgplfffpaocchbfe.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_79wLCzP1MSQn7yeD0ZGAMg_Wk55bQAJ";

const supabaseClient = (typeof window !== "undefined" && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

// Tradutor de erros nativos do Supabase Auth para mensagens claras em português
function formatSupabaseAuthError(error) {
  if (!error) return "Ocorreu um erro na autenticação.";
  const msg = error.message || String(error);
  if (msg.includes("Invalid login credentials")) {
    return "E-mail ou senha incorretos. Verifique suas credenciais.";
  }
  if (msg.includes("User already registered") || msg.includes("already registered")) {
    return "Este e-mail já está cadastrado. Alterne para a aba 'Entrar'.";
  }
  if (msg.includes("Password should be at least 6 characters") || msg.includes("least 6 characters")) {
    return "A senha deve conter no mínimo 6 caracteres.";
  }
  if (msg.includes("Email not confirmed")) {
    return "E-mail ainda não confirmado. Verifique sua caixa de entrada.";
  }
  if (msg.includes("network") || msg.includes("Failed to fetch")) {
    return "Falha de conexão com o servidor. Verifique sua conexão com a internet.";
  }
  return msg;
}

async function loadPointsFromSupabase() {
  if (!supabaseClient) return;
  try {
    const { data, error } = await supabaseClient
      .from("road_points")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !data) return;

    let added = false;
    data.forEach(row => {
      const exists = POINTS_DATA.some(p => p.id === row.id || (row.slug_id && p.id === row.slug_id));
      if (!exists) {
        POINTS_DATA.unshift({
          id: row.id,
          name: row.name,
          highway: row.highway,
          km: row.km_label || "Recente",
          category: row.category,
          lat: row.lat,
          lng: row.lng,
          price: row.toll_price ? `R$ ${Number(row.toll_price).toFixed(2).replace(".", ",")}` : undefined,
          priceNum: row.toll_price ? Number(row.toll_price) : undefined,
          speed: row.speed_limit || undefined,
          fuelPrice: row.fuel_price_label || undefined,
          delayMinutes: row.delay_minutes || 0,
          delay: row.delay_minutes ? `+${row.delay_minutes} min` : undefined,
          desc: row.description,
          dangerTip: row.danger_tip || "",
          economyTip: row.economy_tip || "",
          isOnActiveRoute: false
        });
        added = true;
      }
    });

    if (added) {
      renderMapMarkers();
      renderPointsList();
      updateQuickStatsBar();
    }
  } catch (err) {
    console.warn("Erro ao carregar road_points do Supabase:", err);
  }
}

async function loadUserProfileFromSupabase(userId) {
  if (!supabaseClient || !userId) return;
  try {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (!error && data) {
      if (data.full_name) {
        AppState.driverName = data.full_name;
        if (AppState.currentUser) AppState.currentUser.name = data.full_name;
        updateDriverPillDisplay();
        const btnOpenAuth = document.getElementById("btnOpenAuth");
        if (btnOpenAuth) {
          const firstName = data.full_name.split(" ")[0];
          btnOpenAuth.textContent = `Conta: ${firstName}`;
        }
      }
      const fuelSelect = document.getElementById("calcFuelType");
      const effInput = document.getElementById("calcEfficiency");
      const priceInput = document.getElementById("calcFuelPrice");

      if (data.preferred_fuel && fuelSelect) {
        AppState.fuelType = data.preferred_fuel;
        fuelSelect.value = data.preferred_fuel;
      }
      if (data.default_efficiency_km_l && effInput) {
        effInput.value = data.default_efficiency_km_l;
      }
      if (data.default_fuel_price && priceInput) {
        priceInput.value = data.default_fuel_price;
      }
      recalculateRoutePlan();

      // Carrega o tema exclusivo do usuário atual salvo na nuvem
      if (data.theme_settings && typeof data.theme_settings === "object" && data.theme_settings.theme) {
        ThemeManager.applyFromCloud(data.theme_settings);
      } else {
        // Se a conta não tiver tema personalizado, aplica o tema padrão (nunca do user anterior)
        ThemeManager.resetDefault(false);
      }
    } else {
      ThemeManager.resetDefault(false);
    }
  } catch (err) {
    console.warn("Erro ao carregar perfil:", err);
  }
}

async function syncUserPreferencesToSupabase() {
  if (!supabaseClient || !AppState.currentUser || !AppState.currentUser.id) return;
  const eff = parseFloat(document.getElementById("calcEfficiency")?.value) || 11.0;
  const price = parseFloat(document.getElementById("calcFuelPrice")?.value) || 3.49;

  try {
    await supabaseClient
      .from("profiles")
      .update({
        preferred_fuel: AppState.fuelType,
        default_efficiency_km_l: eff,
        default_fuel_price: price,
        theme_settings: ThemeManager.current,
        updated_at: new Date().toISOString()
      })
      .eq("id", AppState.currentUser.id);
  } catch (err) {
    console.warn("Erro ao sincronizar preferências no Supabase:", err);
  }
}

async function loadSavedRoutesFromSupabase() {
  const container = document.getElementById("savedRoutesContainer");
  const listEl = document.getElementById("savedRoutesList");
  if (!container || !listEl) return;

  if (!supabaseClient || !AppState.currentUser || !AppState.currentUser.id) {
    container.style.display = "none";
    listEl.innerHTML = "";
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("saved_routes")
      .select("*")
      .eq("user_id", AppState.currentUser.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error || !data || data.length === 0) {
      container.style.display = "none";
      listEl.innerHTML = "";
      return;
    }

    container.style.display = "block";
    listEl.innerHTML = data.map(r => `
      <div class="saved-route-item">
        <div class="saved-route-info" onclick="applySavedRoute('${r.origin_text.replace(/'/g, "\\'")}', '${r.dest_text.replace(/'/g, "\\'")}', '${r.strategy}')">
          <strong>${r.origin_text} &rarr; ${r.dest_text}</strong>
          <span>${r.distance_km} km • Pedágio: R$ ${Number(r.tolls_cost).toFixed(2).replace(".", ",")} • Total: R$ ${Number(r.total_cost).toFixed(2).replace(".", ",")}</span>
        </div>
        <button type="button" class="btn-delete-route" onclick="deleteSavedRoute('${r.id}')" title="Remover rota">Excluir</button>
      </div>
    `).join("");
  } catch (err) {
    console.warn("Erro ao listar rotas salvas:", err);
    container.style.display = "none";
    listEl.innerHTML = "";
  }
}

function applySavedRoute(originText, destText, strategy) {
  const origInput = document.getElementById("originInput");
  const destInput = document.getElementById("destInput");
  if (origInput) origInput.value = originText;
  if (destInput) destInput.value = destText;
  AppState.selectedStrategy = strategy || "economy";
  document.querySelectorAll(".strategy-btn").forEach(b => {
    b.classList.toggle("active", b.getAttribute("data-strategy") === AppState.selectedStrategy);
  });
  calculateContextualRoutes();
}

async function deleteSavedRoute(routeId) {
  if (!supabaseClient || !routeId) return;
  try {
    await supabaseClient.from("saved_routes").delete().eq("id", routeId);
    loadSavedRoutesFromSupabase();
  } catch (err) {
    console.warn("Erro ao excluir rota:", err);
  }
}

async function saveCurrentRouteToSupabase() {
  if (!AppState.currentUser || !AppState.currentUser.id) {
    const modalAuth = document.getElementById("modalAuth");
    if (modalAuth) modalAuth.classList.add("active");
    showAuthFeedback("Entre na sua conta ou crie um cadastro para salvar rotas na nuvem.", "error");
    return;
  }

  if (!supabaseClient) {
    alert("Serviço de banco de dados indisponível no momento.");
    return;
  }

  const currentRoute = AppState.routesData[AppState.selectedStrategy] || AppState.routesData.economy;
  const eff = parseFloat(document.getElementById("calcEfficiency")?.value) || 11.0;
  const price = parseFloat(document.getElementById("calcFuelPrice")?.value) || 3.49;
  const fuelCost = (currentRoute.distanceKm / eff) * price;
  const totalCost = fuelCost + currentRoute.tollsCost;

  const btn = document.getElementById("btnSaveCurrentRoute");
  if (btn) btn.textContent = "Salvando rota...";

  try {
    const { error } = await supabaseClient.from("saved_routes").insert({
      user_id: AppState.currentUser.id,
      origin_text: AppState.originText,
      origin_lat: AppState.originCoords[0],
      origin_lng: AppState.originCoords[1],
      dest_text: AppState.destText,
      dest_lat: AppState.destCoords[0],
      dest_lng: AppState.destCoords[1],
      strategy: AppState.selectedStrategy,
      distance_km: currentRoute.distanceKm,
      duration_min: currentRoute.durationMin,
      tolls_cost: currentRoute.tollsCost,
      total_cost: Math.round(totalCost * 100) / 100
    });

    if (btn) btn.textContent = "Salvar Rota na Minha Conta";
    if (error) {
      alert("Não foi possível salvar a rota: " + formatSupabaseAuthError(error));
      return;
    }
    await loadSavedRoutesFromSupabase();
    alert("Rota salva com sucesso na sua conta EconoSP.");
  } catch (err) {
    if (btn) btn.textContent = "Salvar Rota na Minha Conta";
    console.warn("Erro ao salvar rota:", err);
    alert("Falha ao salvar rota. Tente novamente.");
  }
}

function applyLoggedUserState(user) {
  const btnOpenAuth = document.getElementById("btnOpenAuth");
  const btnLogoutHeader = document.getElementById("btnLogoutHeader");
  const savedRoutesContainer = document.getElementById("savedRoutesContainer");
  const savedRoutesList = document.getElementById("savedRoutesList");

  // Sempre esvazia imediatamente qualquer resquício de rotas de contas anteriores
  if (savedRoutesList) savedRoutesList.innerHTML = "";
  if (savedRoutesContainer) savedRoutesContainer.style.display = "none";

  if (user && user.id) {
    AppState.currentUser = user;
    AppState.driverName = user.name || "Condutor";
    updateDriverPillDisplay();

    if (btnOpenAuth) {
      const firstName = (user.name || "Condutor").split(" ")[0];
      btnOpenAuth.textContent = `Conta: ${firstName}`;
      btnOpenAuth.classList.add("logged-in");
      btnOpenAuth.title = `Conectado como ${user.email}. Clique para gerenciar.`;
    }
    if (btnLogoutHeader) {
      btnLogoutHeader.style.display = "inline-flex";
      btnLogoutHeader.textContent = "Sair";
      btnLogoutHeader.disabled = false;
    }
    ThemeManager.updateSyncBadge();
    loadUserProfileFromSupabase(user.id);
    loadSavedRoutesFromSupabase();
  } else {
    AppState.currentUser = null;
    AppState.driverName = "Visitante";
    updateDriverPillDisplay();

    // Limpa timers pendentes e remove o tema do usuário do localStorage
    clearTimeout(ThemeManager.syncTimer);
    localStorage.removeItem(ThemeManager.STORAGE_KEY);
    ThemeManager.resetDefault(false);

    // Reseta parâmetros de combustível e campos de consulta
    const fuelSelect = document.getElementById("calcFuelType");
    const effInput = document.getElementById("calcEfficiency");
    const priceInput = document.getElementById("calcFuelPrice");
    const nameInput = document.getElementById("driverNameInput");
    const plateInput = document.getElementById("licensePlateInput");
    const vehicleResult = document.getElementById("vehicleConsultResult");

    if (fuelSelect) fuelSelect.value = "ethanol";
    if (effInput) effInput.value = "11.0";
    if (priceInput) priceInput.value = "3.49";
    if (nameInput) nameInput.value = "";
    if (plateInput) plateInput.value = "";
    if (vehicleResult) vehicleResult.innerHTML = "";

    AppState.fuelType = "ethanol";
    recalculateRoutePlan();

    if (btnOpenAuth) {
      btnOpenAuth.textContent = "Entrar";
      btnOpenAuth.classList.remove("logged-in");
      btnOpenAuth.title = "Entrar na sua conta ou cadastrar novo perfil";
    }
    if (btnLogoutHeader) {
      btnLogoutHeader.style.display = "none";
    }
    ThemeManager.updateSyncBadge();
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
  const btnSubmitLogin = document.getElementById("btnSubmitLogin");
  const btnSubmitRegister = document.getElementById("btnSubmitRegister");

  // Carrega ocorrências salvas no Supabase
  loadPointsFromSupabase();

  if (supabaseClient) {
    // 1. Ouvinte reativo oficial para todas as alterações de estado da sessão
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (session && session.user) {
        const u = session.user;
        const sessionUser = {
          id: u.id,
          name: u.user_metadata?.full_name || u.email?.split("@")[0] || "Condutor",
          email: u.email
        };
        applyLoggedUserState(sessionUser);
      } else {
        applyLoggedUserState(null);
      }
    });

    // 2. Verificação de sessão já ativa no carregamento da página
    supabaseClient.auth.getSession().then(({ data }) => {
      if (data && data.session && data.session.user) {
        const u = data.session.user;
        const sessionUser = {
          id: u.id,
          name: u.user_metadata?.full_name || u.email?.split("@")[0] || "Condutor",
          email: u.email
        };
        applyLoggedUserState(sessionUser);
      } else {
        applyLoggedUserState(null);
      }
    }).catch(err => {
      console.warn("Erro ao obter sessão Supabase:", err);
      applyLoggedUserState(null);
    });
  } else {
    applyLoggedUserState(null);
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
      if (AppState.currentUser) {
        showAuthFeedback(`Conectado como ${AppState.currentUser.name} (${AppState.currentUser.email})`, "success");
      }
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
    btnLogoutHeader.addEventListener("click", async () => {
      btnLogoutHeader.textContent = "Saindo...";
      btnLogoutHeader.disabled = true;

      // 1. Limpa timers e dados locais do usuário imediatamente
      clearTimeout(ThemeManager.syncTimer);
      localStorage.removeItem(ThemeManager.STORAGE_KEY);
      applyLoggedUserState(null);

      // 2. Encerra a sessão no Supabase Auth
      if (supabaseClient) {
        try {
          await supabaseClient.auth.signOut();
        } catch (err) {
          console.warn("Aviso ao encerrar sessão:", err);
        }
      }

      // 3. Recarrega a página completamente para garantir limpeza total
      window.location.reload();
    });
  }

  // CADASTRO DE CONTA NO SUPABASE
  if (formRegister) {
    formRegister.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = (document.getElementById("regName")?.value || "").trim();
      const email = (document.getElementById("regEmail")?.value || "").trim().toLowerCase();
      const password = document.getElementById("regPassword")?.value || "";

      if (!name) {
        showAuthFeedback("Por favor, preencha seu nome completo.", "error");
        return;
      }
      if (!email || !email.includes("@")) {
        showAuthFeedback("Por favor, informe um endereço de e-mail válido.", "error");
        return;
      }
      if (!password || password.length < 6) {
        showAuthFeedback("A senha deve conter no mínimo 6 caracteres para segurança no Supabase.", "error");
        return;
      }

      if (!supabaseClient) {
        showAuthFeedback("Serviço de autenticação temporariamente indisponível.", "error");
        return;
      }

      if (btnSubmitRegister) {
        btnSubmitRegister.disabled = true;
        btnSubmitRegister.textContent = "Criando conta...";
      }
      showAuthFeedback("Criando sua conta com segurança no Supabase...", "success");

      try {
        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name }
          }
        });

        if (error) {
          showAuthFeedback(formatSupabaseAuthError(error), "error");
          return;
        }

        if (data?.user) {
          // Se o login direto não foi retornado na sessão do signup, autentica com as credenciais
          if (!data.session) {
            const loginRes = await supabaseClient.auth.signInWithPassword({ email, password });
            if (loginRes.error) {
              showAuthFeedback("Conta criada com sucesso! Use a aba Entrar com seu e-mail e senha.", "success");
              switchAuthTab("login");
              return;
            }
          }

          const sessionUser = {
            id: data.user.id,
            name: name,
            email: email
          };
          applyLoggedUserState(sessionUser);
          showAuthFeedback("Conta criada e autenticada! Atualizando ambiente...", "success");

          // Limpa qualquer tema do usuário anterior em cache local antes do reload
          clearTimeout(ThemeManager.syncTimer);
          localStorage.removeItem(ThemeManager.STORAGE_KEY);

          formRegister.reset();

          setTimeout(() => {
            if (modalAuth) modalAuth.classList.remove("active");
            window.location.reload();
          }, 450);
        }
      } catch (err) {
        showAuthFeedback(formatSupabaseAuthError(err), "error");
      } finally {
        if (btnSubmitRegister) {
          btnSubmitRegister.disabled = false;
          btnSubmitRegister.textContent = "Criar Conta e Acessar";
        }
      }
    });
  }

  // LOGIN DE CONTA NO SUPABASE
  if (formLogin) {
    formLogin.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = (document.getElementById("loginEmail")?.value || "").trim().toLowerCase();
      const password = document.getElementById("loginPassword")?.value || "";

      if (!email || !password) {
        showAuthFeedback("Informe seu e-mail e senha para entrar.", "error");
        return;
      }
      if (password.length < 6) {
        showAuthFeedback("A senha deve ter no mínimo 6 caracteres.", "error");
        return;
      }

      if (!supabaseClient) {
        showAuthFeedback("Serviço de autenticação temporariamente indisponível.", "error");
        return;
      }

      if (btnSubmitLogin) {
        btnSubmitLogin.disabled = true;
        btnSubmitLogin.textContent = "Entrando...";
      }
      showAuthFeedback("Autenticando no Supabase...", "success");

      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          showAuthFeedback(formatSupabaseAuthError(error), "error");
          return;
        }

        if (data?.user) {
          const sessionUser = {
            id: data.user.id,
            name: data.user.user_metadata?.full_name || data.user.email?.split("@")[0] || "Condutor",
            email: data.user.email
          };
          applyLoggedUserState(sessionUser);
          showAuthFeedback("Acesso realizado! Atualizando ambiente da sua conta...", "success");

          // Limpa o tema do usuário anterior em localStorage antes do reload
          clearTimeout(ThemeManager.syncTimer);
          localStorage.removeItem(ThemeManager.STORAGE_KEY);

          formLogin.reset();

          setTimeout(() => {
            if (modalAuth) modalAuth.classList.remove("active");
            window.location.reload();
          }, 450);
        }
      } catch (err) {
        showAuthFeedback(formatSupabaseAuthError(err), "error");
      } finally {
        if (btnSubmitLogin) {
          btnSubmitLogin.disabled = false;
          btnSubmitLogin.textContent = "Entrar na Conta";
        }
      }
    });
  }
}

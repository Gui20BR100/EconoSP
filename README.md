# 🗺️ EconoSP

> **Aplicativo web para viajantes econômicos saindo de São Paulo** — encontre as rotas mais baratas, evite pedágios e radares, monitore alertas de assalto, trânsito e obras em tempo real.

![EconoSP Banner](https://img.shields.io/badge/FugaDoGasto-SP%20v7.0-10b981?style=for-the-badge&logo=leaflet)
![Licença](https://img.shields.io/badge/Licen%C3%A7a-MIT-blue?style=flat-square)
![HTML/CSS/JS](https://img.shields.io/badge/Stack-HTML%20%7C%20CSS%20%7C%20JS%20puro-f97316?style=flat-square)
![Sem dependências de backend](https://img.shields.io/badge/Backend-Nenhum%20(client--side)-22c55e?style=flat-square)

---

## ✨ Funcionalidades

| Funcionalidade | Descrição |
|---|---|
| 🛣️ **Rotas pelas ruas reais** | Motor OSRM traça o trajeto exatamente sobre as ruas e rodovias do mapa |
| 💰 **Rota Econômica** | Desvia de pedágios caros usando alternativas reais (ex: Raposo Tavares x Castelo Branco) |
| ⚡ **Rota Expressa** | Autoestradas e túneis com máxima velocidade |
| 🍃 **Rota Eco-Carbono** | Velocidade de cruzeiro constante para menor emissão de CO₂ |
| ⚠️ **Alertas Waze** | Áreas de assalto/arrastão, lentidões com atraso estimado, obras, blitz policial e neblina |
| 🔍 **Consulta de placa** | Preenche automaticamente marca, modelo, ano, cor e consumo pela placa digitada (LGPD: sem chassi/renavam) |
| 🚗 **Rodízio de SP** | Verifica em tempo real se sua placa está no rodízio hoje |
| 💸 **Calculadora de viagem** | Custo total de combustível + pedágios + emissão de CO₂ |
| 📊 **Análise de incidentes** | Detecta quais alertas Waze estão genuinamente no seu trajeto |

---

## 🚀 Como usar

**Não precisa de instalação.** É 100% client-side.

1. Clone o repositório:
   ```bash
   git clone https://github.com/Gui20BR100/brilhamais.git
   cd brilhamais
   ```

2. Abra o arquivo `index.html` diretamente no navegador:
   - **Windows**: clique duas vezes em `index.html`
   - **Linux/Mac**: `open index.html` ou `xdg-open index.html`

3. Digite sua origem, destino e número da placa — o app cuida do resto!

---

## 🗺️ Tecnologias

| Tecnologia | Uso | Custo |
|---|---|---|
| **[Leaflet.js](https://leafletjs.com/)** | Mapa interativo | Gratuito, open-source |
| **[OpenStreetMap](https://www.openstreetmap.org/)** | Tiles de ruas | Gratuito, sem API key |
| **[Esri World Imagery](https://www.esri.com/)** | Tiles de satélite | Gratuito, sem API key |
| **[OpenTopoMap](https://opentopomap.org/)** | Tiles de relevo | Gratuito, sem API key |
| **[OSRM](https://project-osrm.org/)** | Roteamento pelas ruas | Gratuito, sem API key |
| **[Nominatim](https://nominatim.org/)** | Geocodificação de endereços | Gratuito, sem API key |
| **Web Audio API** | Alertas sonoros | Nativo do browser |

> **Sem chaves de API necessárias.** O app funciona completamente offline após o carregamento inicial dos tiles.

---

## 🛡️ Privacidade (LGPD)

- A consulta de placa é **simulada localmente** com um banco de dados de exemplo — nenhuma requisição a APIs externas de dados veiculares é feita.
- **Nenhum dado crítico é exposto**: chassi (VIN), RENAVAM e CPF são explicitamente excluídos.
- Nenhum dado do usuário é armazenado ou transmitido a servidores.

---

## 📁 Estrutura do projeto

```
fugadogasto-sp/
├── index.html     # Interface completa do app
├── app.js         # Lógica: roteamento, Waze, mapa, placa, rodízio
├── style.css      # Estilos: tema dark highway, cards, HUD
├── .gitignore     # Proteção contra publicação acidental de segredos
└── README.md      # Esta documentação
```

---

## 🗺️ Rodovias cobertas pelo banco de dados

- **SP-160** Imigrantes / **SP-150** Anchieta → Litoral Sul (Santos, Guarujá, Praia Grande)
- **SP-070** Ayrton Senna + **SP-070** Carvalho Pinto + **SP-099** Tamoios → Litoral Norte (Caraguatatuba, Ubatuba, São Sebastião)
- **SP-098** Mogi-Bertioga → Rota econômica ao litoral norte sem pedágios pesados
- **SP-280** Castelo Branco / **SP-270** Raposo Tavares → Sorocaba, Itu, interior oeste
- **SP-330** Anhanguera / **SP-348** Bandeirantes → Campinas, Jundiaí, Ribeirão Preto
- **BR-116** Presidente Dutra + Fernão Dias → Vale do Paraíba, Rio de Janeiro, MG
- **SP-021** Rodoanel Mário Covas → Contorno de SP

---

## 🤝 Contribuindo

Pull requests são bem-vindos! Para mudanças grandes, abra uma issue primeiro.

---

## 📜 Licença

MIT — livre para usar, modificar e distribuir.

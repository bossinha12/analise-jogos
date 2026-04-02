# FootyAnalyzer PRO ⚽️🤖

O **FootyAnalyzer PRO** é uma aplicação full-stack que utiliza Inteligência Artificial (Google Gemini) para analisar partidas de futebol em tempo real. Ele busca dados reais de ligas mundiais e fornece previsões detalhadas sobre mercados como Over 1.5, Gols no HT, Ambas Marcam e Resultado Final.

## 🚀 Funcionalidades

- **Busca de Jogos em Tempo Real:** Lista de partidas para os próximos 7 dias via API Football-Data.org.
- **Análise Inteligente (IA):** Integração com Google Gemini para processar estatísticas históricas e gerar probabilidades.
- **Filtros Avançados:** Exclui jogos finalizados e foca em partidas futuras ou em andamento.
- **Estatísticas Detalhadas:** Analisa desempenho Casa/Fora, média de gols e padrões de placar.
- **Interface Moderna:** Desenvolvida com React, Tailwind CSS e Framer Motion para uma experiência fluida.

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React, Vite, Tailwind CSS, Lucide React, Framer Motion.
- **Backend:** Node.js, Express (Proxy para evitar CORS).
- **IA:** Google Generative AI (Gemini 3.1 Flash).
- **Dados:** API Football-Data.org.

## 📦 Como Instalar e Rodar

### 1. Clonar o Repositório
```bash
git clone https://github.com/seu-usuario/footyanalyzer-pro.git
cd footyanalyzer-pro
```

### 2. Instalar Dependências
```bash
npm install
```

### 3. Configurar Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto baseado no `.env.example`:
```bash
cp .env.example .env
```
Preencha as chaves:
- `GEMINI_API_KEY`: Obtenha em [Google AI Studio](https://aistudio.google.com/).
- `FOOTBALL_DATA_API_KEY`: Obtenha em [Football-Data.org](https://www.football-data.org/).

### 4. Rodar em Desenvolvimento
```bash
npm run dev
```
Acesse `http://localhost:3000`.

### 5. Build para Produção
```bash
npm run build
npm start
```

## 📄 Licença
Este projeto está sob a licença MIT.

const BASE_URL = '/api/football';
const DIRECT_URL = 'https://api.football-data.org/v4';
// @ts-ignore - process.env is defined by Vite's define config
const API_KEY = (typeof process !== 'undefined' && process.env?.FOOTBALL_DATA_API_KEY) || import.meta.env.VITE_FOOTBALL_DATA_API_KEY || '7dc3a9b5ab2f40528306816332f56c86';

export interface MatchData {
  score: {
    fullTime: { home: number; away: number };
    halfTime: { home: number; away: number };
  };
  homeTeam: { name: string; id: number };
  awayTeam: { name: string; id: number };
}

export interface TeamStats {
  teamName: string;
  gamesPlayed: number;
  goalsScored: number;
  goalsConceded: number;
  over15Count: number;
  htGoalCount: number;
  bttsCount: number;
}

async function fetchWithAuth(endpoint: string) {
  const fullUrl = `${DIRECT_URL}${endpoint}`;
  
  const fetchWithTimeout = async (url: string, options: any = {}, timeout = 8000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  };

  // Lista de tentativas em ordem de confiabilidade
  const attempts = [
    // 1. Proxy do Vercel (O melhor caminho)
    async () => {
      const cleanPath = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
      const res = await fetchWithTimeout(`/api/football?path=${encodeURIComponent(cleanPath)}`, {}, 6000);
      if (!res.ok) throw new Error(`Vercel Proxy Fail: ${res.status}`);
      const data = await res.json();
      if (data.error || data.message) throw new Error(data.message || 'API Error');
      return data;
    },
    // 2. Proxy corsproxy.io (Plano B - Suporta headers)
    async () => {
      console.log(`Tentando corsproxy.io para: ${fullUrl}`);
      const res = await fetchWithTimeout(`https://corsproxy.io/?${encodeURIComponent(fullUrl)}`, {
        headers: { 'X-Auth-Token': API_KEY }
      }, 10000);
      if (!res.ok) throw new Error('corsproxy.io Fail');
      return res.json();
    },
    // 3. Proxy AllOrigins (Plano C - Sem headers, mas pode funcionar se a API permitir)
    async () => {
      console.log(`Tentando AllOrigins para: ${fullUrl}`);
      const res = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(fullUrl)}`, {}, 10000);
      if (!res.ok) throw new Error('AllOrigins Fail');
      const json = await res.json();
      const data = JSON.parse(json.contents);
      return data;
    },
    // 4. Chamada Direta (Último caso)
    async () => {
      const res = await fetchWithTimeout(fullUrl, { headers: { 'X-Auth-Token': API_KEY } }, 5000);
      if (!res.ok) {
        if (res.status === 429) throw new Error('Limite de requisições da API atingido. Aguarde 1 minuto.');
        throw new Error(`Direct Fetch Fail: ${res.status}`);
      }
      return res.json();
    }
  ];

  let lastError: any = null;
  for (const attempt of attempts) {
    try {
      const result = await attempt();
      if (result) return result;
    } catch (err: any) {
      console.warn('Tentativa de busca falhou, tentando próxima...', err.message);
      lastError = err;
      continue;
    }
  }

  throw lastError || new Error('Não foi possível conectar à API de futebol após várias tentativas.');
}

const competitions = ['PL', 'CL', 'BSA', 'PD', 'BL1', 'SA', 'FL1', 'ELC', 'PPL', 'DED', 'CLI'];
let cachedTeams: any[] | null = null;

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(fc|club|clube|futebol|futebol clube|sd|cf|afc|sc|clube de regatas|esporte clube|ec|cr|clube atlético|ca)\b/gi, '')
    .replace(/[^\w\s]/gi, '')
    .trim();
}

async function getAllTeams() {
  if (cachedTeams) return cachedTeams;
  
  const allTeams: any[] = [];
  // Usar um Set para evitar IDs duplicados durante a coleta
  const seenIds = new Set<number>();

  for (const code of competitions) {
    try {
      // Tentar buscar times da competição
      const data = await fetchWithAuth(`/competitions/${code}/teams`);
      if (data.teams) {
        data.teams.forEach((t: any) => {
          if (!seenIds.has(t.id)) {
            allTeams.push({
              id: t.id,
              name: t.name,
              shortName: t.shortName,
              tla: t.tla,
              normalizedName: normalizeName(t.name),
              normalizedShortName: t.shortName ? normalizeName(t.shortName) : ''
            });
            seenIds.add(t.id);
          }
        });
      }
    } catch (e) {
      console.warn(`Aviso: Não foi possível carregar times da liga ${code}.`);
    }
  }
  
  cachedTeams = allTeams;
  return cachedTeams;
}

export async function findTeam(name: string) {
  const teams = await getAllTeams();
  const searchLower = name.toLowerCase().trim();
  const searchNormalized = normalizeName(name);

  if (!searchNormalized && searchLower.length < 3) {
    throw new Error('Por favor, digite um nome de time mais longo.');
  }

  // 1. Busca por match exato (Nome completo, ShortName ou TLA)
  const exactMatch = teams.find((t: any) => 
    t.name.toLowerCase() === searchLower || 
    t.shortName?.toLowerCase() === searchLower ||
    t.tla?.toLowerCase() === searchLower ||
    t.normalizedName === searchNormalized ||
    t.normalizedShortName === searchNormalized
  );

  if (exactMatch) return exactMatch;

  // 2. Busca por inclusão (Normalized)
  const partialMatches = teams.filter((t: any) => 
    t.normalizedName.includes(searchNormalized) || 
    searchNormalized.includes(t.normalizedName) ||
    (t.normalizedShortName && t.normalizedShortName.includes(searchNormalized))
  );

  if (partialMatches.length === 1) {
    return partialMatches[0];
  }

  // 3. Busca por palavras individuais
  if (partialMatches.length === 0) {
    const searchWords = searchNormalized.split(' ').filter(w => w.length > 2);
    if (searchWords.length > 0) {
      const wordMatches = teams.filter((t: any) => 
        searchWords.some(word => t.normalizedName.includes(word))
      );
      
      if (wordMatches.length > 0) {
        const suggestions = Array.from(new Set(wordMatches.slice(0, 5).map((t: any) => t.name))).join(', ');
        throw new Error(`Time "${name}" não encontrado. Você quis dizer: ${suggestions}?`);
      }
    }
  } else {
    // Se houver múltiplos matches parciais
    const suggestions = partialMatches.slice(0, 5).map((t: any) => t.name).join(', ');
    throw new Error(`Múltiplos times encontrados para "${name}". Sugestões: ${suggestions}`);
  }

  throw new Error(`O time "${name}" não foi encontrado. Tente usar o nome oficial ou verifique se o time pertence às principais ligas (Europa/Brasil).`);
}

export async function getTodaysMatches() {
  const now = new Date();
  // Garantir que a busca comece EXATAMENTE de hoje para frente
  const today = now.toISOString().split('T')[0];
  
  // Janela de 7 dias para garantir conteúdo, mas o filtro abaixo removerá o passado
  const nextWeek = new Date();
  nextWeek.setDate(now.getDate() + 7);
  const dateTo = nextWeek.toISOString().split('T')[0];

  try {
    const data = await fetchWithAuth(`/matches?dateFrom=${today}&dateTo=${dateTo}`);
    
    console.log('Dados recebidos da API:', data);
    if (!data.matches) {
      console.warn('Nenhum campo "matches" encontrado na resposta da API.');
      return [];
    }

    // FILTRO RIGOROSO:
    // 1. Remove jogos finalizados (FINISHED)
    // 2. Remove jogos cancelados ou adiados
    // 3. Garante que o jogo não começou há mais de 6 horas (evita jogos de ontem que a API ainda lista)
    const activeMatches = data.matches.filter((match: any) => {
      const matchDate = new Date(match.utcDate);
      const isFinished = match.status === 'FINISHED';
      const isCancelled = match.status === 'CANCELLED' || match.status === 'POSTPONED';
      
      // Só aceita se não terminou e se é de hoje/futuro (com margem de 6h para jogos em andamento)
      const isPast = matchDate.getTime() < (now.getTime() - 360 * 60 * 1000);
      
      return !isFinished && !isCancelled && !isPast;
    });

    console.log('Jogos ativos após filtro:', activeMatches.length);

    return activeMatches.sort((a: any, b: any) => 
      new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
    );
  } catch (error) {
    console.error('Erro ao buscar jogos:', error);
    throw error;
  }
}

export async function getTeamMatches(teamId: number) {
  const data = await fetchWithAuth(`/teams/${teamId}/matches?status=FINISHED&limit=20`);
  return data.matches as MatchData[];
}

export function calculateStats(matches: MatchData[], teamId: number, isHome: boolean): TeamStats {
  const filteredMatches = matches.filter(m => isHome ? m.homeTeam.id === teamId : m.awayTeam.id === teamId);
  
  let stats: TeamStats = {
    teamName: isHome ? filteredMatches[0]?.homeTeam.name : filteredMatches[0]?.awayTeam.name,
    gamesPlayed: filteredMatches.length,
    goalsScored: 0,
    goalsConceded: 0,
    over15Count: 0,
    htGoalCount: 0,
    bttsCount: 0
  };

  filteredMatches.forEach(m => {
    const scored = isHome ? m.score.fullTime.home : m.score.fullTime.away;
    const conceded = isHome ? m.score.fullTime.away : m.score.fullTime.home;
    const htHome = m.score.halfTime.home ?? 0;
    const htAway = m.score.halfTime.away ?? 0;
    
    stats.goalsScored += scored;
    stats.goalsConceded += conceded;
    
    if ((scored + conceded) >= 2) stats.over15Count++;
    if ((htHome + htAway) >= 1) stats.htGoalCount++;
    if (scored > 0 && conceded > 0) stats.bttsCount++;
  });

  return stats;
}

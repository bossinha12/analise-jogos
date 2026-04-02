/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Trophy, 
  Target, 
  Zap, 
  Loader2, 
  AlertCircle,
  BarChart3,
  ShieldCheck,
  Activity,
  History,
  Calendar,
  ChevronRight,
  Clock,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getTodaysMatches, getTeamMatches, calculateStats, TeamStats } from './services/footballService';

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

interface Prediction {
  market: string;
  score: number; // 0-10
  probability: 'Alta' | 'Média' | 'Baixa';
  risk: 'Baixo' | 'Médio' | 'Alto';
  justification: string;
  status: string; // Calculated based on score
}

interface AnalysisResult {
  homeTeam: string;
  awayTeam: string;
  matchContext: string;
  predictions: Prediction[];
  bestEntry: Prediction;
  statsSummary: {
    homeAtHome: string;
    awayAtAway: string;
    patterns: string;
  };
}

export default function App() {
  const [todaysMatches, setTodaysMatches] = useState<any[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [realStats, setRealStats] = useState<{ home: TeamStats; away: TeamStats } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    setIsLoadingMatches(true);
    setError(null);
    try {
      const matches = await getTodaysMatches();
      setTodaysMatches(matches);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao carregar jogos de hoje. Tente novamente mais tarde.');
    } finally {
      setIsLoadingMatches(false);
    }
  };

  const analyzeMatch = async (match: any) => {
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setRealStats(null);
    setSelectedMatchId(match.id);

    try {
      // 1. Fetch Real Data for the specific teams
      const [homeMatches, awayMatches] = await Promise.all([
        getTeamMatches(match.homeTeam.id),
        getTeamMatches(match.awayTeam.id)
      ]);

      const homeStats = calculateStats(homeMatches, match.homeTeam.id, true);
      const awayStats = calculateStats(awayMatches, match.awayTeam.id, false);

      setRealStats({ home: homeStats, away: awayStats });

      // 2. AI Analysis with Real Stats
      const model = "gemini-3-flash-preview";
      const prompt = `Analise o jogo de futebol entre ${homeStats.teamName} (Casa) vs ${awayStats.teamName} (Fora).
      
      ESTATÍSTICAS REAIS FORNECIDAS:
      - ${homeStats.teamName} (Mandante): ${homeStats.gamesPlayed} jogos em casa analisados. Gols marcados: ${homeStats.goalsScored} (Média ${(homeStats.goalsScored/homeStats.gamesPlayed).toFixed(2)}). Gols sofridos: ${homeStats.goalsConceded}. Frequência Over 1.5: ${((homeStats.over15Count/homeStats.gamesPlayed)*100).toFixed(0)}%. Frequência Gol HT: ${((homeStats.htGoalCount/homeStats.gamesPlayed)*100).toFixed(0)}%.
      - ${awayStats.teamName} (Visitante): ${awayStats.gamesPlayed} jogos fora analisados. Gols marcados: ${awayStats.goalsScored} (Média ${(awayStats.goalsScored/awayStats.gamesPlayed).toFixed(2)}). Gols sofridos: ${awayStats.goalsConceded}. Frequência Over 1.5: ${((awayStats.over15Count/awayStats.gamesPlayed)*100).toFixed(0)}%. Frequência Gol HT: ${((awayStats.htGoalCount/awayStats.gamesPlayed)*100).toFixed(0)}%.

      Siga RIGOROSAMENTE estes critérios:
      1. AVALIAR FREQUÊNCIA: Use os dados acima para validar Over 1.5, Gols no HT e Ambas Marcam.
      2. AVALIAR PADRÕES: O time da casa marca com consistência? O visitante sofre gols fora? O jogo tende a ser aberto ou travado?
      
      3. GERE NOTAS DE 0 A 10 para:
      - Over 1.5 FT
      - Over 0.5 HT
      - Ambas marcam
      - Vitória Casa
      - Vitória Visitante
      
      REGRAS DE STATUS:
      - Nota >= 8: Entrada Forte
      - Nota 6-7: Média
      - Nota <= 5: NÃO ENTRAR
      
      Retorne a resposta estritamente em formato JSON:
      {
        "homeTeam": "${homeStats.teamName}",
        "awayTeam": "${awayStats.teamName}",
        "matchContext": "Resumo curto",
        "statsSummary": {
          "homeAtHome": "Resumo do desempenho da casa",
          "awayAtAway": "Resumo do desempenho do visitante",
          "patterns": "Padrão identificado"
        },
        "predictions": [
          { "market": "Over 1.5 FT", "score": 8.5, "probability": "Alta", "risk": "Baixo", "justification": "...", "status": "Entrada Forte" },
          ... (5 mercados)
        ],
        "bestEntry": { "market": "...", "score": 9.0, "probability": "Alta", "risk": "Baixo", "justification": "...", "status": "Entrada Forte" }
      }`;

      const response = await genAI.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const data = JSON.parse(response.text || "{}");
      setResult(data);
      
      // Scroll to result
      setTimeout(() => {
        window.scrollTo({ top: document.getElementById('analysis-result')?.offsetTop || 0, behavior: 'smooth' });
      }, 100);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao analisar o jogo. Tente novamente.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-emerald-500';
    if (score >= 6) return 'text-amber-500';
    return 'text-red-500';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Entrada Forte': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'Média': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      default: return 'bg-red-500/10 text-red-500 border-red-500/20';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Baixo': return 'text-emerald-400';
      case 'Médio': return 'text-amber-400';
      case 'Alto': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && 
                    date.getMonth() === now.getMonth() && 
                    date.getFullYear() === now.getFullYear();
    
    const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Hoje, ${time}`;
    
    return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} • ${time}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500 p-1.5 rounded-lg shadow-lg shadow-emerald-500/20">
              <Trophy className="w-6 h-6 text-slate-950" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">FootyAnalyzer <span className="text-emerald-500">PRO</span></h1>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1"><Calendar className="w-4 h-4 text-emerald-500" /> Jogos do Dia</span>
            <span className="flex items-center gap-1"><Activity className="w-4 h-4 text-emerald-500" /> Dados Reais</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Match List Section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black flex items-center gap-2">
              <Globe className="w-6 h-6 text-emerald-500" />
              Partidas de Hoje
            </h2>
            <button 
              onClick={fetchMatches}
              className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors flex items-center gap-1"
            >
              <Activity className="w-3 h-3" /> Atualizar Lista
            </button>
          </div>

          {isLoadingMatches ? (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
              <p className="text-slate-400 font-medium">Buscando partidas em tempo real...</p>
            </div>
          ) : todaysMatches.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <Calendar className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-400 font-medium">Nenhum jogo encontrado hoje nas ligas suportadas.</p>
              <p className="text-xs text-slate-600 mt-2">Tente atualizar a lista mais tarde.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {todaysMatches.map((match) => (
                <motion.div 
                  key={match.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-slate-900 border ${selectedMatchId === match.id ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-slate-800'} p-5 rounded-2xl hover:border-slate-700 transition-all group`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                      <Globe className="w-3 h-3" /> {match.competition.name}
                    </span>
                    <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatTime(match.utcDate)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 mb-6">
                    <div className="flex-1 text-center">
                      <div className="text-sm font-black text-slate-200 line-clamp-1">{match.homeTeam.name}</div>
                      <div className="text-[10px] text-slate-500 uppercase font-bold mt-1">Casa</div>
                    </div>
                    <div className="text-slate-700 font-black italic">VS</div>
                    <div className="flex-1 text-center">
                      <div className="text-sm font-black text-slate-200 line-clamp-1">{match.awayTeam.name}</div>
                      <div className="text-[10px] text-slate-500 uppercase font-bold mt-1">Fora</div>
                    </div>
                  </div>

                  <button 
                    onClick={() => analyzeMatch(match)}
                    disabled={isAnalyzing}
                    className="w-full py-3 bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-500/5 text-slate-300 hover:text-emerald-400 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    {isAnalyzing && selectedMatchId === match.id ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Analisando...
                      </>
                    ) : (
                      <>
                        Analisar Jogo <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </motion.div>
              ))}
            </div>
          )}

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </motion.div>
          )}
        </section>

        {/* Results Section */}
        <div id="analysis-result">
          <AnimatePresence mode="wait">
            {result && !isAnalyzing && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-px flex-1 bg-slate-800" />
                  <h2 className="text-xl font-black text-emerald-500 uppercase tracking-widest">Resultado da Análise</h2>
                  <div className="h-px flex-1 bg-slate-800" />
                </div>

                {/* Real Stats Section */}
                {realStats && (
                  <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[realStats.home, realStats.away].map((stats, i) => (
                      <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <History className="w-4 h-4 text-emerald-500" />
                          <h3 className="font-bold text-slate-200">{stats.teamName} <span className="text-slate-500 text-xs font-normal">({i === 0 ? 'Casa' : 'Fora'})</span></h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">
                            <div className="text-xs text-slate-500 uppercase font-bold">Gols Marcados</div>
                            <div className="text-xl font-black text-emerald-500">{stats.goalsScored} <span className="text-xs font-normal text-slate-600">avg {(stats.goalsScored/stats.gamesPlayed).toFixed(1)}</span></div>
                          </div>
                          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">
                            <div className="text-xs text-slate-500 uppercase font-bold">Over 1.5</div>
                            <div className="text-xl font-black text-emerald-500">{((stats.over15Count/stats.gamesPlayed)*100).toFixed(0)}%</div>
                          </div>
                          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">
                            <div className="text-xs text-slate-500 uppercase font-bold">Gol no HT</div>
                            <div className="text-xl font-black text-emerald-500">{((stats.htGoalCount/stats.gamesPlayed)*100).toFixed(0)}%</div>
                          </div>
                          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">
                            <div className="text-xs text-slate-500 uppercase font-bold">BTTS</div>
                            <div className="text-xl font-black text-emerald-500">{((stats.bttsCount/stats.gamesPlayed)*100).toFixed(0)}%</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </section>
                )}

                {/* Best Entry Highlight */}
                <div className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Target className="w-24 h-24" />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="w-5 h-5 text-emerald-500" />
                      <span className="text-xs font-black text-emerald-500 uppercase tracking-widest">Melhor Entrada Sugerida</span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div>
                        <h2 className="text-3xl font-black mb-2">{result.bestEntry.market}</h2>
                        <p className="text-slate-300 max-w-2xl italic">"{result.bestEntry.justification}"</p>
                      </div>
                      <div className="flex items-center gap-6 bg-slate-950/50 p-4 rounded-2xl border border-white/5">
                        <div className="text-center">
                          <div className={`text-2xl font-black ${getScoreColor(result.bestEntry.score)}`}>{result.bestEntry.score}</div>
                          <div className="text-[10px] text-slate-500 uppercase font-bold">Nota</div>
                        </div>
                        <div className="w-px h-8 bg-slate-800" />
                        <div className="text-center">
                          <div className="text-lg font-bold text-slate-200">{result.bestEntry.probability}</div>
                          <div className="text-[10px] text-slate-500 uppercase font-bold">Prob.</div>
                        </div>
                        <div className="w-px h-8 bg-slate-800" />
                        <div className="text-center">
                          <div className={`text-lg font-bold ${getRiskColor(result.bestEntry.risk)}`}>{result.bestEntry.risk}</div>
                          <div className="text-[10px] text-slate-500 uppercase font-bold">Risco</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* All Markets Grid */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-2">Análise por Mercado</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {result.predictions.map((pred, idx) => (
                      <motion.div 
                        key={pred.market}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center gap-4 hover:border-slate-700 transition-all"
                      >
                        <div className="md:w-1/4">
                          <h4 className="font-bold text-slate-200">{pred.market}</h4>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-black border ${getStatusBadge(pred.status)}`}>
                            {pred.status}
                          </span>
                        </div>
                        
                        <div className="flex flex-1 items-center justify-around gap-4 bg-slate-950/30 p-3 rounded-lg border border-slate-800/50">
                          <div className="text-center">
                            <div className={`text-xl font-black ${getScoreColor(pred.score)}`}>{pred.score}</div>
                            <div className="text-[9px] text-slate-500 uppercase font-bold">Nota</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-bold text-slate-300">{pred.probability}</div>
                            <div className="text-[9px] text-slate-500 uppercase font-bold">Prob.</div>
                          </div>
                          <div className="text-center">
                            <div className={`text-sm font-bold ${getRiskColor(pred.risk)}`}>{pred.risk}</div>
                            <div className="text-[9px] text-slate-500 uppercase font-bold">Risco</div>
                          </div>
                        </div>

                        <div className="md:w-1/3">
                          <p className="text-xs text-slate-400 leading-relaxed italic">
                            {pred.justification}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {!result && !isAnalyzing && !isLoadingMatches && todaysMatches.length > 0 && (
          <div className="text-center py-12 space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-full border border-slate-800 mb-4">
              <Zap className="w-8 h-8 text-slate-700" />
            </div>
            <div className="max-w-md mx-auto">
              <h2 className="text-xl font-bold mb-2">Selecione um jogo acima</h2>
              <p className="text-slate-500 text-sm">
                Escolha uma partida para ver estatísticas reais e análise de probabilidade por IA.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto py-8 border-t border-slate-900 text-center">
        <p className="text-slate-600 text-[10px] uppercase tracking-widest font-bold">
          FootyAnalyzer API Edition • v4.0
        </p>
      </footer>
    </div>
  );
}

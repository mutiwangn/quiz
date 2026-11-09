import type { Mode, Question } from './types.ts';

export interface Answer { questionId: string; choiceId: string; at: number }
export interface Player { id: string; name: string; answers: Answer[] }
export interface Round {
  id: string; mode: Mode; questions: Question[]; players: Player[];
  startedAt: number; deadline: number | null; endedAt: number | null;
}
export interface PlayerScore { id: string; name: string; answered: number; correct: number; accuracy: number | null }
export interface RoundSummary {
  id: string; mode: Mode; players: PlayerScore[]; total: number;
  startedAt: number; endedAt: number | null; winnerId: string | null;
}

export function createRound(config: { id: string; mode: Mode; questions: Question[]; players: string[]; durationMs: number | null }, now: number): Round {
  if (!config.questions.length || new Set(config.questions.map(q => q.id)).size !== config.questions.length
    || config.players.length !== (config.mode === 'duel' ? 2 : 1) || config.players.some(name => !name.trim())
    || (config.durationMs !== null && (!Number.isFinite(config.durationMs) || config.durationMs <= 0))
    || (config.mode === 'duel' && config.durationMs === null)) throw new Error('对局设置不完整');
  return { id: config.id, mode: config.mode, questions: config.questions,
    players: config.players.map((name, i) => ({ id: `p${i + 1}`, name, answers: [] })),
    startedAt: now, deadline: config.durationMs === null ? null : now + config.durationMs, endedAt: null };
}

export function submitAnswer(round: Round, input: { playerId: string; questionId: string; choiceId: string }, now: number): Round {
  round = settleRound(round, now);
  if (round.endedAt !== null || now < round.startedAt) return round;
  const player = round.players.find(p => p.id === input.playerId);
  const question = round.questions[player?.answers.length ?? -1];
  if (!player || !question || input.questionId !== question.id || !question.choices.some(c => c.id === input.choiceId)) return round;
  return settleRound({ ...round, players: round.players.map(p => p.id === input.playerId
    ? { ...p, answers: [...p.answers, { questionId: input.questionId, choiceId: input.choiceId, at: now }] } : p) }, now);
}

export function settleRound(round: Round, now: number): Round {
  if (round.endedAt !== null) return round;
  if (round.deadline !== null && now >= round.deadline) return { ...round, endedAt: round.deadline };
  if (round.players.every(p => p.answers.length === round.questions.length)) return { ...round, endedAt: now };
  return round;
}

export function summarizeRound(round: Round): RoundSummary {
  const players = round.players.map(p => {
    const correct = p.answers.filter(a => round.questions.find(q => q.id === a.questionId)?.answerId === a.choiceId).length;
    return { id: p.id, name: p.name, answered: p.answers.length, correct, accuracy: p.answers.length ? correct / p.answers.length : null };
  });
  const winnerId = round.endedAt !== null && round.mode === 'duel' && players[0].correct !== players[1].correct
    ? (players[0].correct > players[1].correct ? players[0].id : players[1].id) : null;
  return { id: round.id, mode: round.mode, players, total: round.questions.length,
    startedAt: round.startedAt, endedAt: round.endedAt, winnerId };
}

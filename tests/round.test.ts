import { describe, expect, it } from 'vitest';
import { appendQuestions, createRound, settleRound, submitAnswer, summarizeRound } from '../shared/round';
import type { Question } from '../shared/types';

const question: Question = {
  id: 'sound-1', kind: 'single', lessonIds: ['sound-lesson-1'],
  prompt: '物体发声时通常在做什么？', images: [],
  choices: [{ id: 'a', text: '振动' }, { id: 'b', text: '静止' }],
  answerId: 'a', explanation: '声音由物体振动产生。',
};

describe('对局公开接口', () => {
  it('同一道题的重复提交只计入第一次答案', () => {
    const round = createRound({ id: 'r1', mode: 'duel', questions: [question], durationMs: 60000 }, 1000);
    const first = submitAnswer(round, { playerId: 'p1', questionId: 'sound-1', choiceId: 'b' }, 2000);
    const repeated = submitAnswer(first, { playerId: 'p1', questionId: 'sound-1', choiceId: 'a' }, 2001);
    expect(summarizeRound(repeated).players[0]).toMatchObject({ answered: 1, correct: 0, accuracy: 0 });
    expect(summarizeRound(repeated).players[1]).toMatchObject({ answered: 0, correct: 0, accuracy: null });
  });
  it('截止时刻到达后拒收答案，即使页面计时器未刷新', () => {
    const round = createRound({ id: 'r2', mode: 'duel', questions: [question], durationMs: 1000 }, 1000);
    const ended = submitAnswer(round, { playerId: 'p1', questionId: question.id, choiceId: 'a' }, 2000);
    expect(summarizeRound(ended)).toMatchObject({ endedAt: 2000 });
  });
  it('双人做完当前题包也等到截止时间，按累计总分结算', () => {
    let round = createRound({ id: 'r3', mode: 'duel', questions: [question], durationMs: 60000 }, 1000);
    round = submitAnswer(round, { playerId: 'p1', questionId: question.id, choiceId: 'a' }, 2000);
    expect(round.endedAt).toBeNull();
    round = submitAnswer(round, { playerId: 'p2', questionId: question.id, choiceId: 'a' }, 4000);
    expect(summarizeRound(round)).toMatchObject({ endedAt: null, winnerId: null });
    expect(settleRound(round, 100000).endedAt).toBe(61000);
  });
  it('以总分确定胜者，忽略未选项和越题提交', () => {
    let round = createRound({ id: 'r4', mode: 'duel', questions: [question], durationMs: 1000 }, 1000);
    expect(submitAnswer(round, { playerId: 'p1', questionId: 'other', choiceId: 'a' }, 1100)).toBe(round);
    expect(submitAnswer(round, { playerId: 'p1', questionId: question.id, choiceId: 'x' }, 1100)).toBe(round);
    round = submitAnswer(round, { playerId: 'p2', questionId: question.id, choiceId: 'a' }, 1999);
    expect(summarizeRound(settleRound(round, 9000)).winnerId).toBe('p2');
  });
  it('补题延续同一题序和截止时间，重复题不能再次计分', () => {
    let round = createRound({ id: 'refill', mode: 'duel', questions: [question], durationMs: 60000 }, 1000);
    round = submitAnswer(round, { playerId: 'p1', questionId: question.id, choiceId: 'a' }, 2000);
    const next = { ...question, id: 'sound-2', prompt: '音叉停止振动时还会继续发声吗？' };
    round = appendQuestions(round, [question, { ...question, id: 'renamed-duplicate' }, next], 3000);
    expect(round.questions.map(q => q.id)).toEqual(['sound-1', 'sound-2']);
    expect(round.deadline).toBe(61000);
    round = submitAnswer(round, { playerId: 'p1', questionId: 'sound-2', choiceId: 'b' }, 4000);
    round = submitAnswer(round, { playerId: 'p2', questionId: 'sound-1', choiceId: 'a' }, 5000);
    expect(summarizeRound(round).players).toMatchObject([{ answered: 2, score: 1, accuracy: 0.5 }, { answered: 1, score: 1, accuracy: 1 }]);
    const ended = appendQuestions(round, [{ ...next, id: 'late', prompt: '截止后的新题' }], 61000);
    expect(ended.questions).toHaveLength(2);
    expect(ended.endedAt).toBe(61000);
  });
  it('拒绝空题包、缺少双人时限与重复题号', () => {
    expect(() => createRound({ id: 'empty', mode: 'single', questions: [], durationMs: null }, 1000)).toThrow();
    expect(() => createRound({ id: 'missing', mode: 'duel', questions: [question], durationMs: null }, 1000)).toThrow();
    expect(() => createRound({ id: 'duplicate', mode: 'single', questions: [question, question], durationMs: null }, 1000)).toThrow();
  });
});

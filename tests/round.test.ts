import { describe, expect, it } from 'vitest';
import { createRound, settleRound, submitAnswer, summarizeRound } from '../shared/round';
import type { Question } from '../shared/types';

const question: Question = {
  id: 'sound-1', kind: 'single', lessonIds: ['sound-lesson-1'],
  prompt: '物体发声时通常在做什么？', images: [],
  choices: [{ id: 'a', text: '振动' }, { id: 'b', text: '静止' }],
  answerId: 'a', explanation: '声音由物体振动产生。',
};

describe('对局公开接口', () => {
  it('同一道题的重复提交只计入第一次答案', () => {
    const round = createRound({ id: 'r1', mode: 'duel', questions: [question], players: ['小蓝', '小橙'], durationMs: 60000 }, 1000);
    const first = submitAnswer(round, { playerId: 'p1', questionId: 'sound-1', choiceId: 'b' }, 2000);
    const repeated = submitAnswer(first, { playerId: 'p1', questionId: 'sound-1', choiceId: 'a' }, 2001);
    expect(summarizeRound(repeated).players[0]).toMatchObject({ answered: 1, correct: 0, accuracy: 0 });
    expect(summarizeRound(repeated).players[1]).toMatchObject({ answered: 0, correct: 0, accuracy: null });
  });
  it('截止时刻到达后拒收答案，即使页面计时器未刷新', () => {
    const round = createRound({ id: 'r2', mode: 'duel', questions: [question], players: ['甲', '乙'], durationMs: 1000 }, 1000);
    const ended = submitAnswer(round, { playerId: 'p1', questionId: question.id, choiceId: 'a' }, 2000);
    expect(summarizeRound(ended)).toMatchObject({ endedAt: 2000, players: [{ answered: 0 }, { answered: 0 }] });
  });
  it('双方完成同一题包即提前结算，答对数相同为平局', () => {
    let round = createRound({ id: 'r3', mode: 'duel', questions: [question], players: ['甲', '乙'], durationMs: 60000 }, 1000);
    round = submitAnswer(round, { playerId: 'p1', questionId: question.id, choiceId: 'a' }, 2000);
    expect(round.endedAt).toBeNull();
    round = submitAnswer(round, { playerId: 'p2', questionId: question.id, choiceId: 'a' }, 4000);
    expect(summarizeRound(round)).toMatchObject({ endedAt: 4000, winnerId: null, players: [{ correct: 1, accuracy: 1 }, { correct: 1, accuracy: 1 }] });
    expect(settleRound(round, 100000).endedAt).toBe(4000);
  });
  it('以答对数确定胜者，忽略未选项和越题提交', () => {
    let round = createRound({ id: 'r4', mode: 'duel', questions: [question], players: ['甲', '乙'], durationMs: 1000 }, 1000);
    expect(submitAnswer(round, { playerId: 'p1', questionId: 'other', choiceId: 'a' }, 1100)).toBe(round);
    expect(submitAnswer(round, { playerId: 'p1', questionId: question.id, choiceId: 'x' }, 1100)).toBe(round);
    round = submitAnswer(round, { playerId: 'p2', questionId: question.id, choiceId: 'a' }, 1999);
    expect(summarizeRound(settleRound(round, 9000)).winnerId).toBe('p2');
  });
  it('拒绝空题包、不完整双人名单与重复题号', () => {
    expect(() => createRound({ id: 'empty', mode: 'single', questions: [], players: ['甲'], durationMs: null }, 1000)).toThrow();
    expect(() => createRound({ id: 'missing', mode: 'duel', questions: [question], players: ['甲'], durationMs: 1000 }, 1000)).toThrow();
    expect(() => createRound({ id: 'duplicate', mode: 'single', questions: [question, question], players: ['甲'], durationMs: null }, 1000)).toThrow();
  });
});

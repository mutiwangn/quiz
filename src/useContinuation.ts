import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { appendQuestions, type Round } from '../shared/round';
import type { BatchRequest, Catalog } from '../shared/types';
import { PreparationError, prepareBatch } from './api';

export interface Continuation { status: 'idle' | 'loading' | 'error'; message: string; retryAt: number }
const idle: Continuation = { status: 'idle', message: '', retryAt: 0 };

export function useContinuation(round: Round | null, catalog: Catalog | null, request: BatchRequest | null, setRound: Dispatch<SetStateAction<Round | null>>) {
  const [state, setState] = useState<Continuation>(idle);
  const latest = useRef({ round, catalog, request });
  latest.current = { round, catalog, request };
  const active = useRef<AbortController | null>(null);
  const attempted = useRef('');
  useEffect(() => {
    setState(idle); attempted.current = '';
    return () => { active.current?.abort(); active.current = null; };
  }, [round?.id, round?.endedAt]);

  const retry = useCallback(async () => {
    const { round: current, catalog: book, request: input } = latest.current;
    if (!current || !book || !input || current.mode !== 'duel' || current.endedAt !== null || active.current || Date.now() >= current.deadline!) return;
    const controller = new AbortController(); active.current = controller;
    attempted.current = `${current.id}:${current.questions.length}`;
    const timeout = setTimeout(() => controller.abort('timeout'), 45000);
    setState({ status: 'loading', message: '正在准备后续题目…', retryAt: 0 });
    try {
      const next = await prepareBatch({ ...input, excludeIds: current.questions.map(q => q.id) }, book, controller.signal);
      const live = latest.current.round;
      if (controller.signal.aborted || live?.id !== current.id || live.endedAt !== null || Date.now() >= live.deadline!) return;
      if (appendQuestions(live, next.questions, Date.now()).questions.length === live.questions.length) throw new Error('没有取得新题目，旧题不会重复计分。请重试。');
      setRound(value => value?.id === current.id ? appendQuestions(value, next.questions, Date.now()) : value);
      setState(idle);
    } catch (error) {
      if (controller.signal.aborted && controller.signal.reason !== 'timeout') return;
      const detail = controller.signal.reason === 'timeout' ? '准备后续题目超时，请重试。' : error instanceof Error ? error.message : '后续题目未能加载，请重试。';
      setState({ status: 'error', message: detail, retryAt: error instanceof PreparationError ? error.retryAt : 0 });
    } finally {
      clearTimeout(timeout);
      if (active.current === controller) active.current = null;
    }
  }, [setRound]);

  useEffect(() => {
    if (!round || round.mode !== 'duel' || round.endedAt !== null || state.status !== 'idle') return;
    const remaining = round.questions.length - Math.max(...round.players.map(p => p.answers.length));
    const threshold = Math.min(8, Math.floor((request?.count ?? 10) / 2));
    if (remaining <= threshold && attempted.current !== `${round.id}:${round.questions.length}`) void retry();
  }, [round, request, state.status, retry]);
  return { state, retry };
}

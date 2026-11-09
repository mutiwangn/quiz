import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle, ClockCounterClockwise } from '@phosphor-icons/react';
import { createRound, settleRound, submitAnswer, summarizeRound, type Round } from '../shared/round';
import type { BatchRequest, Catalog, QuestionBatch } from '../shared/types';
import { selectedLessonNames } from '../shared/catalog';
import { isPreview, loadCatalog, prepareBatch } from './api';
import Setup, { type Settings } from './Setup';
import { Results, RoundScreen } from './Play';
import History from './HistoryPage';
import { saveHistory } from './history';
import { useContinuation } from './useContinuation';

type Page = 'setup' | 'prepared' | 'round' | 'history';
export default function App() {
  const [page, setPage] = useState<Page>('setup');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [unitId, setUnitId] = useState('');
  const [settings, setSettings] = useState<Settings>({ mode: 'single', count: isPreview ? 5 : 10, kinds: ['single', 'boolean'], seconds: 120 });
  const [busy, setBusy] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [error, setError] = useState('');
  const [batch, setBatch] = useState<QuestionBatch | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [request, setRequest] = useState<BatchRequest | null>(null);
  const continuation = useContinuation(round, catalog, request, setRound);
  const [now, setNow] = useState(Date.now());
  const [saved, setSaved] = useState<{ id: string; message: string } | null>(null);
  const pending = useRef<AbortController | null>(null);
  const saving = useRef(new Set<string>());
  const lessonNames = useRef<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('timeout'), 30000);
    setCatalogLoading(true); setError('');
    loadCatalog(controller.signal).then(data => {
      if (controller.signal.aborted) return;
      setCatalog(data); setUnitId(data.units[0].id);
      setSelected(isPreview ? data.units[0].lessons.slice(0, 2).map(l => l.id) : []);
    }).catch(() => { if (!controller.signal.aborted || controller.signal.reason === 'timeout') setError('课时暂时无法加载，请检查网络后重试。'); })
      .finally(() => { clearTimeout(timeout); if (!controller.signal.aborted || controller.signal.reason === 'timeout') setCatalogLoading(false); });
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [catalogAttempt]);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    if (!round || round.endedAt !== null) return;
    const tick = () => { const time = Date.now(); setNow(time); setRound(r => r ? settleRound(r, time) : r); };
    const interval = setInterval(tick, 200);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', tick); };
  }, [round?.id, round?.endedAt]);
  useEffect(() => {
    if (!round || round.endedAt === null || !batch || saving.current.has(round.id)) return;
    saving.current.add(round.id); setSaved({ id: round.id, message: '' });
    saveHistory({ ...summarizeRound(round), origin: batch.origin, lessonNames: lessonNames.current })
      .then(() => setSaved({ id: round.id, message: '已保存到本机成绩。' })).catch(() => setSaved({ id: round.id, message: '本局成绩未能保存，请保留当前页面。请检查浏览器存储权限。' }));
  }, [round, batch]);
  const cancel = () => { pending.current?.abort(); pending.current = null; setBusy(false); };
  const prepare = async () => {
    if (!catalog || busy) return;
    if (!selected.length || !settings.kinds.length) { setError('请至少选择一个课时和一种题型。'); return; }
    const controller = new AbortController(); pending.current = controller;
    const timeout = setTimeout(() => controller.abort('timeout'), 45000);
    setBusy(true); setError(''); setPage('setup'); setRound(null); setSaved(null);
    try {
      const input: BatchRequest = { catalogId: catalog.id, lessonIds: selected, kinds: settings.kinds, count: settings.mode === 'duel' ? isPreview ? 5 : 10 : settings.count };
      const prepared = await prepareBatch(input, catalog, controller.signal);
      if (controller.signal.aborted) return;
      lessonNames.current = selectedLessonNames(catalog, selected);
      setBatch(prepared); setRequest(input); setPage('prepared');
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '题目准备失败，请重试。');
      else if (controller.signal.reason === 'timeout') setError('准备题目超时，已保留课时选择，请重试。');
    } finally { clearTimeout(timeout); if (pending.current === controller) { pending.current = null; setBusy(false); } }
  };
  const begin = () => {
    if (!batch) return;
    const time = Date.now(); setNow(time);
    setRound(createRound({ id: crypto.randomUUID(), mode: settings.mode, questions: batch.questions, durationMs: settings.mode === 'duel' ? settings.seconds * 1000 : null }, time));
    setPage('round');
  };
  const answer = useCallback((playerId: string, questionId: string, choiceId: string) => setRound(r => r ? submitAnswer(r, { playerId, questionId, choiceId }, Date.now()) : r), []);
  const navigate = (target: Page) => {
    if (round && round.endedAt === null && page === 'round' && !window.confirm('离开将放弃这局尚未完成的作答，确认离开？')) return;
    if (round?.endedAt === null) setRound(null);
    cancel(); setPage(target);
  };
  const end = () => {
    if (round?.mode === 'duel') {
      if (window.confirm('放弃本局将不保存成绩，确认离开？')) { cancel(); setRound(null); setPage('setup'); }
    } else if (window.confirm('提前结束并结算当前成绩？')) {
      setRound(r => r ? { ...settleRound(r, Date.now()), endedAt: Date.now() } : r);
    }
  };
  const stageKey = `${page}:${busy ? 'preparing' : 'ready'}:${round?.id ?? ''}:${round?.endedAt ?? ''}`;
  return <>
    <header className="app-header"><button className="brand" onClick={() => navigate('setup')} aria-label="Quiz 科学答题，返回选课"><strong>Quiz</strong><span>科学答题</span></button><nav aria-label="主导航"><button onClick={() => navigate('setup')} aria-current={page !== 'history' ? 'page' : undefined}><BookOpen size={20} aria-hidden="true" />开始练习</button><button onClick={() => navigate('history')} aria-current={page === 'history' ? 'page' : undefined}><ClockCounterClockwise size={20} aria-hidden="true" />本机成绩</button></nav></header>
    {isPreview && <div className="preview-banner"><strong>开发预览</strong> · 使用少量样题验证操作，整册实时内容尚未接通。</div>}
    <div key={stageKey} className="surface-transition">
    {page === 'history' ? <History onBack={() => setPage('setup')} /> : page === 'round' && round ? round.endedAt !== null ? <Results round={round} saveMessage={saved?.id === round.id ? saved.message : ''} onAgain={prepare} onSetup={() => setPage('setup')} /> : <RoundScreen key={round.id} round={round} now={now} onAnswer={answer} onEnd={end} continuation={continuation.state} onRetry={continuation.retry} /> : page === 'prepared' && batch ? <main className="ready-layout"><CheckCircle className="ready-icon" size={52} weight="duotone" aria-hidden="true" /><h1>准备好了</h1><p>{batch.questions.length} 道题已加载完成</p><div className="ready-range">{lessonNames.current.join('；')}</div><p>{settings.mode === 'duel' ? `左方在左，右方在右。限时 ${settings.seconds / 60} 分钟，比总分；答对 +1，答错不扣分。` : '按自己的节奏作答。'}</p><button className="primary-button" onClick={begin}>{settings.mode === 'duel' ? '开始竞速' : '进入练习'}<ArrowRight size={22} aria-hidden="true" /></button><button className="text-button" onClick={() => setPage('setup')}>返回调整</button></main> : catalog ? <Setup catalog={catalog} selected={selected} unitId={unitId} settings={settings} setSelected={setSelected} setUnitId={setUnitId} setSettings={setSettings} onPrepare={prepare} onCancel={cancel} busy={busy} error={error} /> : <main className="catalog-state"><h1>{catalogLoading ? '正在加载课时…' : '课时暂时无法加载'}</h1><p role={catalogLoading ? 'status' : 'alert'}>{catalogLoading ? '马上就能选择今天的练习范围。' : error}</p>{!catalogLoading && <button className="primary-button" onClick={() => setCatalogAttempt(n => n + 1)}>重新加载</button>}</main>}
    </div>
    <footer className="app-footer">Quiz · 科学答题<span>让每一次思考，都有回响。</span></footer>
  </>;
}

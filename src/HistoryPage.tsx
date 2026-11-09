import { useEffect, useState } from 'react';
import { ClockCounterClockwise, Trash } from '@phosphor-icons/react';
import { clearHistory, readHistory, type HistoryRecord } from './history';
import { clockText, percentage } from './Play';
import { playerName } from '../shared/round';

export default function HistoryPage({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); setError(''); readHistory().then(setRecords).catch(() => setError('无法读取本机成绩，请检查浏览器存储权限后重试。')).finally(() => setLoading(false)); };
  useEffect(load, []);
  const clear = async () => {
    if (!window.confirm('清空这个浏览器保存的全部成绩？清空后无法恢复。')) return;
    try { await clearHistory(); setRecords([]); } catch { setError('清空失败，请稍后重试。'); }
  };
  return <main className="history-layout"><div className="page-heading"><div><h1>本机成绩</h1><p>记录只保存在当前浏览器，换设备后不会同步。</p></div><button className="secondary-button" disabled={loading || !records.length} onClick={clear}><Trash size={18} aria-hidden="true" />清空成绩</button></div>
    {loading ? <p className="state-message" role="status">正在读取成绩…</p> : error ? <div className="state-message"><p role="alert">{error}</p><button className="secondary-button" onClick={load}>重新读取</button></div> : records.length === 0 ? <div className="empty-state"><ClockCounterClockwise size={48} weight="duotone" aria-hidden="true" /><h2>第一局，等你开始</h2><p>完成练习或竞速后，成绩会出现在这里。</p><button className="primary-button" onClick={onBack}>去选课时</button></div> : <div className="history-list">{records.map(record => <article key={record.id} className="history-record"><div className="history-meta"><strong>{record.mode === 'single' ? '单人练习' : '双人竞速'}</strong>{record.origin === 'preview' && <span className="preview-tag">开发样题</span>}<time dateTime={new Date(record.startedAt).toISOString()}>{new Date(record.startedAt).toLocaleString('zh-CN')}</time><span>用时 {clockText((record.endedAt ?? record.startedAt) - record.startedAt)}</span></div><p className="history-lessons">{record.lessonNames.join('；')}</p><div className="history-players">{record.players.map((player, index) => <div key={player.id}><strong>{playerName(record.mode, index)}</strong>{record.mode === 'duel' && <span>总分 {player.score ?? player.correct} 分</span>}<span>已答 {player.answered} 题</span><span>答对 {player.correct} 题</span><span>正确率 {percentage(player.accuracy)}</span></div>)}</div>{record.mode === 'duel' && <p className="history-outcome">{record.winnerId ? `${playerName(record.mode, record.players.findIndex(p => p.id === record.winnerId))} 获胜` : '本局平局'}</p>}</article>)}</div>}
  </main>;
}

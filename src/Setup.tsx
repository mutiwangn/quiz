import { ArrowRight, CheckCircle, Users, User } from '@phosphor-icons/react';
import type { Catalog, Mode, QuestionKind } from '../shared/types';

export interface Settings { mode: Mode; count: number; kinds: QuestionKind[]; players: [string, string]; seconds: number }
interface Props {
  catalog: Catalog; selected: string[]; unitId: string; settings: Settings;
  setSelected: (ids: string[]) => void; setUnitId: (id: string) => void; setSettings: (settings: Settings) => void;
  onPrepare: () => void; onCancel: () => void; busy: boolean; error: string;
}

export default function Setup({ catalog, selected, unitId, settings, setSelected, setUnitId, setSettings, onPrepare, onCancel, busy, error }: Props) {
  const unit = catalog.units.find(u => u.id === unitId) ?? catalog.units[0];
  const toggle = (id: string) => setSelected(selected.includes(id) ? selected.filter(l => l !== id) : [...selected, id]);
  const allUnit = unit.lessons.every(l => selected.includes(l.id));
  const update = (part: Partial<Settings>) => setSettings({ ...settings, ...part });
  return <main className="setup-layout" aria-busy={busy}>
    <aside className="book-sidebar">
      <label className="field-label" htmlFor="book-select">教材与年级</label>
      <select id="book-select" value={catalog.id} onChange={() => {}}><option value={catalog.id}>四年级 · 上册</option></select>
      <p className="book-edition">{catalog.edition} · {catalog.title}</p>
      <nav className="units" aria-label="单元">
        {catalog.units.map((u, i) => {
          const n = u.lessons.filter(l => selected.includes(l.id)).length;
          return <button type="button" key={u.id} className={`unit-button ${u.id === unit.id ? 'active' : ''}`} onClick={() => setUnitId(u.id)} aria-current={u.id === unit.id ? 'true' : undefined}>
            <span className="unit-number">{i + 1}</span><span>{u.name}</span><span className="unit-count">{n}/{u.lessons.length}</span>
          </button>;
        })}
      </nav>
      <p className="sidebar-note">可以跨单元选择课时<br />首版支持这一本教材</p>
    </aside>
    <section className="lesson-section">
      <h1>今天，练哪一课？</h1>
      <p className="intro">选好课时，独自练习，或和同伴来一场比拼。</p>
      <div className="lesson-sheet">
        <div className="sheet-heading"><h2>{unit.name}</h2><button type="button" className="text-button" disabled={busy} onClick={() => setSelected(allUnit ? selected.filter(id => !unit.lessons.some(l => l.id === id)) : [...new Set([...selected, ...unit.lessons.map(l => l.id)])])}>{allUnit ? '取消本单元' : '全选本单元'}</button></div>
        <div className="lesson-list">
          {unit.lessons.map((lesson, i) => <label key={lesson.id} className={`lesson-row ${selected.includes(lesson.id) ? 'selected' : ''}`}>
            <input type="checkbox" checked={selected.includes(lesson.id)} onChange={() => toggle(lesson.id)} disabled={busy} />
            <span className="lesson-index">{i + 1}</span><span>{lesson.name}</span>
          </label>)}
        </div>
        <div className="selection-summary"><span><CheckCircle size={20} weight="fill" aria-hidden="true" />已选 <strong>{selected.length}</strong> 个课时</span><button type="button" className="text-button" disabled={selected.length === 0 || busy} onClick={() => setSelected([])}>清空选择</button></div>
      </div>
      {selected.length > 0 && <div className="selected-range"><strong>本局范围</strong><p>{catalog.units.flatMap(u => u.lessons.filter(l => selected.includes(l.id)).map(l => `${u.name} · ${l.name}`)).join('；')}</p></div>}
    </section>
    <aside className="prepare-sidebar">
      <form className="prepare-sheet" onSubmit={event => { event.preventDefault(); onPrepare(); }}>
        <h2>准备开始</h2>
        <fieldset disabled={busy}><legend>练习方式</legend><div className="mode-switch">
          <button type="button" aria-pressed={settings.mode === 'single'} onClick={() => update({ mode: 'single' })}><User size={20} aria-hidden="true" />单人练习</button>
          <button type="button" aria-pressed={settings.mode === 'duel'} onClick={() => update({ mode: 'duel' })}><Users size={20} aria-hidden="true" />双人竞速</button>
        </div></fieldset>
        <fieldset disabled={busy} className="settings-fields">
          <div className="setting-field"><label htmlFor="question-count">题目数量</label><select id="question-count" value={settings.count} onChange={e => update({ count: Number(e.target.value) })}>{[5, 10, 15, 20, 30].map(n => <option key={n} value={n}>{n} 题</option>)}</select></div>
          <div className="type-options"><span className="field-label">题型</span>{(['single', 'boolean'] as const).map(kind => <label key={kind}><input type="checkbox" checked={settings.kinds.includes(kind)} onChange={() => update({ kinds: settings.kinds.includes(kind) ? settings.kinds.filter(k => k !== kind) : [...settings.kinds, kind] })} />{kind === 'single' ? '单选题' : '判断题'}</label>)}</div>
          <label>{settings.mode === 'single' ? '你的昵称' : '左侧玩家'}<input maxLength={12} value={settings.players[0]} onChange={e => update({ players: [e.target.value, settings.players[1]] })} placeholder="输入昵称" required /></label>
          {settings.mode === 'duel' && <><label>右侧玩家<input maxLength={12} value={settings.players[1]} onChange={e => update({ players: [settings.players[0], e.target.value] })} placeholder="输入昵称" required /></label><div className="setting-field"><label htmlFor="duration">竞速时长</label><select id="duration" value={settings.seconds} onChange={e => update({ seconds: Number(e.target.value) })}>{[60, 120, 180, 300].map(n => <option value={n} key={n}>{n / 60} 分钟</option>)}</select></div></>}
        </fieldset>
        {error && <div className="error-message" role="alert">{error}</div>}
        <button className="primary-button" type="submit" disabled={busy || !selected.length || !settings.kinds.length}>{busy ? '正在准备题目…' : settings.mode === 'single' ? '开始练习' : '准备对战'}{!busy && <ArrowRight size={20} aria-hidden="true" />}</button>
        {busy && <button className="text-button cancel-prepare" type="button" onClick={onCancel}>取消准备</button>}
        <p className="prepare-note">{settings.mode === 'single' ? '不限时，提交后可查看解析。' : '同一组题，独立作答。答对数相同为平局。'}<br />题目和图片加载完后再开始。</p>
      </form>
      <p className="device-note">{settings.mode === 'duel' ? '推荐电脑或 iPad 横屏，支持同时触控。' : '成绩保存在当前浏览器。'}</p>
    </aside>
  </main>;
}

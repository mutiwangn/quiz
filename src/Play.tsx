import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle, Trophy, XCircle } from '@phosphor-icons/react';
import { summarizeRound, type Player, type Round, type PlayerScore } from '../shared/round';
import type { Question } from '../shared/types';
import type { Continuation } from './useContinuation';

export const percentage = (value: number | null) => value === null ? '—' : `${Math.round(value * 100)}%`;
export const clockText = (ms: number) => `${Math.floor(Math.max(0, ms) / 60000).toString().padStart(2, '0')}:${Math.floor(Math.max(0, ms) / 1000 % 60).toString().padStart(2, '0')}`;
const keys = [['a', 's', 'd', 'f'], ['j', 'k', 'l', ';']];

function AnswerContent({ question, choiceId }: { question: Question; choiceId: string }) {
  const index = question.choices.findIndex(choice => choice.id === choiceId);
  const choice = question.choices[index];
  if (!choice) return <span>未作答</span>;
  return <span className="answer-content"><span>{String.fromCharCode(65 + index)}. {choice.text || choice.image?.alt || '配图选项'}</span>{choice.image && <img className="choice-image" src={choice.image.url} alt={choice.image.alt || `选项 ${String.fromCharCode(65 + index)} 配图`} />}</span>;
}

function ScoreLine({ score, duel = false }: { score: PlayerScore; duel?: boolean }) {
  return <dl className="score-line" role="group" aria-label={`${score.name}成绩`}><div><dt>{duel ? '总分' : '答对'}</dt><dd>{duel ? score.score : score.correct}<small>{duel ? ' 分' : ' 题'}</small></dd></div><div><dt>已答</dt><dd>{score.answered}<small> 题</small></dd></div><div><dt>正确率</dt><dd>{percentage(score.accuracy)}</dd></div></dl>;
}

function QuestionPanel({ question, player, number, total, duel, index, onAnswer }: { question?: Question; player: Player; number: number; total: number; duel: boolean; index: number; onAnswer: (playerId: string, questionId: string, choiceId: string) => void }) {
  const answer = question && player.answers.find(a => a.questionId === question.id);
  const lastTouch = useRef(-Infinity);
  return <section className={`player-panel player-${index + 1}`} aria-label={`${player.name}作答`}>
    <div className="player-heading"><h2>{player.name}</h2><div className="question-metadata">{question && <span>{question.kind === 'single' ? '单选题' : '判断题'}</span>}<span>{duel ? question ? `第 ${number} 题` : `已答 ${player.answers.length} 题` : `第 ${number} / ${total} 题`}</span></div></div>
    {!duel && <progress value={player.answers.length} max={total} aria-label={`${player.name}答题进度`} />}
    {question ? <><h3 className="question-prompt">{question.prompt}</h3>
      {question.images.map((image, n) => <img className="question-image" src={image.url} alt={image.alt} key={`${image.url}-${n}`} />)}
      <div className="answer-options">{question.choices.map((choice, i) => <button type="button" key={choice.id} disabled={Boolean(answer)} className={`answer-option ${answer?.choiceId === choice.id ? 'chosen' : ''} ${answer && question.answerId === choice.id ? 'correct-answer' : ''}`} onPointerUp={event => { if (event.pointerType === 'touch') { event.preventDefault(); lastTouch.current = performance.now(); onAnswer(player.id, question.id, choice.id); } }} onClick={event => { if (event.detail && performance.now() - lastTouch.current < 750) return; onAnswer(player.id, question.id, choice.id); }}>
        <span className="choice-letter">{String.fromCharCode(65 + i)}.</span><span>{choice.text}{choice.image && <img className="choice-image" src={choice.image.url} alt={choice.image.alt} />}</span><kbd>{duel ? keys[index][i].toUpperCase() : i + 1}</kbd>
      </button>)}</div>
      {answer && !duel && <div className={`answer-feedback ${answer.choiceId === question.answerId ? 'right' : 'wrong'}`} role="status">
        <strong>{answer.choiceId === question.answerId ? <CheckCircle size={22} aria-hidden="true" /> : <XCircle size={22} aria-hidden="true" />}{answer.choiceId === question.answerId ? '答对了' : '再想一想'}</strong>
        <div className="feedback-answer">正确答案：<AnswerContent question={question} choiceId={question.answerId} /></div>
        <p>{question.explanation || '本题暂无解析。'}</p>
      </div>}
    </> : <div className="player-waiting"><h3>等待后续题目</h3><p>本局继续计时，已得分保留。</p></div>}
  </section>;
}

export function RoundScreen({ round, now, onAnswer, onEnd, continuation, onRetry }: { round: Round; now: number; onAnswer: (playerId: string, questionId: string, choiceId: string) => void; onEnd: () => void; continuation: Continuation; onRetry: () => void }) {
  const [singleIndex, setSingleIndex] = useState(0);
  const duel = round.mode === 'duel';
  const summary = summarizeRound(round);
  const currentAnswered = round.players[0].answers.length > singleIndex;
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || (event.target instanceof Element && event.target.closest('input,select,textarea,[contenteditable="true"],header,.round-controls'))) return;
      if (!duel && currentAnswered && event.key === 'Enter') { event.preventDefault(); setSingleIndex(i => i + 1); return; }
      round.players.forEach((player, p) => {
        const index = duel ? keys[p].indexOf(event.key.toLowerCase()) : ['1', '2', '3', '4'].indexOf(event.key);
        const question = round.questions[duel ? player.answers.length : singleIndex];
        if (index >= 0 && question?.choices[index] && (duel || !currentAnswered)) { event.preventDefault(); onAnswer(player.id, question.id, question.choices[index].id); }
      });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [round, duel, singleIndex, currentAnswered, onAnswer]);
  return <main className={`play-layout ${duel ? 'duel' : 'single'}`}>
    <div className="round-toolbar"><div><h1>{duel ? '同屏竞速' : '单人练习'}</h1><p>{duel ? '限时比总分。答对 +1，答错不扣分，同分平局。' : '认真思考，每次作答都是一次发现。'}</p></div><div className="round-controls">{round.deadline !== null && <div className={`timer ${round.deadline - now <= 10000 ? 'urgent' : ''}`} role="timer" aria-label="剩余时间">{clockText(round.deadline - now)}<small>剩余时间</small></div>}<button type="button" className="secondary-button" onClick={onEnd}>{duel ? '放弃本局' : '提前结束'}</button></div></div>
    {duel && <p className="landscape-hint">横屏体验更好，两侧都可以触控作答。</p>}
    {duel && continuation.status !== 'idle' && <div className={`continuation-status ${continuation.status === 'error' ? 'error-message' : ''}`} role={continuation.status === 'error' ? 'alert' : 'status'}><p>{continuation.message}</p>{continuation.status === 'error' && continuation.canRetry && <button className="secondary-button" onClick={onRetry} disabled={now < continuation.retryAt}>{now < continuation.retryAt ? `${Math.ceil((continuation.retryAt - now) / 1000)} 秒后可重试` : '重试加载新题'}</button>}</div>}
    <div className="players-grid">{round.players.map((player, i) => <div key={player.id} className={`player-column player-${i + 1}`}>
      <ScoreLine score={summary.players[i]} duel={duel} />
      <QuestionPanel question={round.questions[duel ? player.answers.length : singleIndex]} player={player} number={(duel ? player.answers.length : singleIndex) + 1} total={round.questions.length} duel={duel} index={i} onAnswer={onAnswer} />
      {!duel && currentAnswered && <button className="primary-button next-button" onClick={() => setSingleIndex(n => n + 1)}>下一题<ArrowRight size={20} aria-hidden="true" /></button>}
      <p className="keyboard-help">{duel ? i === 0 ? '左侧快捷键：A / S / D / F' : '右侧快捷键：J / K / L / ;' : '快捷键：1 / 2 / 3 / 4 选择答案'}</p>
    </div>)}</div>
  </main>;
}

export function Results({ round, saveMessage, onAgain, onSetup }: { round: Round; saveMessage: string; onAgain: () => void; onSetup: () => void }) {
  const summary = summarizeRound(round);
  const title = round.mode === 'single' ? '练习完成' : summary.winnerId ? `${summary.players.find(p => p.id === summary.winnerId)?.name} 获胜` : '本局平局';
  return <main className="results-layout"><div className="result-title"><Trophy size={40} weight="duotone" aria-hidden="true" /><h1>{title}</h1><p>{round.mode === 'duel' ? '限时竞速' : `共 ${summary.total} 题`} · 用时 {clockText((round.endedAt ?? round.startedAt) - round.startedAt)}</p></div>
    <div className={`result-scores ${round.mode}`}>{summary.players.map((player, i) => <section className={`result-player player-${i + 1}`} key={player.id}><h2>{player.name}</h2><ScoreLine score={player} duel={round.mode === 'duel'} /></section>)}</div>
    <p className="save-message" role="status">{saveMessage || '正在保存本机成绩…'}</p>
    <div className="result-actions"><button className="primary-button" onClick={onAgain}>再来一局<ArrowRight size={20} aria-hidden="true" /></button><button className="secondary-button" onClick={onSetup}>调整课时</button></div>
    <section className="review-sheet"><h2>回顾这一局</h2>{round.questions.filter(question => round.players.some(p => p.answers.some(a => a.questionId === question.id))).map((question, i) => <details key={question.id}><summary><span>第 {i + 1} 题</span>{question.prompt}</summary><div className="review-body">
      {question.images.map((image, n) => <img className="question-image" src={image.url} alt={image.alt} key={`${image.url}-${n}`} />)}
      <div className="review-answer"><strong>正确答案：</strong><AnswerContent question={question} choiceId={question.answerId} /></div>
      {round.players.map(player => {
        const answer = player.answers.find(a => a.questionId === question.id);
        return <div className="review-answer" key={player.id}>{player.name}：{answer ? <><AnswerContent question={question} choiceId={answer.choiceId} /><span>{answer.choiceId === question.answerId ? '（答对）' : '（答错）'}</span></> : '未作答'}</div>;
      })}
      <p>{question.explanation || '本题暂无解析。'}</p>
    </div></details>)}</section>
  </main>;
}

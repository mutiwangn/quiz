import { previewCatalog } from './catalog';
import { validateBatch } from '../../shared/contracts';
import type { BatchRequest, Question, QuestionBatch } from '../../shared/types';

const air = previewCatalog.units[0].lessons;
const breath = previewCatalog.units[1].lessons;
const sound = previewCatalog.units[2].lessons;
const rows: [string, string, string, string[], number, string][] = [
  ['air-1', air[0].id, '通常情况下，空气是什么颜色的？', ['无色', '蓝色', '白色'], 0, '通常的空气是无色、透明的。'],
  ['air-2', air[0].id, '我们可以用哪种方法感受空气的流动？', ['用扇子扇动', '看一块石头', '听闹钟响'], 0, '用扇子扇动可以感受到流动的空气。'],
  ['air-3', air[0].id, '空气存在于我们的周围。', ['正确', '错误'], 0, '我们周围的空间有空气，虽然通常看不见它。'],
  ['air-4', air[0].id, '怎样让瘪的气球鼓起来？', ['向里面吹气', '放在桌面上', '在上面画画'], 0, '吹入空气，气球就会鼓起来。'],
  ['air-5', air[0].id, '因为看不见空气，所以空气不存在。', ['正确', '错误'], 1, '空气存在于周围，可以通过吹气、扇风等方式感受它。'],
  ['space-1', air[1].id, '把一团纸塞进杯底，杯口竖直向下压入水中，纸不湿的主要原因是什么？', ['杯中的空气占据空间', '纸不会吸水', '杯底会发热'], 0, '杯中的空气占据空间，阻止水进入杯底。'],
  ['space-2', air[1].id, '空气能占据一定的空间。', ['正确', '错误'], 0, '气球充气后鼓起来等现象都可以说明空气占据空间。'],
  ['breath-1', breath[0].id, '人在安静时也需要呼吸。', ['正确', '错误'], 0, '人在安静时也要通过呼吸获取氧气。'],
  ['breath-2', breath[0].id, '食物进入身体后，需要经过什么过程才能被身体利用？', ['消化和吸收', '直接消失', '变成空气'], 0, '食物经过消化和吸收，为身体提供营养。'],
  ['sound-1', sound[0].id, '物体发声时通常在做什么？', ['振动', '静止', '融化'], 0, '声音由物体振动产生。'],
  ['sound-2', sound[0].id, '用手轻轻按住正在发声的音叉，声音会怎样？', ['减弱或停止', '一直变强', '完全不变'], 0, '按住音叉后，振动减弱或停止，声音也会减弱或停止。'],
];
// Original small fixtures for development interaction checks; not a teaching bank.
const questions: Question[] = rows.map(([id, lessonId, prompt, options, correct, explanation]) => ({
  id, lessonIds: [lessonId], prompt, kind: options.length === 2 ? 'boolean' : 'single', images: [],
  choices: options.map((text, i) => ({ id: String(i), text })), answerId: String(correct), explanation,
}));

export { previewCatalog };
export async function previewBatch(request: BatchRequest): Promise<QuestionBatch> {
  const matches = questions.filter(q => !request.excludeIds?.includes(q.id) && q.lessonIds.some(id => request.lessonIds.includes(id)) && request.kinds.includes(q.kind));
  if (matches.length < request.count) throw new Error(`所选范围只有 ${matches.length} 道开发样题，请减少题数或选择“感受空气”等预览课时。`);
  for (let i = matches.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [matches[i], matches[j]] = [matches[j], matches[i]]; }
  return validateBatch({ id: crypto.randomUUID(), catalogId: previewCatalog.id, questions: matches.slice(0, request.count), preparedAt: new Date().toISOString(), origin: 'preview' }, request, previewCatalog);
}

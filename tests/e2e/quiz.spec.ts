import { test, expect } from '@playwright/test';

test('跨单元保留选择，完成单人练习并保存本机成绩', async ({ page }) => {
  await page.goto('?preview=1');
  await expect(page.getByText('开发预览', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: '声音', exact: false }).click();
  await page.getByRole('checkbox', { name: '声音是怎样产生的', exact: false }).check();
  await page.getByRole('button', { name: '空气', exact: false }).click();
  await expect(page.getByRole('checkbox', { name: '感受空气', exact: false })).toBeChecked();
  await page.getByRole('main').getByRole('button', { name: '开始练习', exact: true }).click();
  await expect(page.getByRole('heading', { name: '准备好了', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '进入练习', exact: true }).click();
  for (let n = 0; n < 5; n++) {
    await page.getByRole('button', { name: /^A[.、\s]/ }).click();
    if (n < 4) await page.getByRole('button', { name: '下一题', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: '练习完成' })).toBeVisible();
  await page.getByRole('button', { name: '本机成绩', exact: true }).click();
  await expect(page.getByRole('heading', { name: '本机成绩', exact: true })).toBeVisible();
  await expect(page.getByText('已答 5 题', { exact: false }).first()).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '本机成绩', exact: true }).click();
  await expect(page.getByText('已答 5 题', { exact: false }).first()).toBeVisible();
});

test('双人用两组按键独立作答，同分平局', async ({ page }) => {
  await page.goto('?preview=1');
  await page.getByRole('button', { name: '双人竞速', exact: true }).click();
  await page.getByRole('button', { name: '准备对战', exact: true }).click();
  await page.getByRole('button', { name: '开始竞速', exact: true }).click();
  const left = page.getByRole('region', { name: '小蓝作答' });
  const right = page.getByRole('region', { name: '小橙作答' });
  await page.keyboard.press('a');
  await expect(left.getByText('第 2 / 5 题')).toBeVisible();
  await expect(right.getByText('第 1 / 5 题')).toBeVisible();
  await page.keyboard.press('j');
  for (let n = 1; n < 5; n++) { await page.keyboard.press('a'); await page.keyboard.press('j'); }
  await expect(page.getByRole('heading', { name: '本局平局' })).toBeVisible();
  await expect(page.getByText('已保存到本机成绩。')).toBeVisible();
});

test('iPad 横屏触控，双人各自提交不会影响另一侧进度', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173/quiz/?preview=1');
  await page.getByRole('button', { name: '双人竞速', exact: true }).tap();
  await page.getByRole('button', { name: '准备对战', exact: true }).tap();
  await page.getByRole('button', { name: '开始竞速', exact: true }).tap();
  const left = page.getByRole('region', { name: '小蓝作答' });
  const right = page.getByRole('region', { name: '小橙作答' });
  await left.getByRole('button', { name: /^A[.、\s]/ }).tap();
  await expect(left.getByText('第 2 / 5 题')).toBeVisible();
  await expect(right.getByText('第 1 / 5 题')).toBeVisible();
  await right.getByRole('button', { name: /^A[.、\s]/ }).tap();
  await expect(right.getByText('第 2 / 5 题')).toBeVisible();
  const leftBox = await left.getByRole('button', { name: /^A[.、\s]/ }).boundingBox();
  const rightBox = await right.getByRole('button', { name: /^A[.、\s]/ }).boundingBox();
  expect(leftBox).not.toBeNull(); expect(rightBox).not.toBeNull();
  if (!leftBox || !rightBox) throw new Error('Touch targets missing');
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
    { x: leftBox.x + leftBox.width / 2, y: leftBox.y + leftBox.height / 2, id: 1 },
    { x: rightBox.x + rightBox.width / 2, y: rightBox.y + rightBox.height / 2, id: 2 },
  ] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(left.getByText('第 3 / 5 题')).toBeVisible();
  await expect(right.getByText('第 3 / 5 题')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await context.close();
});

test('真实模式失败时保留范围，不用样题开局', async ({ page }) => {
  const { previewCatalog } = await import('../../src/preview/catalog');
  await page.route('**/api/catalog', route => route.fulfill({ json: { ...previewCatalog, origin: 'live' } }));
  await page.route('**/api/batches', route => route.fulfill({ status: 503, json: { error: { code: 'SOURCE_NOT_CONFIGURED', message: '题目暂时未准备好，请稍后重试。' } } }));
  await page.goto('./');
  await page.getByRole('checkbox', { name: '感受空气', exact: false }).check();
  await page.getByRole('main').getByRole('button', { name: '开始练习', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('题目暂时未准备好，请稍后重试。');
  await expect(page.getByRole('checkbox', { name: '感受空气', exact: false })).toBeChecked();
  await expect(page.getByRole('heading', { name: '准备好了' })).toHaveCount(0);
  await expect(page.getByText('开发预览', { exact: false })).toHaveCount(0);
});

test('图片选项与题干配图在答案反馈和结算回顾中保留', async ({ page }) => {
  const { previewCatalog } = await import('../../src/preview/catalog');
  const lesson = previewCatalog.units[0].lessons[0];
  const diagram = 'https://images.test/diagram.png';
  const option = 'https://images.test/option.png';
  await page.route('https://images.test/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jw1sAAAAASUVORK5CYII=', 'base64') }));
  await page.route('**/api/catalog', route => route.fulfill({ json: { ...previewCatalog, origin: 'live' } }));
  await page.route('**/api/batches', route => route.fulfill({ json: { id: 'image-batch', catalogId: previewCatalog.id, origin: 'live', preparedAt: '2026-11-09T00:00:00Z', questions: Array.from({ length: 5 }, (_, i) => ({
    id: `image-${i}`, lessonIds: [lesson.id], kind: 'single', prompt: `观察第 ${i + 1} 幅示意图，选择正确选项。`, images: [{ url: diagram, alt: '实验示意图' }], choices: [{ id: 'a', text: '', image: { url: option, alt: '气球图' } }, { id: 'b', text: '其他选项' }], answerId: 'a', explanation: '观察图中实验现象。',
  })) } }));
  await page.goto('./');
  await page.getByRole('checkbox', { name: '感受空气', exact: false }).check();
  await page.getByLabel('题目数量', { exact: true }).selectOption('5');
  await page.getByRole('main').getByRole('button', { name: '开始练习', exact: true }).click();
  await page.getByRole('button', { name: '进入练习', exact: true }).click();
  await page.getByRole('button', { name: /^A[.、\s]/ }).click();
  await expect(page.getByRole('status').getByRole('img', { name: '气球图' })).toBeVisible();
  for (let n = 1; n < 5; n++) { await page.getByRole('button', { name: '下一题', exact: true }).click(); await page.getByRole('button', { name: /^A[.、\s]/ }).click(); }
  await page.getByText('观察第 5 幅示意图，选择正确选项。', { exact: false }).click();
  const review = page.locator('details').last();
  await expect(review.getByRole('img', { name: '实验示意图' })).toBeVisible();
  await expect(review.getByRole('img', { name: '气球图' }).first()).toBeVisible();
  await expect(review.getByText('正确答案：A.', { exact: false })).toBeVisible();
});

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

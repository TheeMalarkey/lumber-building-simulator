import { test, expect, type Locator, type Page } from '@playwright/test';
import { openBuild, openWire } from './ui-helpers';

const woodColors = [
  ['oak', '#cc8e69'], ['elm', '#eab892'], ['birch', '#cdcdcd'], ['walnut', '#694028'],
  ['cherry', '#a34b4b'], ['koa', '#8f4c2a'], ['fir', '#d7c59a'], ['pine', '#d7c59a'],
  ['palm', '#e2dcbc'], ['volcano', '#ff0000'], ['gold', '#e29b40'], ['zombie', '#348e40'],
  ['cavecrawler', '#102adc'], ['frost', '#9ff3e9'], ['phantom', '#f8f8f8'],
  ['snowglow', '#ffff00'], ['blue-spruce', '#9fadc0'], ['spooky', '#aa5500'],
  ['sinister', '#aa5500'], ['sign', '#eab892'],
] as const;
const neonColors = [
  ['white', '#f8f8f8'], ['red', '#ff0000'], ['orange', '#d5733d'], ['yellow', '#ffff00'],
  ['green', '#00ff00'], ['cyan', '#00ffff'], ['blue', '#0000ff'], ['violet', '#7b007b'],
  ['pink', '#ff00bf'],
] as const;

const rgb = (hex: string) => `rgb(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
function luminance(css: string) {
  const channels = css.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => {
    const s = v / 255;
    return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
  });
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
async function expectColor(button: Locator, hex: string) {
  await expect(button).toHaveCSS('background-color', rgb(hex));
  await expect(button).toHaveCSS('background-image', 'none');
  const colors = await button.evaluate(el => ({
    background: getComputedStyle(el).backgroundColor,
    icon: getComputedStyle(el.querySelector('svg')!).color,
  }));
  const [a, b] = [luminance(colors.background), luminance(colors.icon)].sort((x, y) => y - x);
  expect((a + .05) / (b + .05), 'palette icon contrast').toBeGreaterThanOrEqual(4.5);
}
async function setup(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).timber);
  await page.evaluate(() => {
    const e = (window as any).timber.editor;
    e.world.load([], [12]);
    e.pickSelection(null);
    e.view.sync(true);
  });
}
async function expectMixed(button: Locator, colors: string[]) {
  await expect.poll(() => button.evaluate(el => getComputedStyle(el).backgroundImage)).toContain('gradient(');
  const background = await button.evaluate(el => getComputedStyle(el).backgroundImage);
  for (const color of colors) expect(background).toContain(rgb(color));
  await button.hover();
  expect(await button.evaluate(el => getComputedStyle(el).backgroundImage)).toBe(background);
  await button.click();
  expect(await button.evaluate(el => getComputedStyle(el).backgroundImage)).toBe(background);
}

test('blueprint palette trigger follows every finish and keeps its color when hovered or open', async ({ page }) => {
  await setup(page);
  await openBuild(page);
  await page.locator('[data-category="All pieces"]').click();
  await page.locator('[data-item="smooth-wall"]').click();
  await page.locator('#collapse').click();
  const button = page.locator('#wood-toggle');
  await expectColor(button, '#cc8e69');
  for (const [id, color] of woodColors) {
    await button.click();
    await page.locator(`[data-wood="${id}"]`).click();
    await expectColor(button, color);
    await button.hover();
    await expectColor(button, color);
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expectColor(button, color);
    await button.click();
  }
});

test('wood selection shows mixed finishes and updates the trigger through recolor and undo', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const e = (window as any).timber.editor;
    e.world.load([
      { id: 'oak', item: 'small-floor', wood: 'oak', position: [-4, .5, 0], rotation: [0, 0, 0] },
      { id: 'walnut', item: 'small-floor', wood: 'walnut', position: [4, .5, 0], rotation: [0, 0, 0] },
      { id: 'glass', item: 'glass-pane', wood: 'oak', position: [0, 2, 5], rotation: [0, 0, 0] },
    ], [12]);
    e.pickSelections(['oak', 'walnut', 'glass']);
  });
  const button = page.locator('#wood-toggle');
  await expect(button).toHaveAttribute('aria-label', 'Wood finish: Mixed woods');
  await expectMixed(button, ['#cc8e69', '#694028']);
  await page.locator('[data-wood="birch"]').click();
  await expectColor(button, '#cdcdcd');
  expect(await page.evaluate(() => {
    const pieces = (window as any).timber.editor.world.pieces;
    return { oak: pieces.get('oak').wood, walnut: pieces.get('walnut').wood, glass: pieces.get('glass').wood };
  })).toEqual({ oak: 'birch', walnut: 'birch', glass: 'oak' });
  await page.locator('#undo').click();
  await expect(button).toHaveAttribute('aria-label', 'Wood finish: Mixed woods');
  await expectMixed(button, ['#cc8e69', '#694028']);
  await button.click();
  await page.evaluate(() => (window as any).timber.editor.pickSelections(['walnut', 'glass']));
  await expect(button).toHaveAttribute('aria-label', 'Wood finish: Walnut');
  await expectColor(button, '#694028');
});

test('neon palette trigger follows every color and keeps readable icons when hovered or open', async ({ page }) => {
  await setup(page);
  await openWire(page, 'neon');
  await page.locator('#collapse').click();
  const button = page.locator('#wire-color-toggle');
  await expectColor(button, '#f8f8f8');
  for (const [id, color] of neonColors) {
    await button.click();
    await page.locator(`[data-wire-color="${id}"]`).click();
    await expectColor(button, color);
    await button.hover();
    await expectColor(button, color);
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expectColor(button, color);
    await button.click();
  }
});

test('neon selection shows mixed colors and updates the trigger through recolor and undo', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const e = (window as any).timber.editor;
    e.world.load([], [12], [
      { id: 'cyan', kind: 'neon', color: 'cyan', from: { point: [-4, .155, -3] }, to: { point: [4, .155, -3] }, points: [] },
      { id: 'blue', kind: 'neon', color: 'blue', from: { point: [-4, .155, 0] }, to: { point: [4, .155, 0] }, points: [] },
      { id: 'wire', kind: 'wire', from: { point: [-4, .145, 3] }, to: { point: [4, .145, 3] }, points: [] },
    ]);
    e.logicTools.tick();
    e.pickSelections([], ['cyan', 'blue', 'wire']);
  });
  const button = page.locator('#wire-color-toggle');
  await expect(button).toHaveAttribute('aria-label', 'Neon color: Mixed colors');
  await expectMixed(button, ['#00ffff', '#0000ff']);
  await page.locator('[data-wire-color="red"]').click();
  await expectColor(button, '#ff0000');
  expect(await page.evaluate(() => (window as any).timber.editor.world.wires.map((w: any) => w.color ?? null)))
    .toEqual(['red', 'red', null]);
  await page.locator('#undo').click();
  await expect(button).toHaveAttribute('aria-label', 'Neon color: Mixed colors');
  await expectMixed(button, ['#00ffff', '#0000ff']);
  await button.click();
  await page.evaluate(() => (window as any).timber.editor.pickSelections([], ['blue', 'wire']));
  await expect(button).toHaveAttribute('aria-label', 'Neon color: Blue');
  await expectColor(button, '#0000ff');
});

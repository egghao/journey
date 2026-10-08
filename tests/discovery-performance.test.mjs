import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const place = (id, image) => ({ id, image, name: id, english: id, country: 'Country', countryEnglish: 'Country', source: `https://example.test/${id}`, photographer: 'Author', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' });
const flush = () => new Promise(resolve => setImmediate(resolve));

function harness(remoteCount = 1, { ready = false, reducedMotion = true, remoteDelay = null } = {}) {
  let now = 0, nextTimer = 0;
  const timers = new Map(), elements = new Map();
  const setTimer = (fn, delay = 0) => { const id = ++nextTimer; timers.set(id, { fn, at: now + delay }); return id; };
  const element = id => {
    if (!elements.has(id)) elements.set(id, { textContent: '', hidden: false, style: {}, listeners: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, removeAttribute() {}, addEventListener(name, fn) { this.listeners[name] = fn; } });
    return elements.get(id);
  };
  class FakeImage {
    set src(url) {
      if (url && (ready || url.includes('start.webp'))) setTimer(() => this.onload?.(), 0);
      else if (url && remoteDelay !== null) setTimer(() => this.onload?.(), remoteDelay);
    }
    decode() { return Promise.resolve(); }
  }
  const seed = place('seed', 'images/start.webp');
  const context = {
    window: { JOURNEY_DESTINATIONS: [seed], location: { href: 'https://example.test/journey/' }, matchMedia: () => ({ matches: reducedMotion }), addEventListener() {} },
    document: { getElementById: element, addEventListener() {} },
    fetch: async () => ({ ok: true, json: async () => [seed, ...Array.from({ length: remoteCount }, (_, i) => place(`remote-${i}`, `https://example.test/hanging-${i}.jpg`))] }),
    Image: FakeImage, URL, AbortController, setTimeout: setTimer, clearTimeout: id => timers.delete(id),
  };
  for (const file of ['discovery-core.js', 'app.js']) vm.runInNewContext(fs.readFileSync(new URL(`../dist/${file}`, import.meta.url), 'utf8'), context);
  return {
    element,
    get now() { return now; },
    async advance(ms) {
      const target = now + ms;
      await flush();
      for (;;) {
        const due = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        now = due[1].at;
        timers.delete(due[0]);
        due[1].fn();
        await flush();
      }
      now = target;
      await flush();
    },
  };
}

for (const count of [1, 4]) test(`${count} hanging photos cannot lock the discover button for more than three seconds`, async () => {
  const page = harness(count);
  await page.advance(0);
  assert.equal(page.element('shuffle-button').disabled, false);
  const priorName = page.element('destination-name').textContent;
  let finishedAt;
  const request = page.element('shuffle-button').listeners.click().then(() => { finishedAt = page.now; });
  await page.advance(40000);
  await request;
  assert.equal(page.element('destination-name').textContent, priorName);
  assert.equal(page.element('shuffle-button').disabled, false);
  assert(finishedAt <= 3000, `button remained locked for ${finishedAt} ms`);
});

test('a photo arriving after the click deadline stays ready for the next click', async () => {
  const page = harness(4, { remoteDelay: 4500 });
  await page.advance(0);
  const priorName = page.element('destination-name').textContent;
  const first = page.element('shuffle-button').listeners.click();
  await page.advance(3000);
  await first;
  assert.equal(page.element('destination-name').textContent, priorName);
  assert.equal(page.element('shuffle-button').disabled, false);
  await page.advance(1500);
  assert.equal(page.element('destination-name').textContent, priorName);
  const second = page.element('shuffle-button').listeners.click();
  await page.advance(0);
  await second;
  assert.notEqual(page.element('destination-name').textContent, priorName);
  assert.equal(page.element('status').textContent, '');
});

test('a ready photo unlocks immediately even when CSS motion is enabled', async () => {
  const page = harness(4, { ready: true, reducedMotion: false });
  await page.advance(1000);
  const start = page.now;
  let finishedAt;
  const request = page.element('shuffle-button').listeners.click().then(() => { finishedAt = page.now; });
  await page.advance(1000);
  await request;
  assert(finishedAt - start <= 50, `a cached photo waited ${finishedAt - start} ms`);
});

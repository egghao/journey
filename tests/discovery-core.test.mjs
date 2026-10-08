import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/discovery-core.js';

const { DestinationDeck, PhotoLoader, PhotoQueue } = globalThis.JourneyDiscovery;
const place = (id) => ({id:String(id),name:`Place ${id}`,english:`Place ${id}`,country:'Country',countryEnglish:'Country',image:`https://example.test/${id}.jpg`,source:`https://example.test/source/${id}`,photographer:'Author',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/'});
const seededRandom = () => { let value = 42; return () => ((value = (1664525 * value + 1013904223) >>> 0) / 4294967296); };

test('a thousand destinations remain unique within each round and never repeat at the boundary', () => {
  const deck = new DestinationDeck(Array.from({length:1200}, (_,i)=>place(i)), seededRandom());
  let current;
  for (let round = 0; round < 3; round++) {
    const seen = new Set();
    for (let i = 0; i < 1200; i++) {
      const next = deck.next(current);
      assert.notEqual(next.id, current);
      assert(!seen.has(next.id));
      seen.add(next.id);
      current = next.id;
    }
    assert.equal(seen.size, 1200);
  }
});

test('adding the catalog after first paint preserves the current round and deduplicates identifiers', () => {
  const deck = new DestinationDeck(Array.from({length:10}, (_,i)=>place(i)), seededRandom());
  const seen = new Set();
  let current;
  for (let i=0;i<5;i++) { current=deck.next(current).id; seen.add(current); }
  deck.add(Array.from({length:1200}, (_,i)=>place(i)));
  assert.equal(deck.size,1200);
  for (let i=5;i<1200;i++) {
    current=deck.next(current).id;
    assert(!seen.has(current));
    seen.add(current);
  }
  assert.equal(seen.size,1200);
});

test('image requests coalesce, the cache stays bounded, and a failed request can retry', async () => {
  let created=0, fail=true;
  const loader = new PhotoLoader({capacity:4,createImage:()=>{
    created++;
    return {decode:async()=>{},set src(url){ if (!url) return; queueMicrotask(()=>url.includes('failure')&&fail?this.onerror?.():this.onload?.()); }};
  }});
  const sameA=loader.load('first'), sameB=loader.load('first');
  assert.equal(sameA,sameB);
  await sameA;
  assert.equal(created,1);
  for(let i=0;i<100;i++) await loader.load(`image-${i}`);
  assert.equal(loader.cache.size,4);
  await assert.rejects(loader.load('failure'));
  assert(!loader.cache.has('failure'));
  fail=false;
  assert.equal(await loader.load('failure'),'failure');
});

test('a timed-out image is cancelled and removed from the cache', async () => {
  let cancelled=false;
  const loader = new PhotoLoader({timeoutMs:10,createImage:()=>({set src(url){if(url==='')cancelled=true;}})});
  await assert.rejects(loader.load('hanging-image'),/逾時/);
  assert.equal(cancelled,true);
  assert.equal(loader.cache.size,0);
});

test('a ready lookahead photo bypasses a stalled candidate without consuming it', async () => {
  const deck = new DestinationDeck([place(1), place(2), place(3)], () => 0.99);
  const queue = new PhotoQueue(deck, item => item.id === '3' ? new Promise(() => {}) : Promise.resolve(item.image));
  queue.prepare(null);
  assert.equal(deck.visited.size, 0);
  const selected = await queue.next(null);
  assert.equal(selected.place.id, '2');
  assert.equal(deck.visited.size, 1);
  assert(deck.bag.includes('3'));
  assert.equal(queue.entries.filter(entry => entry.state === 'pending').length, 1);
});

test('lookahead selection preserves all destinations and adjacent-repeat protection across rounds', async () => {
  const deck = new DestinationDeck(Array.from({length:1200}, (_,i)=>place(i)), seededRandom());
  const queue = new PhotoQueue(deck, item => Promise.resolve(item.image));
  let current;
  for (let round = 0; round < 2; round++) {
    const seen = new Set();
    for (let i = 0; i < 1200; i++) {
      const selected = await queue.next(current);
      assert.notEqual(selected.place.id, current);
      assert(!seen.has(selected.place.id));
      seen.add(selected.place.id);
      current = selected.place.id;
      queue.prepare(current);
      assert(queue.entries.length <= 3);
    }
    assert.equal(seen.size, 1200);
  }
});

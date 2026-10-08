import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../dist/discovery-core.js';

const catalog=JSON.parse(fs.readFileSync(new URL('../dist/catalog.json',import.meta.url),'utf8'));
const meta=JSON.parse(fs.readFileSync(new URL('../dist/catalog-meta.json',import.meta.url),'utf8'));

test('the actual catalog has over a thousand distinct destinations and photographed sources', () => {
  assert(catalog.length>=1000);
  assert.equal(catalog.length,meta.count);
  assert.equal(new Set(catalog.map(place=>place.id)).size,catalog.length);
  assert.equal(new Set(catalog.map(place=>decodeURIComponent(new URL(place.source).pathname).replace(/ /g,'_'))).size,catalog.length);
  for(const place of catalog) {
    for(const key of ['name','english','country','countryEnglish','image','source','photographer','license','licenseUrl']) assert(place[key],`${place.id} is missing ${key}`);
    assert.equal(new URL(place.source).hostname,'commons.wikimedia.org');
    if(place.image.startsWith('images/')) assert(fs.existsSync(new URL(`../dist/${place.image}`,import.meta.url)));
    else assert(['thumb.wikimedia.org','upload.wikimedia.org'].includes(new URL(place.image).hostname));
  }
});

test('the actual catalog can be explored for two complete rounds without repetition', () => {
  const deck=new globalThis.JourneyDiscovery.DestinationDeck(catalog);
  let current;
  for(let round=0;round<2;round++) {
    const seen=new Set();
    for(let i=0;i<catalog.length;i++) {
      const place=deck.next(current);
      assert.notEqual(place.id,current);
      assert(!seen.has(place.id));
      current=place.id;
      seen.add(place.id);
    }
    assert.equal(seen.size,catalog.length);
  }
});

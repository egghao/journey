import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = path.resolve(process.argv[2] || path.join(site, '../asset-research/expanded/destinations.json'));
const source = JSON.parse(fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, ''));
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(site, 'dist/destinations.js'), 'utf8'), context);
const seeds = JSON.parse(JSON.stringify(context.window.JOURNEY_DESTINATIONS));
const normalize = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const sourceKey = value => decodeURIComponent(new URL(value).pathname).replace(/ /g,'_').normalize('NFC');
const countryKey = value => normalize(value) === 'turkiye' ? 'turkey' : normalize(value);
const records = [], ids = new Set(), photos = new Set();
const thoughts = ['有些風景，值得親自站在它面前。','下一段回憶，也許就從這裡開始。','先把這個地方，放進下一次的想像。','還不用決定出發的日子。先有一個期待。','世界的另一面，也許正等著你。'];
let rejected = 0;

for (const place of source) {
  if (/(concentration camp|extermination camp|internment camp|massacre|cemetery|graveyard|war memorial|prison|battlefield|集中營|集中营|監獄|监狱|屠殺|屠杀|墓地|陵園|陵园)/i.test(`${place.name} ${place.nameEn}`)) { rejected++; continue; }
  if (/\b(swim|marathon|relay|parade|demonstration|concert|inauguration|portrait|montage)\b/i.test((place.fileName || '').replace(/[_-]/g,' '))) { rejected++; continue; }
  const image = new URL(place.image);
  const photoKey = sourceKey(place.source);
  const english = place.nameEn || place.english;
  const countryEnglish = place.countryEn || place.countryEnglish;
  if (!/^Q\d+$/.test(place.id) || ids.has(place.id) || photos.has(photoKey) || !english || !place.name || !countryEnglish || /^Q\d+$/.test(countryEnglish) || !place.country || !place.photographer || !place.licenseUrl || !/^(CC BY|CC0|Public domain|PD\b)/i.test(place.license) || !['thumb.wikimedia.org','upload.wikimedia.org'].includes(image.hostname) || image.protocol !== 'https:' || new URL(place.source).hostname !== 'commons.wikimedia.org' || !Number.isFinite(place.originalWidth) || !Number.isFinite(place.originalHeight) || place.originalWidth < 1280 || place.originalHeight < 650 || place.originalWidth / place.originalHeight < 1.15 || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude) || Math.abs(place.latitude) > 90 || Math.abs(place.longitude) > 180 || /\.(svg|pdf|gif|webm)(\?|$)/i.test(place.image)) {
    rejected++;
    continue;
  }
  ids.add(place.id);
  photos.add(photoKey);
  records.push({ id:place.id,name:place.name,english,country:place.country,countryEnglish,image:place.image,alt:`${place.country}，${place.name}的景色。`,thought:thoughts[Number(place.id.slice(1)) % thoughts.length],source:place.source,photographer:place.photographer,license:place.license,licenseUrl:place.licenseUrl,wikidataUrl:place.wikidataUrl,latitude:place.latitude,longitude:place.longitude,category:place.category });
}

const seedMappings = [];
for (const seed of seeds) {
  const match = records.find(record => sourceKey(record.source) === sourceKey(seed.source)) || records.find(record => normalize(record.english) === normalize(seed.english.split(',')[0]) && countryKey(record.countryEnglish) === countryKey(seed.countryEnglish));
  seed.id = match?.id || `local-${path.basename(seed.image, '.webp')}`;
  if (match) {
    seedMappings.push({ local:seed.name, matched:match.name, id:match.id });
    Object.assign(match, seed);
  } else records.push(seed);
}

if (records.length < 1000) throw new Error(`Only ${records.length} qualified destinations; at least 1000 required.`);
const countries = [...new Map(records.map(record => [countryKey(record.countryEnglish),record.countryEnglish])).values()].sort();
const provenancePath = path.join(path.dirname(input),'provenance.json');
const provenance = fs.existsSync(provenancePath) ? JSON.parse(fs.readFileSync(provenancePath,'utf8').replace(/^\uFEFF/,'')) : {};
const importedIds = new Set(records.filter(record=>record.id.startsWith('Q')).map(record=>record.id));
const hdPhotoCount = source.filter(record=>importedIds.has(record.id) && record.imageWidth >= 1920).length;
const meta = {count:records.length,countryCount:countries.length,countries,importedCount:importedIds.size,localCount:seeds.length,importedPhotosAtLeast1920px:hdPhotoCount,source:'Wikidata and Wikimedia Commons',sources:['https://www.wikidata.org/wiki/Wikidata:Data_access','https://www.mediawiki.org/wiki/API:Imageinfo'],photography:'Official subject photographs, original width at least 1280px; landscape aspect ratio at least 1.15. Wikimedia API supplies image URLs, authors and licenses.',review:'Metadata and automated quality checks. Images are not individually editorially reviewed.',provenance};
fs.writeFileSync(path.join(site,'dist/catalog.json'), JSON.stringify(records));
fs.writeFileSync(path.join(site,'dist/catalog-meta.json'), JSON.stringify(meta,null,2)+'\n');
fs.writeFileSync(path.join(site,'dist/destinations.js'), 'window.JOURNEY_DESTINATIONS = '+JSON.stringify(seeds,null,2)+';\n');
fs.writeFileSync(path.join(site,'dist/image-credits.json'), JSON.stringify(records.map(record=>({image:record.image,source:record.source,photographer:record.photographer,license:record.license,licenseUrl:record.licenseUrl,changes:'Resized thumbnails and responsive display cropping.'})),null,2)+'\n');
console.log(JSON.stringify({count:records.length,countries:countries.length,rejected,seedMappings,catalogBytes:fs.statSync(path.join(site,'dist/catalog.json')).size}));

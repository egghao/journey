import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../dist/discovery-core.js';

test('a large catalog with failed images stops after four attempts and preserves the visible destination', async () => {
  const records = Array.from({length:1200}, (_,i)=>({id:`Q${i+1}`,name:`Place ${i}`,english:`Place ${i}`,country:'Country',countryEnglish:'Country',image:`https://example.test/${i}.jpg`,source:`https://example.test/source/${i}`,photographer:'Author',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/'}));
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id,{id,textContent:'',hidden:false,style:{},attributes:{},listeners:{},classList:{add(){},remove(){},toggle(){}},setAttribute(name,value){this.attributes[name]=value;},removeAttribute(name){delete this.attributes[name];},addEventListener(name,callback){this.listeners[name]=callback;}});
    return elements.get(id);
  };
  let loads=0;
  class FakeLoader { load(url){ loads++; return loads===1?Promise.resolve(url):Promise.reject(new Error('Unavailable')); } }
  const context = {
    window:{JOURNEY_DESTINATIONS:records.slice(0,10),JourneyDiscovery:{...globalThis.JourneyDiscovery,PhotoLoader:FakeLoader},location:{href:'http://127.0.0.1:4173/'},matchMedia:()=>({matches:true}),addEventListener(){}},
    document:{getElementById:element,addEventListener(){}},
    URL,AbortController,setTimeout,clearTimeout,
    fetch:async()=>({ok:true,json:async()=>records})
  };
  vm.runInNewContext(fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  const priorImage=element('photo-a').src;
  const priorName=element('destination-name').textContent;
  const priorLoads=loads;
  assert.match(element('catalog-note').textContent,/1,200/);
  await element('shuffle-button').listeners.click();
  assert.equal(loads-priorLoads,4);
  assert.equal(element('photo-a').src,priorImage);
  assert.equal(element('destination-name').textContent,priorName);
  assert.equal(element('shuffle-button').disabled,false);
  assert.match(element('status').textContent,/暫時載入不了/);
});

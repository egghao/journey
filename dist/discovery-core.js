(function (root) {
  'use strict';

  function shuffled(values, random = Math.random) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  class DestinationDeck {
    constructor(places = [], random = Math.random) {
      this.random = random;
      this.records = new Map();
      this.visited = new Set();
      this.bag = [];
      this.add(places);
    }
    get size() { return this.records.size; }
    key(place) { return place.id || place.source; }
    add(places) {
      if (!Array.isArray(places)) throw new TypeError('Expected a destination array.');
      for (const place of places) {
        if (!place || !['name', 'english', 'country', 'countryEnglish', 'image', 'source', 'photographer', 'license', 'licenseUrl'].every(field => typeof place[field] === 'string' && place[field].trim())) continue;
        this.records.set(this.key(place), place);
      }
      // Keep the current round's history when the larger catalog arrives.
      this.bag = shuffled([...this.records.keys()].filter(key => !this.visited.has(key)), this.random);
    }
    peek(currentKey, count = 1) {
      if (!this.records.size) return [];
      if (!this.bag.length) {
        this.visited.clear();
        this.bag = shuffled([...this.records.keys()], this.random);
      }
      const last = this.bag.length - 1;
      if (this.bag[last] === currentKey && this.bag.length > 1) {
        [this.bag[0], this.bag[last]] = [this.bag[last], this.bag[0]];
      }
      return this.bag.slice(-count).reverse().map(key => this.records.get(key));
    }
    take(key) {
      const index = this.bag.indexOf(key);
      if (index < 0) return null;
      this.bag.splice(index, 1);
      this.visited.add(key);
      return this.records.get(key);
    }
    next(currentKey) {
      const place = this.peek(currentKey)[0];
      return place ? this.take(this.key(place)) : null;
    }
  }

  class PhotoQueue {
    constructor(deck, load, { capacity = 3, waitMs = 3000 } = {}) {
      this.deck = deck;
      this.load = load;
      this.capacity = capacity;
      this.waitMs = waitMs;
      this.entries = [];
    }
    prepare(currentKey) {
      // Reserving a photo does not consume its place in the shuffled round.
      this.entries = this.entries.filter(entry => {
        if (entry.state === 'failed') { this.deck.take(entry.key); return false; }
        return this.deck.bag.includes(entry.key);
      });
      const places = this.deck.peek(currentKey, this.capacity);
      for (const place of places) {
        const key = this.deck.key(place);
        if (this.entries.length >= this.capacity) break;
        if (this.entries.some(entry => entry.key === key)) continue;
        const entry = { key, place, state: 'pending' };
        entry.promise = Promise.resolve().then(() => this.load(place)).then(
          url => { entry.url = url; entry.state = 'ready'; },
          () => { entry.state = 'failed'; }
        );
        this.entries.push(entry);
      }
    }
    async next(currentKey) {
      this.prepare(currentKey);
      let timer;
      const deadline = new Promise(resolve => { timer = setTimeout(() => resolve('timeout'), this.waitMs); });
      try {
        for (;;) {
          const ready = this.entries.find(entry => entry.state === 'ready');
          if (ready) {
            this.entries.splice(this.entries.indexOf(ready), 1);
            this.deck.take(ready.key);
            return { place: ready.place, url: ready.url };
          }
          const pending = this.entries.filter(entry => entry.state === 'pending');
          if (!pending.length) return null;
          if (await Promise.race([deadline, ...pending.map(entry => entry.promise)]) === 'timeout') return null;
        }
      } finally { clearTimeout(timer); }
      // Slow requests remain in the bounded queue for a later click.
    }
  }

  class PhotoLoader {
    constructor({ createImage = () => new Image(), timeoutMs = 9000, capacity = 4 } = {}) {
      this.createImage = createImage;
      this.timeoutMs = timeoutMs;
      this.capacity = capacity;
      this.cache = new Map();
    }
    load(url) {
      if (this.cache.has(url)) {
        const cached = this.cache.get(url);
        this.cache.delete(url);
        this.cache.set(url, cached);
        return cached;
      }
      const image = this.createImage();
      const promise = new Promise((resolve, reject) => {
        let settled = false;
        const finish = (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          image.onload = null;
          image.onerror = null;
          if (error) { image.src = ''; reject(error); }
          else resolve(url);
        };
        const timer = setTimeout(() => finish(new Error('圖片載入逾時')), this.timeoutMs);
        image.onload = async () => {
          try { if (image.decode) await image.decode(); } catch { /* A successful load remains usable. */ }
          finish();
        };
        image.onerror = () => finish(new Error('圖片暫時無法載入'));
        image.src = url;
      });
      this.cache.set(url, promise);
      while (this.cache.size > this.capacity) this.cache.delete(this.cache.keys().next().value);
      promise.catch(() => { if (this.cache.get(url) === promise) this.cache.delete(url); });
      return promise;
    }
  }

  root.JourneyDiscovery = { DestinationDeck, PhotoLoader, PhotoQueue };
})(typeof window === 'undefined' ? globalThis : window);

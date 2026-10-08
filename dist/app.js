(() => {
  'use strict';
  const { DestinationDeck, PhotoLoader, PhotoQueue } = window.JourneyDiscovery;
  const deck = new DestinationDeck(window.JOURNEY_DESTINATIONS || []);
  const loader = new PhotoLoader({ capacity: 4, timeoutMs: 9000 });
  const $ = (id) => document.getElementById(id);
  const button = $('shuffle-button');
  const photos = [$('photo-a'), $('photo-b')];
  let current = null, activePhoto = 0, busy = false, visits = 0;

  function imageUrl(place) {
    return new URL(place.image, window.location.href).href;
  }

  const loadImage = (place) => loader.load(imageUrl(place));
  const queue = new PhotoQueue(deck, loadImage);

  async function loadCatalog() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('catalog.json', { signal: controller.signal });
      if (!response.ok) throw new Error('目的地庫無法載入');
      const catalog = await response.json();
      if (!Array.isArray(catalog) || !catalog.length) throw new Error('目的地庫無效');
      deck.add(catalog);
      if (current !== null) queue.prepare(current);
      $('catalog-note').textContent = `全球 ${deck.size.toLocaleString('zh-TW')} 個地方，等你偶然抵達。`;
    } catch {
      $('catalog-note').textContent = '更多目的地暫時無法載入，先遇見已準備好的風景。';
    } finally { clearTimeout(timer); }
  }

  function setBusy(value) {
    busy = value;
    button.disabled = value;
    button.classList.toggle('is-loading', value);
    $('landscape').setAttribute('aria-busy', String(value));
    $('button-label').textContent = value ? '讓下一站慢慢浮現…' : '再遇見一個地方';
  }

  async function discover() {
    if (busy) return { busy: true };
    if (!deck.size) {
      $('status').textContent = '目的地暫時無法載入，請重新整理後再試一次。';
      $('initial-loading').hidden = true;
      return { error: 'no_destinations' };
    }
    setBusy(true);
    $('status').textContent = '';
    let result;
    try {
      const candidate = await queue.next(current);
      if (candidate) {
        const { place, url } = candidate;
        const key = deck.key(place);
        const nextPhoto = current === null ? activePhoto : 1 - activePhoto;
        photos[nextPhoto].src = url;
        photos[nextPhoto].alt = place.alt || `${place.country}，${place.name}的景色。`;
        photos[nextPhoto].style.objectPosition = place.position || 'center';
        photos[nextPhoto].removeAttribute('aria-hidden');
        photos[nextPhoto].classList.add('is-active');
        if (nextPhoto !== activePhoto) {
          photos[activePhoto].classList.remove('is-active');
          photos[activePhoto].setAttribute('aria-hidden', 'true');
        }
        activePhoto = nextPhoto;
        current = key;
        visits += 1;
        $('initial-loading').hidden = true;
        $('destination-name').textContent = place.name;
        $('destination').classList.toggle('has-long-name', place.name.length > 28);
        $('destination-location').textContent = place.name === place.english ? place.country : `${place.country} · ${place.english}`;
        $('destination-thought').textContent = place.thought || '也許，下一次的期待就從這裡開始。';
        $('photo-country').textContent = place.countryEnglish.toUpperCase();
        $('photo-number').textContent = `NO. ${String(visits).padStart(2, '0')}`;
        $('photo-credit').textContent = `Photo: ${place.photographer}（已縮放與裁切）`;
        $('photo-credit').title = $('photo-credit').textContent;
        $('photo-credit').href = place.source;
        $('photo-credit').hidden = false;
        $('photo-license').href = place.licenseUrl;
        $('photo-license').textContent = place.license;
        $('photo-license').hidden = false;
        result = { destination: place.name, country: place.country, image: url, encounter: visits };
        // CSS handles the crossfade without keeping the action locked.
        queue.prepare(current);
      }
      if (!result) {
        $('initial-loading').hidden = true;
        $('status').textContent = '風景暫時載入不了，還在準備中。稍後再試一次。';
        result = { error: 'images_unavailable' };
      }
    } finally {
      setBusy(false);
    }
    if (result.error) $('button-label').textContent = '再試一次';
    return result;
  }

  button.addEventListener('click', discover);
  document.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest('button, a, input, textarea, select, [contenteditable]')) return;
    event.preventDefault();
    discover();
  });

  // Use exactly the same action for supported browser agents and visitors.
  const context = document.modelContext;
  if (context?.registerTool) {
    const lifecycle = new AbortController();
    try {
      Promise.resolve(context.registerTool({
        name: 'discover_random_destination',
        title: '隨機遇見旅行目的地',
        description: 'Display a random scenic destination photo and its location, using the visible discover button action.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) {
            throw new Error('Expected an empty object.');
          }
          return discover();
        }
      }, { signal: lifecycle.signal })).catch(() => {});
      window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
    } catch { /* Browsers without the proposed API keep the normal interface. */ }
  }
  discover();
  loadCatalog();
})();

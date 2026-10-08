# 捷旅 Journey

A minimal Traditional Chinese travel inspiration website. A scenic photograph and one random destination appear immediately. The visitor can discover another place with one button or the Space key.

The gallery has 1,371 distinct destinations across 158 countries and territories: the original 10 local photographs plus 1,361 additional heritage sites and national parks. Each shuffled round visits every destination once and avoids adjacent repeats across rounds. Loading the larger catalog preserves the current round's history. Up to three upcoming photos load in parallel; the next action selects a ready photograph without waiting for a slower candidate. Reserving a photo does not mark its destination visited. The photo cache holds at most four requests. Each discovery action waits at most three seconds, retaining the previous view and pending photos on slow networks. Failed photographs are skipped. CSS crossfades do not delay the button. The page supports mobile layouts, keyboard navigation, reduced motion, and optional browser WebMCP discovery.

## Local preview

Run `node preview.mjs`, then open `http://127.0.0.1:4173/`. No installation or build is needed. Published assets live in `dist/`.

## Photographs

The first photograph comes from ten locally served WebP files. The additional catalog loads as lightweight metadata; Wikimedia photos load only as needed using exact URLs returned by its imageinfo API. All new original photographs are at least 1280 pixels wide; most are at least 1920 pixels wide. Original source pages, photographer credits, Creative Commons licenses, and changes are recorded in `dist/image-credits.json`. Each photograph also displays a source link and license link in the page footer. Photograph licenses apply to the photographs; preserve attribution when reusing them.

`dist/catalog-meta.json` records collection sources, scope and automated quality checks. The new photographs match Wikidata's representative P18 image property. Maps, portraits, low-resolution images, repeated photographs, and unsuitable memorial subjects are filtered; the complete pool has not been manually reviewed image by image. Traditional Chinese names are shown where available, with original English names elsewhere.

Edit the initial records in `dist/destinations.js` and put local licensed photographs in `dist/images/`. To import a new catalog with the same source schema, run `node scripts/import-catalog.mjs <path-to-destinations.json>`. The original collection and source API caches are retained in the workspace's `asset-research/expanded/` folder.

## Validation

Run `node --test tests/*.test.mjs` to check actual catalog completeness, shuffle rounds, asynchronous catalog merging, bounded photo caching, timeouts and failed-photo handling.

## GitHub Pages

This repository publishes `dist/` to GitHub Pages. In Settings → Pages, choose **GitHub Actions** as the source. Each push to `main` publishes the latest website; the workflow can also run manually from Actions → Publish Journey.

The website uses relative paths and works under a repository URL such as `https://egghao.github.io/journey/`. The workflow uploads only the public website assets, including photograph attribution.

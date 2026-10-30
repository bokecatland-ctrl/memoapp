// 画面のファイル(HTML・JS・CSS・アイコン)を端末にためて、電波がなくても、遅くても、すぐ開けるようにする。
// メモの中身(Supabase とのやりとり)はここでは扱わない(未送信の保持は画面側の CloudMemoStore が行う)
const CACHE = 'memoapp-shell-v1';
const STATIC = ['/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png', '/shortcut-voice.png'];

/** HTML が使う /assets/ のファイル(ビルドごとに名前が変わる) */
function assetsOf(html) {
  return [...new Set([...html.matchAll(/\/assets\/[^"'\s)]+/g)].map((m) => m[0]))];
}

/** 新しい HTML と、それが使うファイルをそろえて保存し、使わなくなった古いファイルを消す */
async function cacheShell(response) {
  const html = await response.clone().text();
  const assets = assetsOf(html);
  const cache = await caches.open(CACHE);
  await cache.addAll(assets); // 1つでも取れなければ HTML も入れ替えない(古い組み合わせのまま開ける)
  await cache.put('/', response);
  const keep = new Set(assets);
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname;
    if (path.startsWith('/assets/') && !keep.has(path)) await cache.delete(req);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(STATIC);
      await cacheShell(await fetch('/', { cache: 'no-cache' }));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase などは素通し

  // 画面を開くとき:ためてある画面をすぐ出し、裏で最新を取ってくる(次に開いたときに新しくなる)
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cached = await caches.match('/');
        const update = fetch('/', { cache: 'no-cache' })
          .then(async (res) => {
            if (res.ok) await cacheShell(res.clone());
            return res;
          })
          .catch(() => null);
        if (cached) {
          event.waitUntil(update);
          return cached;
        }
        return (await update) ?? Response.error();
      })(),
    );
    return;
  }

  // ビルドごとに名前が変わるファイルとアイコン:ためてあればそれを使う
  if (url.pathname.startsWith('/assets/') || STATIC.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
        return res;
      })(),
    );
  }
});

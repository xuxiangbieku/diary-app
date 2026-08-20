const CACHE = "diary-v2";
const ASSETS = [".", "index.html", "css/style.css", "js/supabase-config.js", "js/db.js", "js/auth.js", "js/app.js", "manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    // 清理旧版本缓存（diary-v1），防止手机永远用旧代码
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS);
  })());
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const url = e.request.url || "";
  // Supabase API 请求永不缓存，始终走网络（保证同步最新数据）
  if (url.includes("supabase.co")) return;
  if (e.request.method !== "GET") return;
  // network-first：每次优先拉取最新文件，网络失败时才回退缓存（离线兜底）
  e.respondWith((async () => {
    try {
      const res = await fetch(e.request);
      if (res.ok) {
        const cache = await caches.open(CACHE);
        cache.put(e.request, res.clone());
      }
      return res;
    } catch (err) {
      const cached = await caches.match(e.request);
      return cached || Response.error();
    }
  })());
});

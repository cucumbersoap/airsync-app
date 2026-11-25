// Air-Sync 앱 오프라인 캐시: 앱 화면은 바로 뜨게, 데이터(/api, /mqtt)는 항상 서버에서
// + 휴대폰 알림(웹 푸시): 서버가 보낸 알림을 화면에 띄움
const CACHE = "airsync-v7";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./download.html",
  "https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, {mode: u.startsWith("http") ? "no-cors" : "same-origin"})).catch(() => {})))));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.pathname.startsWith("/api") || url.pathname.startsWith("/mqtt")) return;
  // 화면(html): 새 버전 먼저, 안 되면 저장된 화면 (페이지마다 따로 저장)
  if (req.mode === "navigate" || (url.origin === location.origin && url.pathname.endsWith(".html"))) {
    const key = url.pathname.endsWith("download.html") ? "./download.html" : "./index.html";
    e.respondWith(fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(key, c)); } return r; })
      .catch(() => caches.match(key)));
    return;
  }
  // 아이콘, 라이브러리, 글꼴: 저장된 것 먼저
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === "opaque") { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
    return r;
  })));
});

// ---------- 알림 ----------
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = {body: e.data ? e.data.text() : ""}; }
  const title = d.title || "Air-Sync";
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || "",
    icon: "icon-192.png",
    badge: "icon-192.png",
    tag: d.tag || "airsync",
    renotify: true,
    timestamp: d.ts || Date.now(),
    data: {url: "./index.html#home"}
  }));
});
// 알림을 누르면 앱을 열거나, 열려 있는 앱으로 이동
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || "./index.html", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type: "window", includeUncontrolled: true}).then(list => {
    for (const c of list) if (c.url.startsWith(self.registration.scope) && "focus" in c) { c.navigate(target).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(target);
  }));
});

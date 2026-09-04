// PWAとして「インストール」できるようにするための最小限のService Worker。
//
// 意図的に何もキャッシュしない。app.js/style.cssは更新時刻をクエリ文字列に
// 付けて配信しており(app/main.py の static_url を参照)、ここでキャッシュ層を
// 足すと「直したのに反映されない」という過去に踏んだ不具合を再び持ち込みかねない。
// そのため、すべてのリクエストをそのままネットワークへ素通しするだけにする。

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

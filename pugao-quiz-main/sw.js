const CACHE_NAME = 'pugao-quiz-v3';
const STATIC_FILES = [
  '/pugao-quiz/',
  '/pugao-quiz/index.html',
  '/pugao-quiz/manifest.json',
  '/pugao-quiz/%E8%B3%87%E7%94%A2%203_0.png',
  '/pugao-quiz/stk-hello.png',
  '/pugao-quiz/stk-cheer.png',
  '/pugao-quiz/stk-thinking.png',
  '/pugao-quiz/stk-worry.png',
  '/pugao-quiz/stk-done.png',
  '/pugao-quiz/stk-good.png',
  '/pugao-quiz/stk-ending.png',
  '/pugao-quiz/perfect_icon.png',
  '/pugao-quiz/icon-192.png',
];

// 安裝：預先快取所有靜態檔案
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_FILES))
  );
  self.skipWaiting();
});

// 啟動：清除舊版快取
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 攔截請求：API 呼叫走網路，靜態檔案走快取
self.addEventListener('fetch', event => {
  if (event.request.url.includes('script.google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

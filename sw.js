const CACHE_NAME = 'puping-quiz-v1';
const STATIC_FILES = [
  '/puping-quiz-main/',
  '/puping-quiz-main/index.html',
  '/puping-quiz-main/manifest.json',
  '/puping-quiz-main/%E8%B3%87%E7%94%A2%203_0.png',
  '/puping-quiz-main/stk-hello.png',
  '/puping-quiz-main/stk-cheer.png',
  '/puping-quiz-main/stk-thinking.png',
  '/puping-quiz-main/stk-worry.png',
  '/puping-quiz-main/stk-done.png',
  '/puping-quiz-main/stk-good.png',
  '/puping-quiz-main/stk-ending.png',
  '/puping-quiz-main/perfect_icon.png',
  '/puping-quiz-main/icon-192.png',
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

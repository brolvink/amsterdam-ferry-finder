// Extra service-worker code, pulled in by the generated sw.js via importScripts.
// Music is cached on first play from a FULL 200 response (never a 206) and then
// served from cache with proper Range/206 answers so <audio> can seek offline.
const AUDIO_CACHE = "ferry-audio-v1";

async function rangeResponse(full, rangeHeader) {
  const buf = await full.arrayBuffer();
  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!m || (m[1] === "" && m[2] === "")) return new Response(buf, { status: 200, headers: full.headers });
  const size = buf.byteLength;
  let start, end;
  if (m[1] === "") {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + size } });
  }
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Type": full.headers.get("Content-Type") || "audio/mpeg",
      "Content-Length": String(end - start + 1),
      "Content-Range": "bytes " + start + "-" + end + "/" + size,
      "Accept-Ranges": "bytes",
    },
  });
}

async function cacheFull(url) {
  const cache = await caches.open(AUDIO_CACHE);
  if (await cache.match(url)) return;
  const res = await fetch(url, { credentials: "same-origin" });
  if (res.status === 200) await cache.put(url, res);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.endsWith(".mp3")) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(AUDIO_CACHE);
      const cached = await cache.match(url.pathname);
      const range = req.headers.get("range");
      if (cached) return range ? rangeResponse(cached, range) : cached;
      // Cache miss: let the network answer (it may be a 206), and fill the cache with a full 200 in the background.
      event.waitUntil(cacheFull(url.pathname).catch(() => {}));
      return fetch(req);
    })()
  );
});

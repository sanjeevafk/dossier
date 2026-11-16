import test from "node:test";
import assert from "node:assert/strict";
import { serveStaticFile } from "../src/http/static.ts";

function fakeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    removeHeader(k) { delete this.headers[k.toLowerCase()]; },
    end(chunk) { if (chunk) this.body += chunk.toString(); this.ended = true; }
  };
}

test("index.html asset references are content-versioned so CDN cache cannot serve stale JS", () => {
  const res = fakeRes();
  const handled = serveStaticFile('/', { method: 'GET', headers: {} }, res);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /src="\/app\.js\?v=[0-9a-f]{10}"/, 'app.js must carry a content hash');
  assert.match(res.body, /href="\/dist\.css\?v=[0-9a-f]{10}"/, 'dist.css must carry a content hash');
  assert.equal(res.headers['cache-control'], 'no-cache', 'the HTML itself must revalidate');
});

test("app.js is served with revalidation headers", () => {
  const res = fakeRes();
  const handled = serveStaticFile('/app.js', { method: 'HEAD', headers: {} }, res);
  assert.equal(handled, true);
  assert.equal(res.headers['cache-control'], 'no-cache');
  assert.ok(res.headers['last-modified']);
});

test("path traversal outside public/ is refused", () => {
  const res = fakeRes();
  serveStaticFile('/../package.json', { method: 'GET', headers: {} }, res);
  assert.equal(res.statusCode, 403);
});

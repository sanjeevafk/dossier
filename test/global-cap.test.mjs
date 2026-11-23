import test from "node:test";
import assert from "node:assert/strict";

process.env.GLOBAL_DAILY_EVAL_CAP = "2";
const { evaluateLimiter, commitGlobalEvalSpend } = await import("../src/http/limits.ts");

const fakeReq = (ip) => ({ headers: {}, socket: { remoteAddress: ip } });
const fakeRes = () => ({ statusCode: 0, headers: {}, setHeader() {}, writeHead() {}, end() { this.ended = true; } });

test("requests that pass the limiter but never run do not spend the global daily cap", () => {
  // Five rejected-downstream requests (e.g. 401/400/429-busy) from different IPs.
  for (let i = 0; i < 5; i++) assert.equal(evaluateLimiter(fakeReq(`10.0.0.${i}`), fakeRes()), true);
  // Cap is still intact: two real evaluations are admitted, the third is refused.
  commitGlobalEvalSpend();
  assert.equal(evaluateLimiter(fakeReq("10.0.1.1"), fakeRes()), true);
  commitGlobalEvalSpend();
  const res = fakeRes();
  assert.equal(evaluateLimiter(fakeReq("10.0.1.2"), res), false);
});

// Simulates one hour with a fake $: colors, toast marks and the expired line.
import assert from "node:assert/strict";
import { register } from "../hooks/token-weather.mjs";

const hooks = {};
register((name, a, b) => { hooks[name] = b ?? a; });
let now = 1_000_000;
let pending = null;
const toasts = [];
const $ = {
  clock: {
    now: async () => now,
    after: (ms, fn) => { pending = { at: now + ms, fn }; return { cancel() { pending = null; } }; },
  },
  env: { get: async () => null },
  settings: { read: async () => ({}) },
  session: { usage: async () => ({ context: { tokens: 68000, window: 200000, percent: 34 }, rateLimits: [{ kind: "five_hour", percentUsed: 20 }] }) },
  ui: { invalidate() {}, toast: (t) => toasts.push({ at: now - 1_000_000, t }), resolve: () => ({ Box: (p) => p, Text: (p) => p }) },
};
const cache = () => hooks["ui.render"]($, {}, () => null).children.slice(3);
const run = async (until) => {
  while (pending && pending.at <= until) {
    now = pending.at; const f = pending.fn; pending = null; f();
    await new Promise((r) => setTimeout(r, 0));
  }
  now = until;
};

await hooks["session.start"]($, {}, async () => {});
await hooks["turn.complete"]($, {}, async () => {});
assert.equal(cache().length, 0, "no countdown before a cached request");

const step = hooks["turn.step"]($, {}, async function* () {
  return { usage: { cache_read_input_tokens: 60000, cache_creation_input_tokens: 2000, input_tokens: 500 } };
});
await step.next();

const at = async (sec) => { await run(1_000_000 + sec * 1000); return cache(); };
let c = await at(1);
assert.equal(c[1].color, "green"); assert.equal(c[1].children, "60m"); assert.equal(c[2].children, " left (1h)");
c = await at(40 * 60);
assert.equal(c[1].color, "yellow");
c = await at(55 * 60 + 5);
assert.equal(c[1].color, "red");
c = await at(59 * 60 + 30);
assert.equal(c[1].children, "0:30"); assert.equal(c[1].bold, true);
c = await at(3601);
assert.match(c[1].children, /^expired: next message rewrites 62\.5k$/);
assert.deepEqual(toasts.map((x) => x.at / 1000), [3300, 3540]);
console.log("ok");

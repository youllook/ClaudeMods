// Simulates one hour with a fake $: colors, toast marks and the expired line,
// on the terminal (fill glyphs) and on a remote surface (SVG rings).
import assert from "node:assert/strict";
import { register } from "../hooks/token-weather.mjs";

const hooks = {};
register((name, a, b) => { hooks[name] = b ?? a; });
let now = 1_000_000;
let pending = null;
let remote = false;
let planWindows = [{ kind: "five_hour", percentUsed: 20 }, { kind: "seven_day", percentUsed: 80 }];
const stored = {};
const toasts = [];
const $ = {
  clock: {
    now: async () => now,
    after: (ms, fn) => { pending = { at: now + ms, fn }; return { cancel() { pending = null; } }; },
  },
  env: { get: async () => null },
  settings: { read: async () => ({}) },
  session: { id: async () => "s1", usage: async () => ({ context: { tokens: 68000, window: 200000, percent: 34 }, rateLimits: planWindows }) },
  store: { get: async (k) => stored[k], set: async (k, v) => { stored[k] = JSON.parse(JSON.stringify(v)); } },
  ui: { invalidate() {}, toast: (t) => toasts.push({ at: now - 1_000_000, t }), resolve: () => ({ Box: (p) => p, Text: (p) => p, ...(remote ? { Svg: (p) => p } : {}) }) },
};
const parts = () => hooks["ui.render"]($, {}, () => null).children;
const cache = () => parts().find((p) => / cache /.test(p.children));
const run = async (until) => {
  while (pending && pending.at <= until) {
    now = pending.at; const f = pending.fn; pending = null; f();
    await new Promise((r) => setTimeout(r, 0));
  }
  now = until;
};

await hooks["session.start"]($, {}, async () => {});
await hooks["turn.complete"]($, {}, async () => {});
assert.equal(cache(), undefined, "no countdown before a cached request");
assert.equal(parts()[0].children, "◔ ctx 34%");
assert.deepEqual(parts().slice(-1).map((p) => [p.children, p.color]), [["◕ 7d 80%", "yellow"]]);

const step = hooks["turn.step"]($, {}, async function* () {
  return { usage: { cache_read_input_tokens: 60000, cache_creation_input_tokens: 2000, input_tokens: 500 } };
});
await step.next();

const at = async (sec) => { await run(1_000_000 + sec * 1000); return cache(); };
let c = await at(1);
assert.equal(c.color, "green"); assert.equal(c.children, "● cache 60m");
c = await at(40 * 60);
assert.equal(c.color, "yellow");
c = await at(55 * 60 + 5);
assert.equal(c.color, "red");
c = await at(59 * 60 + 30);
assert.equal(c.children, "○ cache 0:30"); assert.equal(c.bold, true);

remote = true;
const svg = parts()[0];
assert.equal(svg.width, 4 * 118);
assert.match(svg.alt, /cache 0:30 left of 1h/);
assert.match(svg.source, /^<svg [^>]*>.*>0:30<\/text>.*<\/svg>$/);
remote = false;

// A restart: module state is lost, the next response has not come yet.
planWindows = [];
await hooks["session.start"]($, {}, async () => {});
assert.equal(cache().children, "○ cache 0:30", "countdown resumes from the store");
assert.equal(parts().slice(-1)[0].children, "◕ 7d 80%", "plan windows come back from the store");

c = await at(3601);
assert.match(c.children, /^○ cache expired: next message rewrites 62\.5k$/);
assert.deepEqual(toasts.map((x) => x.at / 1000), [3300, 3540]);
console.log("ok");

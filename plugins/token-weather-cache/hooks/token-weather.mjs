// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
//
// Modified 2026-10-06 by youllook: replaced the per-turn chart with a prompt-cache
// countdown (turn.step, session.end, timer, toasts). Original: token-weather in
// anthropics/claude-code-playground. See THIRD_PARTY_NOTICES.md for the MIT notice
// covering the adapted cache-countdown logic.
//
// Token Weather: a live forecast of the context window, above the prompt.
//
// turn.complete: after each main-loop turn, read the context window's fill
// from $.session.usage() (the same figures the status line shows).
// session.start: take a first reading, so the band shows before any turn.
// turn.step: time each main-loop request and note whether it touched the
// prompt cache, for the cache countdown.
// ui.render (AbovePrompt): one line: icon, forecast word, percent, tokens
// used of the window, and the time left before the prompt cache expires.
//
// Cache countdown: TTL rules and the timer pacing are adapted from
// jmac122/cache-countdown (MIT), itself from davila7/claude-code-templates
// prompt-cache-control (MIT). The lifetime counts from the start of the last
// request that read or wrote the cache; any message refreshes it.
//
// The host reads on(...) and $.noun.method(...) from source, so they are
// spelled literally, and helpers that take $ are top-level functions.

// Forecast bands, by percent of the window used.
const FORECAST = [
// Single-width text symbols, not emoji: they line up in every terminal font.
  { upTo: 25, icon: "☀", word: "Clear", color: "yellow" },
  { upTo: 50, icon: "☁", word: "Cloudy", color: "cyan" },
  { upTo: 75, icon: "☂", word: "Showers", color: "blue" },
  { upTo: 90, icon: "☇", word: "Storm", color: "magenta" },
  { upTo: Infinity, icon: "↯", word: "Compact soon", color: "red" },
];

const TTL_MS = { "5m": 300_000, "1h": 3_600_000 };
// Toasts at these seconds left; marks longer than the TTL are skipped.
const TOAST_AT = [300, 60];
// Inside this window the countdown shows m:ss and ticks each second.
const FINAL_MS = 60_000;

// Latest reading: { tokens, window, percent }.
let reading = null;
// Last main-loop request that touched the cache: { startedAt, tokens }.
let lastCache = null;
let ttl = "5m";
let timer;
// Lowest toast mark already shown for the current cache entry.
let toastLevel = Infinity;
// Clock time of the last tick or request; ui.render draws from it.
let nowMs = 0;

export function register(on) {
  on("session.start", async ($, e, next) => {
    const result = await next(e);
    reading = null;
    lastCache = null;
    await decideTtl($);
    await takeReading($);
    return result;
  });

  on("session.end", async ($, e, next) => {
    stopTimer();
    if (e.reason === "clear") {
      lastCache = null;
    }
    return next(e);
  });

  on("turn.step", async function* ($, e, next) {
    if (e.agentId) {
      return yield* next(e);
    }
    const startedAt = await $.clock.now();
    const r = yield* next(e);
    const u = r?.usage;
    if (u) {
      const read = u.cache_read_input_tokens ?? 0;
      const write = u.cache_creation_input_tokens ?? 0;
      if (read + write > 0) {
        lastCache = { startedAt, tokens: read + write + (u.input_tokens ?? 0) };
        nowMs = startedAt;
        toastLevel = Infinity;
        schedule($, 0);
      }
    }
    return r;
  });

  on("turn.complete", async ($, e, next) => {
    const result = await next(e);
    if (e.agentId) {
      return result;
    }
    await takeReading($);
    return result;
  });

  on("ui.render", { component: "AbovePrompt" }, ($, e, next) => {
    if (e.hasSurvey || !reading) {
      return next(e);
    }
    const { Box, Text } = $.ui.resolve(e);
    return band(Box, Text, nowMs);
  });
}

async function takeReading($) {
  try {
    const { context, rateLimits } = await $.session.usage();
    if (!context || !context.window) {
      return;
    }
    const tokens = context.tokens ?? 0;
    const percent = Math.round(context.percent ?? (tokens / context.window) * 100);
    // The session.start reading is 0 before any response; keep the last real one.
    if (tokens > 0 || !reading) {
      reading = { tokens, window: context.window, percent };
    }
    if (ttlByAccount) {
      ttl = accountTtl(rateLimits ?? []);
    }
    $.ui.invalidate("ui.render");
  } catch {
    // No reading this turn; the band keeps the last one.
  }
}

// The TTL Claude Code asks for, first match wins: FORCE_PROMPT_CACHING_5M,
// CLAUDE_CODE_PROMPT_CACHE_TTL, the promptCacheTtl setting,
// ENABLE_PROMPT_CACHING_1H, then the account (1h on a subscription within
// plan usage, 5m otherwise).
let ttlByAccount = true;
async function decideTtl($) {
  const none = () => null;
  const isOn = (v) => v === "1" || v?.toLowerCase() === "true";
  const asTtl = (v) => (v === "5m" || v === "1h" ? v : undefined);
  const force5m = await $.env.get("FORCE_PROMPT_CACHING_5M").catch(none);
  const ttlVar = await $.env.get("CLAUDE_CODE_PROMPT_CACHE_TTL").catch(none);
  const enable1h = await $.env.get("ENABLE_PROMPT_CACHING_1H").catch(none);
  const setting = (await $.settings.read().catch(() => ({}))).promptCacheTtl;
  const pinned = isOn(force5m) ? "5m" : asTtl(ttlVar) ?? asTtl(setting) ?? (isOn(enable1h) ? "1h" : undefined);
  ttlByAccount = !pinned;
  ttl = pinned ?? "5m";
}

function accountTtl(windows) {
  const plan = windows.filter((w) => w.kind === "five_hour" || w.kind === "seven_day");
  if (plan.length === 0) return "5m";
  return plan.some((w) => w.percentUsed >= 100) ? "5m" : "1h";
}

function leftMs(now) {
  return lastCache ? Math.max(0, lastCache.startedAt + TTL_MS[ttl] - now) : 0;
}

function stopTimer() {
  timer?.cancel();
  timer = undefined;
}

function schedule($, delay) {
  timer?.cancel();
  // A tick that fails (module unloading) stops the timer rather than retrying.
  timer = $.clock.after(delay, () => void tick($).catch(stopTimer));
}

// Wakes only when the countdown text changes or a toast is due.
async function tick($) {
  nowMs = await $.clock.now();
  const left = leftMs(nowMs);
  const secs = Math.ceil(left / 1000);
  const due = TOAST_AT.filter((m) => m * 1000 < TTL_MS[ttl] && secs <= m && m < toastLevel);
  if (due.length && left > 0) {
    toastLevel = Math.min(...due);
    $.ui.toast(`Prompt cache expires in ${clock(left)}: send any message to keep it warm`);
  }
  $.ui.invalidate("ui.render");
  if (left > 0) {
    schedule($, nextDelay(left));
  } else {
    timer = undefined;
  }
}

function nextDelay(left) {
  const period = left > FINAL_MS ? 60_000 : 1_000;
  let d = ((left - 1) % period) + 1;
  if (left > FINAL_MS) d = Math.min(d, left - FINAL_MS);
  for (const m of TOAST_AT) {
    if (m * 1000 < left) d = Math.min(d, left - m * 1000);
  }
  return Math.max(d, 20);
}

function band(Box, Text, now) {
  const f = forecastFor(reading.percent);
  const parts = [
    Text({ color: f.color, bold: true, children: `${f.icon}  ${f.word}` }),
    Text({ children: `  ${reading.percent}% of context` }),
    Text({ dimColor: true, children: `  ${short(reading.tokens)} / ${short(reading.window)}` }),
  ];
  if (lastCache) {
    const left = leftMs(now);
    parts.push(Text({ dimColor: true, children: "   ⏱ cache " }));
    if (left > 0) {
      parts.push(Text({ color: cacheColor(left), bold: left <= FINAL_MS, children: countdown(left) }));
      parts.push(Text({ dimColor: true, children: ` left (${ttl})` }));
    } else {
      parts.push(Text({ color: "red", children: `expired: next message rewrites ${short(lastCache.tokens)}` }));
    }
  }
  return Box({ flexDirection: "row", paddingX: 1, children: parts });
}

// Green while plenty, yellow below 40% of the lifetime, red from 5 minutes (1 minute on a 5m cache).
function cacheColor(left) {
  if (left <= Math.min(300_000, TTL_MS[ttl] * 0.2)) return "red";
  return left / TTL_MS[ttl] <= 0.4 ? "yellow" : "green";
}

function countdown(left) {
  return left > FINAL_MS ? `${Math.ceil(left / 60_000)}m` : clock(left);
}

function clock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function forecastFor(percent) {
  return FORECAST.find((band) => percent < band.upTo) ?? FORECAST[FORECAST.length - 1];
}

function short(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return String(n);
}

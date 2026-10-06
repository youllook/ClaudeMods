# token-weather-cache

> 提示框上方一條 context 用量天氣列，加上 prompt cache 倒數與過期提醒。
>
> A context-window weather band above the prompt, plus a prompt-cache countdown with expiry toasts.

改自 Anthropic 官方範例 [token-weather](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods)：原本右側的「最近 12 輪長條圖」換成快取倒數。**非官方版本。**

## 長這樣

```text
 ☁  Cloudy  34% of context  68k / 200k   ⏱ cache 42m left (1h)
```

| 區塊 | 意思 |
|---|---|
| ☀ ☁ ☂ ☇ ↯ | context 用量：<25% Clear、<50% Cloudy、<75% Showers、<90% Storm、以上 Compact soon |
| `68k / 200k` | 已用 token ／ 模型的 context window（和 status line 同一組數字） |
| `⏱ cache 42m` | 距離 prompt cache 過期還剩多久。綠 → 剩不到 40% 壽命轉黃 → 剩 5 分鐘轉紅（5m 快取則剩 1 分鐘）；最後一分鐘改成 `0:30` 秒數 |
| `expired: next message rewrites 62.5k` | 已過期：下一則訊息要重寫這麼多 token |

- 剩 **5 分鐘**和 **1 分鐘**時各跳一次 toast：送任何訊息就能讓快取續命。
- 計時器只在倒數文字要變、或該跳 toast 時才醒來，不是每秒跑。
- 只看主對話的請求，subagent 不算（它們有自己的快取）。

### TTL 怎麼決定（先符合者優先）

`FORCE_PROMPT_CACHING_5M` → `CLAUDE_CODE_PROMPT_CACHE_TTL` → 設定 `promptCacheTtl` → `ENABLE_PROMPT_CACHING_1H` → 帳號（訂閱且額度內 1h，否則 5m）。

## 能碰到什麼

```text
hooks: session.start, session.end, turn.step, turn.complete, ui.render{component=AbovePrompt}
calls: $.clock.after, $.clock.now, $.env.get, $.session.usage, $.settings.read, $.ui.invalidate, $.ui.resolve, $.ui.toast
```

只讀用量和設定、畫一行 UI、跳 toast。**不連網、不寫檔、不送模型請求**（L0）。

## 安裝

需要 Claude Code **v2.1.287 以上**。

```bash
claude plugin marketplace add youllook/ClaudeMods
claude plugin install token-weather-cache@claude-mods
```

> 和官方 token-weather 或其他畫 `AbovePrompt` 的 mod（例如 cache-countdown）會搶同一條位置，擇一安裝。

## 測試

```bash
node tests/token-weather.test.mjs
```

用假的 `$` 模擬一小時：檢查顏色變化、toast 時機與過期顯示。

## 授權

Apache-2.0（見 [LICENSE](LICENSE)），原作 Copyright 2026 Anthropic PBC。
快取倒數邏輯改自 [jmac122/cache-countdown](https://github.com/jmac122/cache-countdown)（MIT），聲明見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

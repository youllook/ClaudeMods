# token-weather-cache

> 提示框上方一條 context 用量天氣列，加上 prompt cache 倒數與過期提醒。
>
> A context-window weather band above the prompt, plus a prompt-cache countdown with expiry toasts.

改自 Anthropic 官方範例 [token-weather](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods)：原本右側的「最近 12 輪長條圖」換成快取倒數，桌面版再改畫成四個圓環。**非官方版本。**

## 長這樣

**桌面版**（以及其他能畫 SVG 的介面）：一排四個圓環。

| 圓環 | 中間 | 旁邊 |
|---|---|---|
| ctx | 用量 %，顏色跟天氣（☀ ☁ ☂ ☇ ↯） | `68k/200k` |
| cache | 剩餘時間，**圓環隨倒數排空** | TTL（`1h 快取`）；過期顯示「過期」和要重寫的 token 數 |
| 5h ／ 7d | 方案額度已用 %（75% 起黃、90% 起紅） | `reset 2h13m`：多久後重置。沒有訂閱額度就不畫 |

**終端機**：一行填充符號（○ ◔ ◑ ◕ ●）。

```text
 ◔ ctx 34% 68k/200k  ·  ◕ cache 42m  ·  ○ 5h 20%  ·  ◕ 7d 80%
```

| 區塊 | 意思 |
|---|---|
| `ctx` | context 用量，顏色依天氣：<25% Clear、<50% Cloudy、<75% Showers、<90% Storm、以上 Compact soon |
| `68k/200k` | 已用 token ／ 模型的 context window（和 status line 同一組數字） |
| `cache 42m` | 距離 prompt cache 過期還剩多久。綠 → 剩不到 40% 壽命轉黃 → 剩 5 分鐘轉紅（5m 快取則剩 1 分鐘）；最後一分鐘改成 `0:30` 秒數 |
| `cache expired: next message rewrites 62.5k` | 已過期：下一則訊息要重寫這麼多 token |
| `5h` `7d` | 方案額度已用 %，數字來自同一次用量讀取，不另外發請求 |

- 剩 **5 分鐘**和 **1 分鐘**時各跳一次 toast：送任何訊息就能讓快取續命。
- 計時器只在倒數文字要變、或該跳 toast 時才醒來，不是每秒跑。
- 只看主對話的請求，subagent 不算（它們有自己的快取）。
- **重開 app 或 mod 重新載入後接著倒數**：每個 session 最後一次快取時間、帳號最後一次的 5h／7d 額度存在 mod 自己的儲存檔（`$.store`），重開後不必等下一則訊息。已經過了的 toast 時間點不會重跳；已重置的額度視窗不會顯示舊數字。

### TTL 怎麼決定（先符合者優先）

`FORCE_PROMPT_CACHING_5M` → `CLAUDE_CODE_PROMPT_CACHE_TTL` → 設定 `promptCacheTtl` → `ENABLE_PROMPT_CACHING_1H` → 帳號（訂閱且額度內 1h，否則 5m）。

## 能碰到什麼

```text
hooks: session.start, session.end, turn.step, turn.complete, ui.render{component=AbovePrompt}
calls: $.clock.after, $.clock.now, $.env.get, $.session.id, $.session.usage, $.settings.read, $.store.get, $.store.set, $.ui.invalidate, $.ui.resolve, $.ui.toast
```

只讀用量和設定、畫一行 UI、跳 toast，並用 `$.store` 記住快取時間與額度（Claude Code 設定資料夾下 mod 自己的一個 JSON 檔，只存時間戳、token 數與百分比）。**不連網、不執行程式、不送模型請求**。

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

用假的 `$` 模擬一小時：檢查顏色變化、toast 時機與過期顯示，終端機文字版與 SVG 圓環版各驗一次。

## 授權

Apache-2.0（見 [LICENSE](LICENSE)），原作 Copyright 2026 Anthropic PBC。
快取倒數邏輯改自 [jmac122/cache-countdown](https://github.com/jmac122/cache-countdown)（MIT），聲明見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
圓環版面的構想參考 [BatuhanCakmakk/wavy-usage](https://github.com/BatuhanCakmakk/wavy-usage)（只借設計，沒有使用其程式碼）。

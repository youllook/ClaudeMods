# ClaudeMods

Claude Code **mods**（function-hook 外掛）合集，依工具分類。
A categorized collection of Claude Code mods (function-hook plugins).

Mods 是 Claude Code v2.1.287（2026-10）推出的外掛形式：用 TypeScript 寫的 hook，可以在工具呼叫執行前攔截或改寫，也能畫面板、加指令。
官方說明：https://code.claude.com/docs/en/plugins/mods/overview

## 安裝

```bash
claude plugin marketplace add youllook/ClaudeMods
claude plugin install <mod 名稱>@claude-mods
```

## 工具分類

### 🐚 Shell
| Mod | 說明 | 能碰到什麼 |
|---|---|---|
| [shell-guard](plugins/shell-guard) | Windows shell 防呆：Bash 反斜線路徑自動修正；擋下會被 shell 吃掉的 `node -e` 引號和 heredoc；擋下送錯 shell 的 PowerShell / Bash 語法 | 只呼叫 toast |

### 📊 用量
| Mod | 說明 | 能碰到什麼 |
|---|---|---|
| [token-weather-cache](plugins/token-weather-cache) | 提示框上方的 context 用量天氣列＋prompt cache 倒數（綠→黃→紅，剩 5 分／1 分跳 toast）。改自 Anthropic 官方範例 token-weather，Apache-2.0 | 只讀用量、畫一行 UI、呼叫 toast |

更多分類陸續加入。

## ⚠️ 安全提醒

Mods **沒有沙箱**，權限跟您本人一樣大。安裝任何 mod 之前（包括這裡的），建議先看原始碼，並跑：
```bash
claude plugin validate plugins/<mod 名稱>
```
輸出裡的 `hooks:` 和 `calls:` 兩行會列出它掛了哪些事件、用到哪些能力。這個 repo 每個 mod 的 README 都會附上這兩行。

## 授權

[MIT](LICENSE)。個別 mod 若有自己的 LICENSE（例如 token-weather-cache 為 Apache-2.0），以該檔為準。

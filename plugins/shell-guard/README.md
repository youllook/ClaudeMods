# shell-guard

> Windows 上的 Claude Code shell 防呆 mod。在指令**執行之前**，攔下 Bash 和 PowerShell 最常見的環境錯誤。
>
> A Claude Code mod that catches the most common Windows shell mistakes — *before* the command runs.

## 為什麼需要

在 Windows 上，Claude Code 有 **Bash（Git Bash）** 和 **PowerShell** 兩種 shell，模型常常把兩邊的寫法搞混，或被 Bash 的引號規則坑到。下面這些情況會**靜默出錯**，沒有任何錯誤訊息：

| 寫法 | 實際發生的事 |
|---|---|
| `echo C:\Users\me\.claude` | Git Bash 把反斜線吃掉，印出 `C:Usersme.claude` |
| `node -e "console.log(`whoami`)"` | Bash 先執行反引號裡的指令，node 收到的程式碼已經被改壞 |
| `cat > a.sh <<EOF` ＋ `$HOME` | 寫進檔案的是展開後的值，不是原本的 `$HOME` |
| Bash 裡寫 `echo $env:PATH` | 印出 `:PATH` |
| PowerShell 裡寫 `export FOO=bar` | `export is not recognized` |

## 它做什麼

| # | 工具 | 偵測到 | 處理方式 |
|---|---|---|---|
| 1 | Bash | `C:\foo\bar` 這種反斜線路徑 | **改寫**成 `C:/foo/bar` 後照常執行 |
| 2 | Bash | `node -e "…"` 或 `python -c "…"` 的雙引號裡有反引號或 `$(` | **擋下**，請模型先把腳本寫成檔案 |
| 3 | Bash | 沒加引號的 heredoc（`<<EOF`），內容又有 `$` 或反引號 | **擋下**，請模型改用 `<<'EOF'` |
| 4 | Bash | PowerShell 語法（`$env:`、`Get-ChildItem`、`2>$null`…） | **擋下**，請模型改用 PowerShell 工具 |
| 5 | PowerShell | Bash 語法（`export X=`、`/dev/null`、`rm -rf`、`if [ ]; then`…） | **擋下**，請模型改用 Bash 工具 |

- 擋下時，原因會回傳給模型，模型看到就會自己改寫重試。畫面上也會跳一個 🛡 通知。
- **不會誤擋**：單引號和雙引號裡的文字（例如 commit 訊息提到 `/dev/null`）、heredoc 的內容、明確轉交給另一個 shell 的指令（`powershell -Command …`、`bash -c …`）。
- **逃生口**：確實需要那種寫法時，在指令裡加上 `# shell-guard: allow` 就會原樣放行。

## 安裝

需要 Claude Code **v2.1.287 以上**（Mods 從這一版開始提供）。

```bash
claude plugin marketplace add youllook/ClaudeMods
claude plugin install shell-guard@claude-mods
```

在 session 裡也可以用 `/plugin marketplace add youllook/ClaudeMods`，再從 `/plugin` 安裝。如果 session 已經開著，裝完打 `/reload-plugins` 就會載入。

## 它能碰到什麼

`claude plugin validate` 的輸出：
```
hooks: tool.call{tool=Bash}, tool.call{tool=PowerShell}
calls: $.ui.toast
```
只攔 Bash 和 PowerShell 兩個工具的呼叫，唯一用到的能力是跳通知。**不讀寫檔案、不執行程式、不連網路。**

## 測試

```bash
node --experimental-strip-types --no-warnings tests/rules.test.mts
```
34 個案例，涵蓋上表 5 條規則，以及「不該誤擋」的情況。

## 授權

MIT

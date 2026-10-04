import type { Register } from 'claude-code'

// shell-guard: Windows shell mistakes, caught before the command runs.
//
//   Bash tool
//     1. rewrite  C:\foo\bar -> C:/foo/bar           (Git Bash eats backslashes)
//     2. deny     node -e "..." / python -c "..." holding ` or $(   (shell eats them)
//     3. deny     unquoted heredoc (<<EOF) whose body holds ` or $  (shell expands them)
//     4. deny     PowerShell syntax ($env:, Get-ChildItem, 2>$null, ...)
//   PowerShell tool
//     5. deny     Bash syntax (export X=, /dev/null, if [ ... ]; then, ...)
//
// Escape hatch: a command containing `shell-guard: allow` (e.g. as a trailing
// comment) passes untouched, for the rare case the pattern is intended.

const ALLOW = /shell-guard:\s*allow/

// ---------- helpers ----------

/** Split at the first heredoc operator (`<<`, not `<<<`): [command part, heredoc part]. */
function splitHeredoc(command: string): [string, string] {
  const m = /<<(?!<)/.exec(command)
  return m ? [command.slice(0, m.index), command.slice(m.index)] : [command, '']
}

/** Blank out quoted spans so pattern checks only see bare shell text. */
function stripQuoted(text: string): string {
  return text.replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, m => ' '.repeat(m.length))
}

// ---------- 1. drive paths ----------

const DRIVE_PATH = /(?<![A-Za-z0-9_])([A-Za-z]):((?:\\{1,2}[^\\\s'"`|;&<>()$]*)+)/g

export function fixPaths(command: string): string {
  const [head, tail] = splitHeredoc(command)
  // Odd indexes are single-quoted spans: literal in bash, and where sed/regex live.
  const fixed = head
    .split(/('[^']*')/)
    .map((part, i) =>
      i % 2 === 1 ? part : part.replace(DRIVE_PATH, (_, d: string, rest: string) => `${d}:${rest.replace(/\\{1,2}/g, '/')}`),
    )
    .join('')
  return fixed + tail
}

// ---------- 2. inline interpreter code ----------

const INLINE = /\b(node|python3?|py)(?:\.exe)?\s+(-e|--eval|-p|--print|-c)\s+"((?:[^"\\]|\\.)*)"/g

export function checkInline(command: string): string | null {
  const [head] = splitHeredoc(command)
  for (const m of head.matchAll(INLINE)) {
    const body = m[3]
    if (body.includes('`') || body.includes('$(')) {
      return (
        `shell-guard: \`${m[1]} ${m[2]} "..."\` 的雙引號內含反引號或 $(，Bash 會先把它當指令替換吃掉，程式碼會被靜默改壞。` +
        `請把腳本寫成檔案（Write 工具，或 heredoc 用 <<'EOF' 單引號版）再執行該檔案。`
      )
    }
  }
  return null
}

// ---------- 3. unquoted heredoc ----------

const HEREDOC = /<<(?!<)-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/g

export function checkHeredoc(command: string): string | null {
  for (const m of command.matchAll(HEREDOC)) {
    if (m[1]) continue // quoted delimiter: body is literal
    const delim = m[2]
    const after = command.slice((m.index ?? 0) + m[0].length)
    const lines = after.split(/\r?\n/).slice(1)
    const end = lines.findIndex(l => l.trim() === delim)
    const body = (end === -1 ? lines : lines.slice(0, end)).join('\n')
    if (body.includes('`') || /\$[({A-Za-z_]/.test(body)) {
      return (
        `shell-guard: heredoc <<${delim} 沒加引號，內容裡的反引號 / $變數 會被 Bash 展開或執行。` +
        `寫檔請用 <<'${delim}'（單引號版）。若確實要展開變數，在指令加註解 \`# shell-guard: allow\`。`
      )
    }
  }
  return null
}

// ---------- 4. PowerShell syntax in Bash ----------

const PS_IN_BASH: [RegExp, string][] = [
  [/\$env:[A-Za-z_]/, '$env:'],
  [/\b(Get|Set|New|Remove|Test|Copy|Move|Select|Where|ForEach|Write|Out|Invoke|Start|Stop)-[A-Z][A-Za-z]+\b/, 'PowerShell cmdlet'],
  [/2>\$null\b|\$null\s*=|\|\s*Out-Null\b/, '$null'],
  [/\$LASTEXITCODE\b|\$PSScriptRoot\b|\$true\b|\$false\b/, 'PowerShell 變數'],
  [/(^|[\s;|&])(dir|type|del|copy)\s+[A-Za-z]:\\/, 'cmd 指令'],
]

export function checkPsInBash(command: string): string | null {
  const [head] = splitHeredoc(command)
  if (/\b(powershell|pwsh)(\.exe)?\b/i.test(head)) return null // explicitly delegating
  const bare = stripQuoted(head)
  for (const [re, label] of PS_IN_BASH) {
    if (re.test(bare)) {
      return `shell-guard: Bash 工具收到 PowerShell 語法（${label}）。這是 Git Bash，請改用 PowerShell 工具，或改寫成 Bash 寫法。`
    }
  }
  return null
}

// ---------- 5. Bash syntax in PowerShell ----------

const BASH_IN_PS: [RegExp, string][] = [
  [/(^|[;\n])\s*export\s+[A-Za-z_]\w*=/, 'export VAR='],
  [/\/dev\/null\b/, '/dev/null'],
  [/\bif\s+\[\[?\s/, 'if [ ... ]'],
  [/;\s*then\b|(^|[;\n])\s*fi\s*($|[;\n])/, 'then / fi'],
  [/;\s*do\b|(^|[;\n])\s*done\s*($|[;\n])/, 'do / done'],
  [/(^|[\s;|&])(cat|ls|rm|cp|mv)\s+-[a-zA-Z]*[rfla]\b/, 'Unix 旗標 (-rf/-la)'],
]

export function checkBashInPs(command: string): string | null {
  if (/\b(bash|sh|wsl)(\.exe)?\s+-c\b/.test(command)) return null // explicitly delegating
  const bare = stripQuoted(command)
  for (const [re, label] of BASH_IN_PS) {
    if (re.test(bare)) {
      return `shell-guard: PowerShell 工具收到 Bash 語法（${label}）。請改用 Bash 工具，或改寫成 PowerShell 寫法（例如 $env:X='y'、$null、Remove-Item -Recurse -Force）。`
    }
  }
  return null
}

// ---------- hooks ----------

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, ($, e, next) => {
    if (ALLOW.test(e.command)) return next(e)

    const reason = checkInline(e.command) ?? checkHeredoc(e.command) ?? checkPsInBash(e.command)
    if (reason) {
      $.ui.toast('🛡 shell-guard 擋下一個會出錯的 Bash 指令')
      return { deny: reason }
    }

    const command = fixPaths(e.command)
    if (command !== e.command) {
      $.ui.toast('🔧 shell-guard：Windows 路徑反斜線已轉正斜線')
      return next({ ...e, command })
    }
    return next(e)
  })

  on('tool.call', { tool: 'PowerShell' }, ($, e, next) => {
    if (ALLOW.test(e.command)) return next(e)
    const reason = checkBashInPs(e.command)
    if (reason) {
      $.ui.toast('🛡 shell-guard 擋下一個會出錯的 PowerShell 指令')
      return { deny: reason }
    }
    return next(e)
  })
}

import { fixPaths, checkInline, checkHeredoc, checkPsInBash, checkBashInPs } from '../hooks/register.ts'

let fail = 0
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = got === want
  if (!ok) fail++
  console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : `\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`)
}
const blocks = (name: string, r: string | null, want: boolean) => eq(name, r !== null, want)

// 1. paths
eq('path unquoted', fixPaths('cd C:\\Users\\user\\proj && ls'), 'cd C:/Users/user/proj && ls')
eq('path dq doubled', fixPaths('ls "C:\\\\Users\\\\user"'), 'ls "C:/Users/user"')
eq('path sq kept', fixPaths("echo 'C:\\keep\\me'"), "echo 'C:\\keep\\me'")
eq('path heredoc kept', fixPaths("cat > x <<'EOF'\nC:\\in\\doc\nEOF"), "cat > x <<'EOF'\nC:\\in\\doc\nEOF")
eq('sed kept', fixPaths("sed 's:\\(a\\):b:' f"), "sed 's:\\(a\\):b:' f")

// 2. inline
blocks('node -e backtick', checkInline('node -e "console.log(`hi`)"'), true)
blocks('node -e $( ', checkInline('node -e "x=$(date)"'), true)
blocks('python -c plain', checkInline('python -c "print(1+1)"'), false)
blocks('node -e single-quoted ok', checkInline("node -e 'console.log(`hi`)'"), false)
blocks('node script file ok', checkInline('node script.mjs'), false)

// 3. heredoc
blocks('unquoted heredoc with $', checkHeredoc('cat > a.sh <<EOF\necho $HOME\nEOF'), true)
blocks('unquoted heredoc with backtick', checkHeredoc('cat > a.md <<EOF\nuse `x`\nEOF'), true)
blocks('quoted heredoc ok', checkHeredoc("cat > a.sh <<'EOF'\necho $HOME `x`\nEOF"), false)
blocks('dq heredoc ok', checkHeredoc('cat > a <<"EOF"\n$x\nEOF'), false)
blocks('unquoted plain body ok', checkHeredoc('cat > a.txt <<EOF\nhello world\nEOF'), false)
blocks('git commit heredoc ok', checkHeredoc(`git commit -m "$(cat <<'EOF'\nmsg \`x\`\nEOF\n)"`), false)
blocks('herestring ignored', checkHeredoc('grep x <<< "$v"'), false)

// 4. PS in Bash
blocks('$env in bash', checkPsInBash('echo $env:PATH'), true)
blocks('Get-ChildItem in bash', checkPsInBash('Get-ChildItem -Recurse'), true)
blocks('2>$null in bash', checkPsInBash('ls x 2>$null'), true)
blocks('quoted cmdlet text ok', checkPsInBash('grep "Get-Content" file.ps1'), false)
blocks('powershell delegation ok', checkPsInBash('powershell -Command Get-Date'), false)
blocks('normal bash ok', checkPsInBash('ls -la && git status 2>/dev/null'), false)
blocks('cmd dir C:\\', checkPsInBash('dir C:\\Users'), true)

// 5. Bash in PS
blocks('export in ps', checkBashInPs('export FOO=bar'), true)
blocks('/dev/null in ps', checkBashInPs('git status 2>/dev/null'), true)
blocks('if [ in ps', checkBashInPs('if [ -f x ]; then echo y; fi'), true)
blocks('rm -rf in ps', checkBashInPs('rm -rf node_modules'), true)
blocks('ls -la in ps', checkBashInPs('ls -la'), true)
blocks('normal ps ok', checkBashInPs('Get-ChildItem -Recurse | Select-Object -First 5'), false)
blocks('ps env ok', checkBashInPs("$env:FOO = 'bar'; npm run dev"), false)
blocks('bash -c delegation ok', checkBashInPs('bash -c "ls -la"'), false)
blocks('quoted text ok', checkBashInPs('git commit -m "fix /dev/null handling"'), false)

console.log(fail ? `${fail} failed` : 'all passed')

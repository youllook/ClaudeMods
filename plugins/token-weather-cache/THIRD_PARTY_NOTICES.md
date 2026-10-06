# Third-party notices

## token-weather (Apache-2.0)

`hooks/token-weather.mjs` is modified from the token-weather mod in
[anthropics/claude-code-playground](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods),
Copyright 2026 Anthropic PBC, licensed under the Apache License 2.0 (see `LICENSE`).
Changes: see the header of `hooks/token-weather.mjs`.
This is not an official Anthropic product.

## cache-countdown (MIT)

The prompt-cache TTL rules and the countdown timer pacing in `hooks/token-weather.mjs`
are adapted from [jmac122/cache-countdown](https://github.com/jmac122/cache-countdown).
Its license follows in full:

```
MIT License

Copyright (c) 2026 Jared (github.com/jmac122)

Portions (hooks/cache.ts: the TTL rules, advice, miss detection, observed-TTL
inference and formatting helpers) are adapted from
davila7/claude-code-templates, cli-tool/components/mods/observability/prompt-cache-control:
Copyright (c) 2025 Daniel (San) Ávila, MIT License.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

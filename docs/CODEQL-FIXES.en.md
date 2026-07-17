# CodeQL alert fixes

> 中文: [CODEQL-FIXES.zh-CN.md](./CODEQL-FIXES.zh-CN.md)

Dashboard:  
https://github.com/xiaocongyu66/Sharkey-dev/security/code-scanning

## Fixed (summary)

| Rule | Severity | Fix |
|------|----------|-----|
| `js/incomplete-url-substring-sanitization` | High | Host parsing via `URL` / exact AS profile / exact context URI |
| `js/remote-property-injection` | High | `URLSearchParams` in `auth.vue`; allowlisted env keys in test-server |
| `js/user-controlled-bypass` | High | Strict `loginId` format + local account token required |
| `js/polynomial-redos` | High | Linear Accept header checks |
| `js/redos` | High | Bounded version regex in `sync-deps` |
| `js/incomplete-sanitization` | High | `replaceAll` for `[` |
| `js/insecure-randomness` | High | `crypto.randomInt` in Reversi matching |
| `js/missing-origin-check` | Medium | Origin checks for Captcha / SW / embed / EmbedCodeGen |
| `js/log-injection` | Medium | Stop logging raw test-server bodies |
| `js/prototype-pollution-utility` | Medium | Block `__proto__` / `constructor` / `prototype` in merge utils |

## Notes

- `mockServiceWorker.js` is generated MSW code; dismiss as third-party if it still alerts.  
- Re-run CodeQL after merge to refresh the security tab.

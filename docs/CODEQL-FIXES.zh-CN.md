# CodeQL 告警修复记录

> English: [CODEQL-FIXES.en.md](./CODEQL-FIXES.en.md)

对应 GitHub Code scanning：  
https://github.com/xiaocongyu66/Sharkey-dev/security/code-scanning

## 已处理项（摘要）

| 规则 | 级别 | 处理 |
|------|------|------|
| `js/incomplete-url-substring-sanitization` | High | 主机名用 `URL` 解析 / 精确 profile 参数 / 精确 AS context |
| `js/remote-property-injection` | High | `auth.vue` 改用 `URLSearchParams`；测试服 `/env` 键名白名单 |
| `js/user-controlled-bypass` | High | `loginId` 格式校验 + 必须本地账户 token |
| `js/polynomial-redos` | High | Accept 头改为线性 `includes` 检查 |
| `js/redos` | High | `sync-deps` 版本正则加长度上界 |
| `js/incomplete-sanitization` | High | `replaceAll` 去除所有 `[` |
| `js/insecure-randomness` | High | 黑白棋使用 `crypto.randomInt` |
| `js/missing-origin-check` | Medium | Captcha / SW / embed / EmbedCodeGen 校验 origin |
| `js/log-injection` | Medium | 测试服不再 `console.log` 原始 body |
| `js/prototype-pollution-utility` | Medium | `deepMerge`/`deepAssign` 拒绝 `__proto__` 等键 |

## 说明

- `packages/frontend/public/mockServiceWorker.js` 为 MSW 生成文件，若仍告警可标记为第三方/生成代码。  
- CodeQL 可能在后续分析中仍有误报，请结合上下文 triage。  

## 相关提交

见仓库 `main` 上「codeql」相关 commit。

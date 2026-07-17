# 安全说明

> English: [SECURITY.md](./SECURITY.md)

本文档说明如何报告安全问题，以及本仓库对安全漏洞的处理方式。

## 报告漏洞

若你发现安全漏洞，请**不要**公开开 Issue。

请通过 GitHub 的私密漏洞报告，或联系仓库维护者：

- 仓库：https://github.com/xiaocongyu66/Sharkey-dev  
- 安全页：https://github.com/xiaocongyu66/Sharkey-dev/security  

## 我们会做什么

1. 确认并评估影响范围  
2. 在合理时间内准备修复  
3. 发布修复后，视情况公开致谢（若你同意）  

## 范围

包含但不限于：认证绕过、远程代码执行、注入、越权、敏感信息泄露、联邦协议实现缺陷等。

以下通常**不**视为安全漏洞（除非可导致上述影响）：

- 纯 UI/体验问题  
- 依赖的已知问题且已有上游修复计划  
- 需要物理接触设备或已完全沦陷账户的场景  

## Code scanning

本仓库启用了 GitHub CodeQL。公开告警见：

https://github.com/xiaocongyu66/Sharkey-dev/security/code-scanning  

修复记录见 [docs/CODEQL-FIXES.zh-CN.md](./docs/CODEQL-FIXES.zh-CN.md)。

---

以下为上游/原版 SECURITY 内容（如有）：

```
# Reporting Security Issues

If you discover a security issue in Sharkey, please report it by sending an
email to [admin@transfem.org](mailto:admin@transfem.org).

This will allow us to assess the risk, and make a fix available before we add a
bug report to the GitLab repository.

Thanks for helping make Sharkey safe for everyone.

> [!note]
> CNA [requires](https://www.cve.org/ResourcesSupport/AllResources/CNARules#section_5-2_Description) that CVEs include a description in English for inclusion in the CVE Catalog.
> 
> When creating a security advisory, all content must be written in English (it is acceptable to include a non-English description along with the English one).

## When create a patch

If you can also create a patch to fix the vulnerability, please create a PR on the private fork.

> [!note]
> There is a GitHub bug that prevents merging if a PR not following the develop branch of upstream, so please keep follow the develop branch.

```

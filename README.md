<div align="center">

<img src="packages/frontend/assets/sharkey.svg" alt="Sharkey" width="160"/>

# Sharkey-dev

**去中心化社交 · 联邦互通 · 可自建**  
**Decentralized social · Federated · Self-hostable**

[![License](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-GHCR-2496ED?logo=docker&logoColor=white)](https://github.com/xiaocongyu66/Sharkey-dev/pkgs/container/sharkey-dev)
[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?logo=github-actions&logoColor=white)](https://github.com/xiaocongyu66/Sharkey-dev/actions)

基于 [Sharkey](https://joinsharkey.org/) / Misskey 的联邦宇宙（Fediverse）服务端分支  
A Sharkey / Misskey–based Fediverse server fork with practical ops & UX focus

**中文** · [English](#-english)

</div>

---

## 🌐 中文

### 这是什么？

把 **微博 / 推特式信息流** 和 **去中心化联邦** 合在一起的自建社交平台：

| 你能做的 | 说明 |
|---------|------|
| 📝 发帖与互动 | 帖子、回复、转发、表情回应、附件 |
| 🌍 跨站交友 | 通过 ActivityPub 与 Mastodon、Pixelfed 等互通 |
| 💬 私信与群聊 | 站内聊天（可配置托管加密） |
| 🎨 高度可定制 | 主题、布局、挂件、自定义表情 |
| 🛡️ 自建与管控 | 注册审批、角色权限、管理后台 |

> 一句话：**数据在自己服务器上，人可以在整个联邦宇宙里认识。**

---

### 一眼看懂架构

```text
┌─────────────┐     WebSocket / REST      ┌──────────────────┐
│  浏览器前端  │ ◄──────────────────────► │  NestJS 后端 API  │
│  Vue 3      │                           │  + 任务队列        │
└─────────────┘                           └────────┬─────────┘
                                                   │
                    ┌──────────────────────────────┼──────────────────────────────┐
                    ▼                              ▼                              ▼
              ┌──────────┐                  ┌──────────┐                  ┌──────────────┐
              │ PostgreSQL│                  │  Redis   │                  │ ActivityPub  │
              │  主数据   │                  │ 缓存/队列 │                  │ 联邦进出站   │
              └──────────┘                  └──────────┘                  └──────────────┘
```

| 层级 | 技术 | 干什么 |
|------|------|--------|
| 前端 | Vue 3 + Vite | 时间线、设置、管理面板 |
| 后端 | NestJS + TypeORM | API、鉴权、业务逻辑 |
| 存储 | PostgreSQL + Redis | 数据持久化、缓存、队列 |
| 联邦 | ActivityPub | 和其他实例互相关注、互动 |
| 部署 | Docker / pnpm | 一键镜像或源码构建 |

---

### ✨ 功能速览

<table>
<tr>
<td width="50%">

#### 用户侧
- 🏠 首页 / 本地 / 社交 / 全局时间线
- 😊 自定义表情、天线、列表、剪贴
- 🖼️ 图库 · Play · 页面 · 网盘
- 🌐 AI 翻译（实例密钥或本机密钥）
- 🔔 通知、公告、主题与调色板

</td>
<td width="50%">

#### 运营侧
- 👥 用户 / 角色 / 邀请 / 审批
- 📦 自定义表情管理
- 🔗 联邦实例与作业队列
- 🤖 AI：翻译 · 审核 · 举报辅助
- 📊 仪表盘图表与关于页统计

</td>
</tr>
</table>

---

### 🚀 快速开始

#### 方式 A：Docker（推荐体验）

```bash
# 镜像（推送 CI 成功后）
docker pull ghcr.io/xiaocongyu66/sharkey-dev:latest

# 或使用仓库内 compose 示例
cp compose_example.yml compose.yml
# 编辑 .config/ 与环境变量后：
docker compose up -d
```

#### 方式 B：源码开发

```bash
# 需要：Node.js 22+、pnpm、PostgreSQL、Redis
git clone https://github.com/xiaocongyu66/Sharkey-dev.git
cd Sharkey-dev
pnpm install
# 配置 .config/default.yml 后
pnpm build
pnpm start
```

更完整的官方安装说明：  
👉 [Sharkey 文档 · 全新安装](https://docs.joinsharkey.org/docs/install/fresh/)

---

### 📦 仓库里有什么

```text
Sharkey-dev/
├── packages/
│   ├── backend/          # API 与联邦核心
│   ├── frontend/         # 主站 Web UI
│   ├── frontend-embed/   # 嵌入页
│   ├── misskey-js/       # API 客户端 SDK
│   └── ...
├── locales/              # 界面多语言
├── sharkey-locales/      # 本分支覆盖翻译
├── .github/workflows/    # CodeQL · Docker 构建
├── Dockerfile
└── compose_example.yml
```

---

### 🔗 相关链接

| | |
|--|--|
| 本仓库 | https://github.com/xiaocongyu66/Sharkey-dev |
| 上游 Sharkey | https://activitypub.software/TransFem-org/Sharkey |
| 官方站点 | https://joinsharkey.org/ |
| 贡献指南 | [CONTRIBUTING.Sharkey.md](./CONTRIBUTING.Sharkey.md) |
| 安全说明 | [SECURITY.md](./SECURITY.md) |
| 升级注意 | [UPGRADE_NOTES.md](./UPGRADE_NOTES.md) |

---

### 📜 许可

AGPL-3.0 — 详见 [LICENSE](./LICENSE) 与 [COPYING](./COPYING)。

---

<br/>

<div align="center">

## 🇬🇧 English

</div>

### What is this?

A **self-hosted social network** that feels like a modern microblog, while speaking **ActivityPub** to the rest of the Fediverse:

| You get | Meaning |
|---------|---------|
| 📝 Posts & reactions | Notes, replies, renotes, emoji reactions, media |
| 🌍 Cross-instance friends | Talk to Mastodon, Pixelfed, and other AP servers |
| 💬 Chat | DMs / rooms (optional escrow encryption) |
| 🎨 Custom UI | Themes, layouts, widgets, custom emoji |
| 🛡️ Ops control | Approvals, roles, admin console |

> In one line: **your data, your server — your social graph can still span the Fediverse.**

---

### Architecture at a glance

```text
┌─────────────┐     WebSocket / REST      ┌──────────────────┐
│  Web client │ ◄──────────────────────► │  NestJS backend   │
│  Vue 3      │                           │  + job queues     │
└─────────────┘                           └────────┬─────────┘
                                                   │
                    ┌──────────────────────────────┼──────────────────────────────┐
                    ▼                              ▼                              ▼
              ┌──────────┐                  ┌──────────┐                  ┌──────────────┐
              │PostgreSQL │                  │  Redis   │                  │ ActivityPub  │
              │  data     │                  │ cache/q  │                  │ federation   │
              └──────────┘                  └──────────┘                  └──────────────┘
```

| Layer | Stack | Role |
|-------|-------|------|
| Frontend | Vue 3 + Vite | Timelines, settings, admin UI |
| Backend | NestJS + TypeORM | API, auth, business logic |
| Storage | PostgreSQL + Redis | Persistence, cache, queues |
| Federation | ActivityPub | Follow & interact across instances |
| Deploy | Docker / pnpm | Image or from-source builds |

---

### ✨ Feature snapshot

<table>
<tr>
<td width="50%">

#### For people
- 🏠 Home / local / social / global timelines
- 😊 Custom emoji, antennas, lists, clips
- 🖼️ Gallery · Play · Pages · Drive
- 🌐 AI translation (instance or device-local keys)
- 🔔 Notifications, announcements, themes

</td>
<td width="50%">

#### For operators
- 👥 Users / roles / invites / approvals
- 📦 Custom emoji management
- 🔗 Federation & job queues
- 🤖 AI: translate · moderate · abuse assist
- 📊 Dashboard charts & about-page stats

</td>
</tr>
</table>

---

### 🚀 Quick start

#### Option A — Docker

```bash
docker pull ghcr.io/xiaocongyu66/sharkey-dev:latest

cp compose_example.yml compose.yml
# configure .config/ and env, then:
docker compose up -d
```

#### Option B — From source

```bash
# Requires Node.js 22+, pnpm, PostgreSQL, Redis
git clone https://github.com/xiaocongyu66/Sharkey-dev.git
cd Sharkey-dev
pnpm install
# configure .config/default.yml
pnpm build
pnpm start
```

Full upstream install guide:  
👉 [Sharkey Docs · Fresh install](https://docs.joinsharkey.org/docs/install/fresh/)

---

### 📦 Repository map

```text
Sharkey-dev/
├── packages/
│   ├── backend/          # API & federation core
│   ├── frontend/         # Main web UI
│   ├── frontend-embed/   # Embed pages
│   ├── misskey-js/       # Typed API client
│   └── ...
├── locales/              # UI strings
├── sharkey-locales/      # Fork-specific overrides
├── .github/workflows/    # CodeQL · Docker image
├── Dockerfile
└── compose_example.yml
```

---

### 🔗 Links

| | |
|--|--|
| This repo | https://github.com/xiaocongyu66/Sharkey-dev |
| Upstream Sharkey | https://activitypub.software/TransFem-org/Sharkey |
| Project site | https://joinsharkey.org/ |
| Contributing | [CONTRIBUTING.Sharkey.md](./CONTRIBUTING.Sharkey.md) |
| Security | [SECURITY.md](./SECURITY.md) |
| Upgrade notes | [UPGRADE_NOTES.md](./UPGRADE_NOTES.md) |

---

### 📜 License

AGPL-3.0 — see [LICENSE](./LICENSE) and [COPYING](./COPYING).

---

<div align="center">

**Built on Sharkey · Powered by the Fediverse**

[文档 Docs](https://docs.joinsharkey.org/) · [Issues](https://github.com/xiaocongyu66/Sharkey-dev/issues) · [Actions](https://github.com/xiaocongyu66/Sharkey-dev/actions)

</div>

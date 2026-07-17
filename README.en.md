# Sharkey-dev

> [English](./README.en.md) · [中文](./README.zh-CN.md)

## Overview

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

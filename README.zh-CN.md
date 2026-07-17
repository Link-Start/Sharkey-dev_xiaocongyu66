# Sharkey-dev

> [English](./README.en.md) · [中文](./README.zh-CN.md)

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


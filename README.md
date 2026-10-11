# OneDB

> 多数据库统一管理工具 —— 一个客户端连接并操作 MySQL / PostgreSQL / MongoDB / SQLite / Redis。

基于 **Electron + React + TypeScript** 构建的桌面应用，提供连接管理、可视化数据网格、SQL 编辑器、表结构编辑、ER 图、MongoDB 文档浏览、Redis 键浏览器等能力，内置中英文界面与深浅色主题。

## ✨ 功能特性

- **多数据库连接**：MySQL、PostgreSQL、MongoDB（含 SRV）、SQLite、Redis，支持连接颜色标记与快速连接。
- **SSH 隧道**：支持密码 / 私钥认证的 SSH 隧道，安全连接远程数据库。
- **对象树浏览**：按 数据库 → Schema → 表 / 集合 / 索引 / 键 层级浏览。
- **数据网格**：分页展示、单元格编辑与真实回写（增 / 删 / 改），支持待提交变更管理。
- **SQL 编辑器**：CodeMirror 语法高亮、格式化、执行与结果集展示。
- **结构编辑器**：可视化编辑列、索引、外键，生成并应用 DDL 变更。
- **ER 图**：基于表关系自动绘制实体关系图。
- **MongoDB**：集合文档表格化展示、过滤、分页与增删改。
- **Redis**：键扫描、类型 / TTL 查看、值编辑与统计。
- **个性化设置**：主题（浅色 / 深色 / 跟随系统）、强调色、界面密度、中英文切换、默认查询行数等。

## 🧰 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面框架 | Electron |
| 构建 | electron-vite + Vite + electron-builder |
| 前端 | React 18 + TypeScript |
| 样式 | Tailwind CSS |
| 编辑器 | CodeMirror (`@uiw/react-codemirror`) |
| ER 图 | `@xyflow/react` |
| 状态管理 | Zustand |
| 数据库驱动 | mysql2、pg、mongodb、ioredis、sql.js、ssh2 |
| 包管理 | pnpm |

## 🚀 快速开始

### 环境要求

- Node.js ≥ 20
- pnpm ≥ 11（`packageManager` 锁定 `pnpm@11`）

### 安装与开发

```bash
# 安装依赖
pnpm install

# 启动开发环境（热重载）
pnpm dev
```

## 📜 可用脚本

```bash
pnpm dev            # 开发模式
pnpm build          # 编译产物到 out/
pnpm start          # 预览构建结果
pnpm typecheck      # 类型检查（node + web）

# 打包安装包（分平台，需在对应系统或用 CI）
pnpm dist:win       # Windows：nsis 安装包 + portable
pnpm dist:mac       # macOS：dmg + zip（x64 / arm64）
pnpm dist:linux     # Linux：AppImage + deb

# 版本号管理
pnpm bump patch                 # 0.1.0 -> 0.1.1（仅改版本号）
pnpm bump minor --tag           # 0.1.0 -> 0.2.0，并 commit + 打 tag
pnpm bump 1.0.0 --tag --push    # 指定版本，打标签并推送
pnpm release                    # 快捷：patch +1 并打标签

# 图标
pnpm gen:icon       # 重新生成 build/icon.png
```

## 📦 打包与发布

应用图标位于 `build/icon.png`，electron-builder 会自动据此生成各平台图标（`.ico` / `.icns`）。

项目内置 GitHub Actions 工作流 [`.github/workflows/build.yml`](.github/workflows/build.yml)：

- 推送 `v*` 标签（或手动触发）时，在 Windows / Linux / macOS 原生 runner 上并行打包；
- 汇总所有安装包，自动创建 / 更新 **GitHub Release**。

一键发版：

```bash
pnpm bump patch --tag --push
# 或
git tag v0.1.1 && git push --follow-tags
```

> macOS 默认跳过代码签名（未签名产物首次打开需右键「打开」）。如需签名 / 公证，请在仓库 Secrets 中配置证书并调整工作流。

## 🗂 项目结构

```
.
├── build/                 # 应用图标等构建资源
├── scripts/               # 辅助脚本（gen-icon / version）
├── src/
│   ├── main/              # Electron 主进程
│   │   └── drivers/       # 各数据库驱动（mysql/postgres/mongo/redis/sqlite）
│   ├── preload/           # contextBridge 暴露的 API（window.onedb）
│   ├── renderer/          # React 渲染层
│   │   └── src/
│   │       ├── components/  # 通用组件（数据网格、树、标签栏等）
│   │       ├── screens/     # 各功能页面
│   │       ├── store/       # Zustand 状态
│   │       └── lib/         # i18n、dbMeta 等
│   └── shared/            # 跨进程共享类型契约
├── electron.vite.config.ts
└── package.json
```

## 📄 License

本项目暂未声明开源许可证。

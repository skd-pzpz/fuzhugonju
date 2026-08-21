# NovelCraft ✨

> AI 驱动的智能小说创作平台，让你的创作之旅更加高效有趣。

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-336791?logo=postgresql&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C4B556?logo=drizzle&logoColor=white)

## 📖 项目简介

NovelCraft 是一个基于 Next.js 的 AI 小说创作平台，集成了智能写作辅助、角色管理、故事线可视化等功能，帮助作家和创作者更高效地完成小说创作。

## 🚀 功能特性

### ✍️ 核心创作
- **富文本编辑器** - 基于 TipTap 的现代化编辑器，支持格式工具栏、快捷键、右键菜单
- **多小说管理** - 创建、编辑、管理多本小说项目
- **章节管理** - 灵活的章节列表，支持排序、重命名、删除

### 🤖 AI 智能助手
- **AI 对话** - 与 AI 助手自由对话，获取创作灵感和建议
- **卡文续写** - 解决写作瓶颈，智能续写下一段内容
- **角色提取** - 自动从文本中识别并提取角色信息
- **多模型支持** - 支持智谱 AI、阿里云通义、DeepSeek、Kimi 等多个模型

### 👥 角色管理
- **角色卡片** - 创建和管理小说角色，包含姓名、描述、外貌等信息
- **角色详情** - 查看完整角色档案，支持 AI 生成角色描述
- **智能提取** - 从已有文本中自动识别角色并生成卡片

### 📊 故事线可视化
- **故事线画布** - 基于 XYFlow 的可视化故事线编辑器
- **剧情节点** - 添加关键剧情节点，清晰展示故事结构

### 🔐 用户认证
- **用户名密码** - 传统的用户名+密码登录注册
- **Passkey** - 基于 WebAuthn 的免密码登录（更安全）

### 🎨 其他特性
- **深色模式** - 支持明亮/深色主题切换
- **响应式设计** - 适配桌面端和移动端
- **实时会话** - AI 对话历史保存与恢复

## 🛠️ 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | Next.js | 16.x |
| UI | React | 19.x |
| 语言 | TypeScript | 5.x |
| 样式 | Tailwind CSS | 4.x |
| 数据库 | PostgreSQL (Supabase) | - |
| ORM | Drizzle ORM | 0.45.x |
| 认证 | NextAuth.js | 5.x |
| 编辑器 | TipTap | 3.x |
| 可视化 | XYFlow | 12.x |
| AI | Vercel AI SDK | 7.x |
| 状态 | Zustand | 5.x |
| 组件 | shadcn/ui | 4.x |

## 📁 项目结构

```
novelcraft/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── actions/            # 服务器端操作（Server Actions）
│   │   ├── api/                # API 路由
│   │   ├── login/              # 登录页面
│   │   ├── novels/             # 小说编辑页面
│   │   └── workspace/          # 工作区（角色、故事线、设置）
│   ├── components/             # React 组件
│   │   ├── ai/                 # AI 相关组件
│   │   ├── character/          # 角色组件
│   │   ├── editor/             # 编辑器组件
│   │   ├── layout/             # 布局组件
│   │   ├── timeline/           # 故事线组件
│   │   └── ui/                 # UI 基础组件（shadcn）
│   ├── db/                     # 数据库配置
│   ├── lib/                    # 工具库
│   │   ├── ai/                 # AI 配置与工具
│   │   └── auth.ts             # Auth.js 配置
│   └── stores/                 # Zustand 状态管理
├── drizzle/                    # 数据库迁移文件
├── public/                     # 静态资源
└── .env.example                # 环境变量模板
```

## 🔧 快速开始

### 环境要求

- Node.js >= 20
- npm >= 9 或 pnpm >= 8

### 安装与配置

1. **克隆项目**
```bash
git clone https://github.com/你的用户名/novelcraft.git
cd novelcraft
```

2. **安装依赖**
```bash
npm install
# 或
pnpm install
```

3. **配置环境变量**
```bash
# 复制模板文件
cp .env.example .env.local

# 编辑 .env.local，填入必要的配置
```

需要配置的环境变量：

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `DATABASE_URL` | Supabase 数据库连接串 | ✅ |
| `AUTH_SECRET` | Auth.js 密钥 | ✅ |
| `ENCRYPTION_KEY` | API Key 加密密钥 | ✅ |
| `ZHIPU_API_KEY` | 智谱 AI API Key | 推荐 |

> 💡 **生成加密密钥**：`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

4. **初始化数据库**
```bash
# 生成迁移
npm run db:generate

# 执行迁移
npm run db:migrate
```

5. **启动开发服务器**
```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 即可使用。

## 📝 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | 代码检查 |
| `npm run typecheck` | 类型检查 |
| `npm run db:generate` | 生成数据库迁移 |
| `npm run db:migrate` | 执行数据库迁移 |
| `npm run db:studio` | 打开 Drizzle Studio |

## 🗄️ 数据库配置

本项目使用 [Supabase](https://supabase.com) 作为数据库服务：

1. 注册 Supabase 账号并创建项目
2. 获取数据库连接串（Pooler 模式，端口 6543）
3. 在 `.env.local` 中配置 `DATABASE_URL`
4. 配置 SSL：在连接串后添加 `?sslmode=require`

## 🤖 AI 模型配置

支持多个 AI 模型提供商，可在设置页面切换：

| 提供商 | 环境变量 | 说明 |
|--------|----------|------|
| 智谱 AI | `ZHIPU_API_KEY` | 默认推荐 |
| 阿里云千问 | `DASHSCOPE_API_KEY` | 可选 |
| DeepSeek | `DEEPSEEK_API_KEY` | 可选 |
| 月之暗面 | `MOONSHOT_API_KEY` | 可选 |
| 字节豆包 | `ARK_API_KEY` | 可选 |

> 💡 可在应用「设置」页面配置自定义 API Key，支持加密存储。

## 🚀 部署

### 腾讯云 CloudBase（推荐）

1. 推送代码到 GitHub
2. 登录 [CloudBase 控制台](https://console.cloud.tencent.com/tcb)
3. 创建环境，进入 CloudBase Run
4. 关联 GitHub 仓库，配置环境变量
5. 一键部署

### Vercel

1. 推送代码到 GitHub
2. 访问 [vercel.com](https://vercel.com)
3. 导入项目，配置环境变量
4. 点击 Deploy

### Docker 部署

```bash
# 构建镜像
docker build -t novelcraft .

# 运行容器
docker run -p 3000:3000 -d \
  -e DATABASE_URL=... \
  -e ZHIPU_API_KEY=... \
  novelcraft
```

## 📄 部署后配置

### Supabase 配置

登录 [Supabase Dashboard](https://supabase.com/dashboard)：

1. **URL 配置**：Authentication → URL Configuration → 添加生产域名为 Authorized URL
2. **数据库连接**：使用 Pooler 模式连接

### Passkey 配置

更新环境变量：
```
WEBAUTHN_RP_ID=你的生产域名
WEBAUTHN_ORIGIN=https://你的生产域名
```

## 🔐 安全说明

- `.env` 文件已在 `.gitignore` 中，不会被提交
- API Key 仅在服务端代码中使用，不会暴露到客户端
- 用户自定义 API Key 使用 AES-256-GCM 加密存储
- 生产环境请使用 HTTPS

## 📄 许可证

本项目仅供学习交流使用。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

<p align="center">
  Made with ❤️ by NovelCraft Team
</p>

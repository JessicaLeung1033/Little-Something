# Little Something 后端方案

## Context
当前 app 是纯前端静态应用，数据全存在浏览器 localStorage 中。换设备或清除浏览器数据就会丢失。需要添加：注册登录、服务端数据存储、多设备同步。

## 推荐方案：Supabase (BaaS)

**为什么不用 Python 后端？**
- 服务器上 Python 版本是 3.6.8（已停止维护），无法运行 FastAPI/现代框架
- Python 方案需要写 1000+ 行代码、14 个新文件、额外部署一个服务器
- Supabase 方案：0 个新服务器、改 3 个现有文件、加 ~300 行代码
- Supabase JS SDK 调用非常直白易读：`supabase.from('moments').select('*')`

**Supabase 提供：**
- 内置认证（邮箱+密码、手机+验证码）
- PostgreSQL 数据库
- 文件存储（照片）
- 免费额度充足（50K 月活、500MB 数据库、1GB 存储）

## 架构

```
浏览器 (app.html/script.js)  ──── supabase-js SDK ────>  Supabase Cloud
                                                          ├── Auth (登录注册)
                                                          ├── PostgreSQL (数据)
                                                          └── Storage (照片)
```

前端直接调用 Supabase SDK，无需中间服务器。Vercel 继续托管静态文件。

## 数据库 Schema

```sql
-- moments 表
CREATE TABLE moments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL DEFAULT '✦',
  photo_path  TEXT,
  text        TEXT NOT NULL DEFAULT '✦',
  color       TEXT NOT NULL DEFAULT '#f7f7f5',
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'collected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- stars 表
CREATE TABLE stars (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  moment_id    UUID NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 行级安全策略（用户只能访问自己的数据）
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own moments" ON moments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own stars" ON stars FOR ALL USING (auth.uid() = user_id);
```

## 照片存储
- 创建 `photos` Storage bucket
- 上传路径: `photos/{user_id}/{moment_id}.jpg`
- 显示时生成签名 URL
- 不再用 base64 存数据库，性能好、可扩展

## 需要修改的文件

| 文件 | 改动 |
| --- | --- |
| `app.html` | 加 Supabase CDN script、加登录/注册页面 HTML |
| `script.js` | 替换 localStorage 为 Supabase 调用、加认证逻辑、改照片处理、加数据迁移 |
| `style.css` | 加登录页样式、加载状态样式 |

## 实现步骤

### Step 1: Supabase 项目配置（需要用户手动）
- 注册 https://supabase.com，创建项目
- 在 SQL Editor 中运行建表语句
- 创建 `photos` Storage bucket
- 开启 Email/Password 认证
- 开启 Phone 认证 + 配置 Twilio（手机验证码需要）
- 复制 Project URL 和 Anon Key

### Step 2: 添加登录/注册 UI
- `app.html` 加 `<script>` 引入 supabase-js
- 新增 auth screen：支持账号密码注册登录或google邮箱授权登录
- `style.css` 加认证页面样式
- 匹配现有设计风格（DM Serif Display、极简线条）

### Step 3: 认证逻辑
- 初始化 Supabase client
- 监听 auth 状态变化
- 未登录 → 显示 auth screen
- 已登录 → 进入主页
- 加登出功能

### Step 4: 数据层替换
- `loadFromStorage()` → `supabase.from('moments').select('*')`
- `saveMoment()` 中的 localStorage → `supabase.from('moments').insert()`
- `collectBubble()` → update moment status + insert star
- `floatMemory()` → update moment status + delete star
- `returnMemoryToBottle()` → 无需改（星星已在数据库中）
- 照片：`FileReader.readAsDataURL` → `supabase.storage.upload()`

### Step 5: localStorage 数据迁移
- 用户首次登录后，检查 localStorage 是否有旧数据
- 有则自动上传到 Supabase（含照片）
- 迁移成功后清除 localStorage

### Step 6: 测试 & 部署
- 本地测试完整流程
- `~/.local/bin/vercel --prod` 部署

## 验证方式
1. 注册新账户 → 能成功登录
2. 创建 moment（含照片）→ 数据出现在 Supabase 后台
3. 换浏览器/设备登录同一账户 → 看到相同数据
4. 原有 localStorage 数据 → 登录后自动迁移

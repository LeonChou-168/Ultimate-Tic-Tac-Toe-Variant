# Vercel 前端部署指南

本文档说明如何把当前项目的**前端**部署到 Vercel，并连接已经部署在 Railway 上的联机后端。

## 1. 推荐部署结构

当前项目推荐使用下面这种拆分：

- **前端**：Vercel
- **联机后端**：Railway

原因：

- Vercel 非常适合当前这套 `Vite + React` 前端
- Railway 更适合当前这套 `Socket.io + Express` 联机后端

---

## 2. 当前前端构建方式

当前仓库已经具备直接部署到 Vercel 的前提：

- `npm run build`
- 输出目录：`dist/`
- 根目录新增：`vercel.json`

`vercel.json` 已经配置：

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

---

## 3. 在 Vercel 上创建项目

1. 打开 Vercel
2. 选择 **New Project**
3. 连接当前 GitHub 仓库
4. 保持项目根目录为仓库根目录

如果 Vercel 没有自动识别：

- **Framework Preset**：Vite
- **Build Command**：`npm run build`
- **Output Directory**：`dist`

---

## 4. 必要环境变量

前端必须配置：

```text
VITE_SOCKET_SERVER_URL=https://your-railway-domain.up.railway.app
```

这会让联机大厅、建房、加入、同步落子都连到 Railway 上的联机服务，而不是本地 `localhost:3001`。

---

## 5. 与 Railway 后端联动

部署前要确保后端已经在 Railway 上可用，并且：

- `CLIENT_ORIGIN` 已经包含你的 Vercel 域名
- Railway 的 `/health` 可以访问

例如后端环境变量：

```text
CLIENT_ORIGIN=https://your-frontend-domain.vercel.app
```

如果同时允许本地联调：

```text
CLIENT_ORIGIN=http://localhost:5175,https://your-frontend-domain.vercel.app
```

---

## 6. 部署后验证

### 基础检查

1. Vercel 页面可正常打开
2. 没有白屏
3. 主菜单能进入联机大厅

### 联机检查

1. 房主进入联机大厅并建房
2. 成功显示房间号
3. 第二位玩家输入房间号加入
4. 房主页显示 `你是黑方`
5. 加入页显示 `你是白方`
6. 房主第一手落子后，加入页同步显示上一手与白方回合
7. 返回菜单后可再次建房

---

## 7. 本地切换到线上后端

如果你想在本地前端里直接连接 Railway 后端，可在项目根目录新建 `.env.local`：

```text
VITE_SOCKET_SERVER_URL=https://your-railway-domain.up.railway.app
```

然后重启前端：

```bash
npm run dev
```

---

## 8. 当前限制

当前版本联机房间仍然保存在后端进程内存里，所以：

- Railway 服务重启后房间会丢失
- 暂不支持多实例房间共享
- 暂不支持观战、匹配、账号和数据库持久化

这对当前双人联机 MVP 是可接受的。

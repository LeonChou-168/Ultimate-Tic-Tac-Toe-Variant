# Railway 联机部署指南

本文档说明如何把当前项目的**联机后端**部署到 Railway，并让前端通过 `VITE_SOCKET_SERVER_URL` 连接公网服务。

## 1. 当前部署结构

推荐采用下面这种拆分：

- **前端**：Vercel 或本地 Vite
- **联机后端**：Railway

这样可以保留你现有的 `Socket.io + Express` 架构，不需要把实时联机改成第三方实时服务。

---

## 2. 后端启动方式

当前仓库已经内置了 Railway 可直接复用的启动脚本：

```bash
npm run server:start
```

对应入口是：

- `server/index.ts`
- `server/config.ts`

另外仓库根目录已经补充了：

- `.env.example`
- `railway.json`

---

## 3. Railway 创建服务

### 第一步：连接仓库

1. 打开 Railway
2. 新建项目
3. 选择 **Deploy from GitHub repo**
4. 连接当前仓库

### 第二步：使用根目录

当前项目不需要拆成子目录服务，直接使用仓库根目录即可。

### 第三步：构建与启动

Railway 默认可直接识别 Node 项目。

如果需要手动确认：

- **Build Command**：`npm install`
- **Start Command**：`npm run server:start`

---

## 4. Railway 环境变量

在 Railway 的 Variables 中配置：

### 必填

```text
CLIENT_ORIGIN=https://your-frontend-domain.vercel.app
```

如果你在开发阶段需要同时允许本地前端和线上前端，可以用逗号分隔：

```text
CLIENT_ORIGIN=http://localhost:5175,https://your-frontend-domain.vercel.app
```

### 可选

```text
ROOM_TTL_MS=1800000
DISCONNECT_GRACE_MS=300000
```

### 不需要手填

```text
PORT
```

`PORT` 由 Railway 注入，后端会自动读取。

---

## 5. 前端环境变量

前端需要配置：

```text
VITE_SOCKET_SERVER_URL=https://your-railway-domain.up.railway.app
```

### Vercel 中配置方式

在 Vercel 项目设置中添加：

```text
VITE_SOCKET_SERVER_URL=https://your-railway-domain.up.railway.app
```

重新部署前端后，联机大厅就会连接到 Railway 上的联机服务。

---

## 6. 本地与线上联调

### 本地后端

```bash
npm run server:dev
```

### 本地前端

```bash
npm run dev
```

### 切换到 Railway 后端

在本地新建 `.env.local`：

```text
VITE_SOCKET_SERVER_URL=https://your-railway-domain.up.railway.app
```

然后重启前端即可。

---

## 7. 上线后验证

部署完成后按下面顺序检查：

### 基础检查

1. Railway 日志里出现：

```text
Ultimate Tic-Tac-Toe Variant server listening on http://localhost:<PORT>
```

2. 访问：

```text
https://your-railway-domain.up.railway.app/health
```

应返回：

```json
{"ok":true}
```

### 联机检查

1. 房主进入联机大厅后点击建房
2. 成功显示房间号
3. 第二位玩家输入房间号后加入
4. 房主页显示 `你是黑方`
5. 加入页显示 `你是白方`
6. 房主第一手落子后，加入页同步显示上一手与白方回合
7. 返回菜单后可再次建房，不出现“已经在房间中”

---

## 8. 当前限制

当前版本仍然是 **进程内存房间**：

- 服务重启后房间不会保留
- 没有数据库
- 没有 Redis
- 没有多实例房间同步

这对当前双人联机 MVP 是可以接受的，但如果后续要做：

- 观战
- 自动匹配
- 断线重连增强
- 多实例扩容

再考虑数据库或 Redis。

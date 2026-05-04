# Ultimate Tic-Tac-Toe Variant

根据 `Ultimate Tic-Tac-Toe Variant 规格说明书.md` 实现的 Web 版终极井字棋变体首个可运行里程碑。

## 已实现

- 本地双人对战。
- 第一手任意落子，后续按上一手位置投影到对应小棋盘。
- 目标小棋盘已占领或填满时自动进入自由落子。
- 小棋盘三连珠占领，占领后禁止继续落子。
- 按占领小棋盘数量结算胜负。
- 主动结算支持“未占领小棋盘均无法再决出胜方”的规则。
- 认输、求和请求与接受/拒绝响应。
- 上一手提示、合法小棋盘高亮、禁用区域弱化。
- 响应式拟 3D 棋盘、木质棋盘、黑白云子风格棋子。
- Vitest 核心规则测试。

## 开发命令

```bash
npm install
npm run dev
npm test
npm run build
```

## 项目结构

```text
src/
├── App.tsx              # 游戏 UI 与交互
├── game/
│   ├── engine.ts        # 纯规则引擎
│   ├── engine.test.ts   # 核心规则测试
│   └── types.ts         # 游戏状态类型
├── main.tsx             # React 入口
└── styles.css           # 视觉与响应式样式
```

## 后续里程碑建议

1. 接入真实音效与可选设置面板。
2. 增加 AI 对战难度。
3. 增加 Socket.io/WebSocket 联机房间与服务端校验。
4. 使用 Three.js / React Three Fiber 升级棋盘材质与光影。

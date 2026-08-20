# SLB 100 · Family Day

React + Three.js 互动展示 — SLB 100 Family Day。任务弹窗内嵌 **MediaPipe GestureRecognizer**，按 `levels.json` 手势序列识别过关。

## 本地开发

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:5173/`（需允许摄像头权限）。

## 构建

```bash
npm run build        # GitHub Pages（base=/SLB100FamilyDay/）
npm run build:local  # 本地预览根路径
npm run preview
```

产物在 `dist/`。静态资源从 `assets/` 复制到 `dist/assets/`。

## 项目结构

| 路径 | 说明 |
|------|------|
| `src/App.tsx` | 主流程：大厅 → 关卡 intro → 任务（手势识别）→ 完成 |
| `src/components/LevelTaskBar.tsx` | 任务弹窗 + 摄像头 + 序列进度 |
| `src/hooks/useGestureRecognizer.ts` | MediaPipe GestureRecognizer |
| `src/hooks/useGestureSequence.ts` | 顺序匹配，保持 1s，错了从当前步继续 |
| `src/lib/gestures/mapping.ts` | `gestureKey` ↔ MediaPipe 分类 + 自定义 landmark 规则 |
| `src/game/createGameEngine.ts` | Three.js 油井模型与关卡 fly/上色 |
| `assets/config/levels.json` | 关卡文案与手势配置 |
| `game.html` | 旧版 vanilla 页面（保留参考） |

## 手势识别

- **MediaPipe 内置**：`thumb_up` → Thumb_Up，`two_fingers` → Victory
- **Landmark 补充**（GestureRecognizer 无对应类）：`half_thumb_up`、`point_diagonal_down`、`point_to_other`
- 关卡 `completionType: "gesture"` 时自动识别；`"manual"` 仍显示「我完成了」

## GitHub Pages

Push to `main` runs `.github/workflows/deploy-pages.yml`, builds `dist/`, publishes to **`gh-pages`** branch.

**One-time setup:** repo **Settings → Pages → Build and deployment → Source:** Deploy from a branch → branch **`gh-pages`** → folder **`/ (root)`**.

Live URL: `https://amory0709.github.io/SLB100FamilyDay/`

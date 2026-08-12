# levels.json — 关卡内容配置

这是 **关卡内容** (文案/任务) 的唯一来源。改这个文件就能改关卡的标题、介绍、任务、奖励 — 不需要碰 `game.html`。

> ⚠️ **3D 位置 (pos/cam/tgt) 不在这里** — 它们在 `game.html` 顶部的 `LEVEL_ROUTE` 数组里,那是给 3D 场景用的,改文案不会动到位置。

---

## 顶层结构

```json
{
  "version": 1,
  "modes": {
    "single": { "intro": "...", "outro": "...", "levels": [...] },
    "couple": { "intro": "...", "outro": "...", "levels": [...] }
  }
}
```

| 字段 | 含义 |
| --- | --- |
| `modes.single` | 单人模式的内容 |
| `modes.couple` | 双人模式的内容 |
| 每个 mode 的 `intro` | 进入模式后的开场白(全模式通用弹窗里) |
| 每个 mode 的 `outro` | 完成全部 4 关后的结语 |
| `levels` | 4 个关卡的数组 |

---

## 每个关卡

```json
{
  "id": 1,
  "title": "Lv1 — 你好 (Hello Friend)",
  "intro": "在 Family Day 我们用手语开启对话...",
  "task": "请在镜头前做出以下手语...",
  "taskIcon": "👋",
  "completionType": "manual",
  "gestures": [
    { "word": "你 (You)",  "hint": "指向对方" },
    { "word": "好 (Good)", "hint": "竖起拇指" }
  ],
  "reward": "「你好」解锁!",
  "color": "#7eedd0"
}
```

| 字段 | 必填 | 含义 |
| --- | --- | --- |
| `id` | ✓ | 1~4,对应 `LEVEL_ROUTE` 里的关卡位置 |
| `title` | ✓ | 弹窗大标题(建议格式 `Lv{N} — 名称`) |
| `intro` | ✓ | 介绍卡正文 — 关卡背景说明 |
| `task` | ✓ | 任务卡正文 — 要做什么 |
| `taskIcon` | | 任务卡左边的大 emoji (默认 🎯) |
| `completionType` | ✓ | `"manual"` = 用户点 [我完成了];其他类型 v1 未实现 |
| `gestures` | | 任务手势清单 — 显示成 chip 列表,无实际识别 |
| `reward` | | 完成卡上的奖励文字 |
| `color` | | 关卡主题色 — 弹窗边条 + marker 配色 |

---

## 怎么编辑

1. **改文案** — 直接编辑对应字段 (title/intro/task/reward)
2. **改/加手势** — 编辑 `gestures` 数组,每项一个对象 `{word, hint}`
3. **改关卡数** — 改 `levels` 数组长度 (注意:目前 UI 假设 4 关;改成 3 关 UI 不会崩,但 Lv4 marker 会变孤儿)
4. **加新关卡** — 复制一个 level 对象,改 `id` + 文案;同时需要在 `game.html` 的 `LEVEL_ROUTE` 里加对应位置
5. **关卡主题色** — 改 `color` 字段(hex 格式),弹窗边框 + marker 颜色会跟着变

---

## 离线/加载失败

`game.html` 里有 `DEFAULT_LEVELS` 兜底 — 如果 `fetch('./assets/config/levels.json')` 失败 (例如 `file://` 打开),会用脚本里的内联备份,内容跟当前 JSON 完全一致,所以本地直接 `open` 也能跑。

> 💡 提示:如果改了 JSON 但页面没更新,可能是浏览器缓存了旧的 JSON。强制刷新 (Cmd+Shift+R) 即可。

---

## 临时占位的关卡

当前 Single 模式 Lv4 + Couple 模式全部 4 关 都是 `[占位 待替换]`,这些是临时内容,真实 Family Day 关卡由你来填。填好之后:
1. 把 `title` 里的 `[占位 待替换]` 去掉
2. 改 `intro` / `task` / `gestures` 为真实内容
3. (可选) 改 `color` 为匹配主题的颜色

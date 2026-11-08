# 影子借步 · 影子踩开关 / Shadow Borrow Step — Shadow on Switch

原创离线益智小游戏原型。你每走一步，影子自动往**相反方向**走一步。场上只有**一个出口**；出口的门默认锁着，必须让**影子踩住开关**门才会开，你才能走进出口通关。

An original offline puzzle prototype. Every step you take, your shadow moves the **opposite** way. There is **one exit**. The door stays locked until the **shadow stands on the switch**; then you may step into the exit to win.

## 怎么玩 / How to play

1. **移动**：键盘方向键或 WASD；手机可滑动棋盘 / 点下方十字键。
2. **反向**：你↑影子↓，你←影子→，以此类推。
3. **开关与门**：影子站在**橙色开关**上 → 门打开（绿色出口）；影子离开 → 门立刻上锁（红色出口）。
4. **通关**：在门开着时，玩家走进**出口**（等价于：移动结束后，玩家在出口且影子仍在开关上）。
5. **钉住**：影子若会撞墙 / 出界，则**停在原地**，你仍可移动——用来把影子钉在开关上，再自己走向出口。
6. **失败 / 阻挡**：你撞墙、出界、踩刺，或影子踩刺 → 该步无效（软失败）；两人重叠 → 挡住。可**撤销**或**重开**。

第 1 关提示：「影子踩住开关，门才开」。

## 本地打开 / Open locally

无需构建。用浏览器直接打开：

```bash
cd shadow-borrow-step
python3 -m http.server 8080
# 然后访问 http://localhost:8080
```

或直接打开 `index.html`。

## 文件

- `index.html` — 页面
- `css/style.css` — 深色手机友好样式（开关发光 / 锁门 vs 开门）
- `js/levels.js` — 5 关（BFS 验证可解）
- `js/game.js` — 逻辑、撤销、选关、触控

## 设计取舍

- **唯一目标**：只盯玩家出口；影子是开门工具，不是第二目标。
- **影子撞墙停住**：实现「先钉开关，再出门」；若双方都因墙整步失败，则无法钉住。
- **锁门不可进**：出口格在影子未踩开关时不可进入（提示「门还锁着」）。
- 重叠格：**阻挡**该步（不判负）。
- 撞墙 / 陷阱 / 出界：**软失败**（不自动重置，方便撤销）。
- 纯 HTML/CSS/JS，无外部资源、无联网。

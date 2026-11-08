(() => {
  "use strict";

  const DIRS = {
    up: [-1, 0],
    down: [1, 0],
    left: [0, -1],
    right: [0, 1],
  };
  const OPP = { up: "down", down: "up", left: "right", right: "left" };
  const DIR_LABEL = { up: "上", down: "下", left: "左", right: "右" };
  const DIR_ARROW = { up: "↑", down: "↓", left: "←", right: "→" };
  const JUMP_CH = { U: "up", D: "down", L: "left", R: "right" };
  const ONEWAY_CH = { ">": "right", "<": "left", "^": "up", v: "down" };
  const KEY_MAP = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    s: "down",
    a: "left",
    d: "right",
    W: "up",
    S: "down",
    A: "left",
    D: "right",
  };

  const STORAGE_KEY = "shadow-borrow-step-progress";
  const AD_FREE_MAX_LEVEL = 10; // levels 1–10 hints free; 11+ need ad
  const AD_SECONDS = 2.5;

  const els = {
    board: document.getElementById("board"),
    levelLabel: document.getElementById("level-label"),
    moveCount: document.getElementById("move-count"),
    doorState: document.getElementById("door-state"),
    tip: document.getElementById("tip"),
    status: document.getElementById("status"),
    btnRestart: document.getElementById("btn-restart"),
    btnUndo: document.getElementById("btn-undo"),
    btnNext: document.getElementById("btn-next"),
    btnHint: document.getElementById("btn-hint"),
    levelSelect: document.getElementById("level-select"),
    overlay: document.getElementById("overlay"),
    overlayTitle: document.getElementById("overlay-title"),
    overlayMsg: document.getElementById("overlay-msg"),
    overlayNext: document.getElementById("overlay-next"),
    overlayReplay: document.getElementById("overlay-replay"),
    overlayClose: document.getElementById("overlay-close"),
    adOverlay: document.getElementById("ad-overlay"),
    adTitle: document.getElementById("ad-title"),
    adMsg: document.getElementById("ad-msg"),
    adCountdown: document.getElementById("ad-countdown"),
    hintOverlay: document.getElementById("hint-overlay"),
    hintTitle: document.getElementById("hint-title"),
    hintMsg: document.getElementById("hint-msg"),
    hintClose: document.getElementById("hint-close"),
  };

  const state = {
    levelIndex: 0,
    rows: 0,
    cols: 0,
    walls: new Set(),
    hazards: new Set(),
    ice: new Set(),
    jumps: new Map(), // key -> dir
    oneway: new Map(), // key -> dir
    portalA: null,
    portalB: null,
    exit: null,
    switchPos: null,
    player: null,
    shadow: null,
    moves: 0,
    history: [],
    won: false,
    maxCleared: 0, // highest level id cleared (1-based); unlocks maxCleared+1
    cleared: new Set(), // 0-based indices
    hintUnlocked: new Set(), // level ids (1-based) unlocked via ad this session
    hintArrow: null, // dir to highlight
    adTimer: null,
  };

  function key(r, c) {
    return `${r},${c}`;
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      state.maxCleared = Math.max(0, Number(data.maxCleared) || 0);
      state.cleared = new Set(
        (data.cleared || []).map((n) => Number(n)).filter((n) => n >= 0)
      );
    } catch (_) {
      /* ignore */
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          maxCleared: state.maxCleared,
          cleared: [...state.cleared],
        })
      );
    } catch (_) {
      /* ignore */
    }
  }

  /** Level index is playable if id <= maxCleared+1 (sequential) or already cleared. */
  function isUnlocked(index) {
    const id = window.SHADOW_LEVELS[index].id;
    return id <= state.maxCleared + 1;
  }

  function parseLevel(level) {
    const map = level.map;
    const rows = map.length;
    const cols = map[0].length;
    const walls = new Set();
    const hazards = new Set();
    const ice = new Set();
    const jumps = new Map();
    const oneway = new Map();
    let player = null;
    let shadow = null;
    let exit = null;
    let switchPos = null;
    let portalA = null;
    let portalB = null;

    for (let r = 0; r < rows; r++) {
      if (map[r].length !== cols) {
        throw new Error(`Level ${level.id} row ${r} width mismatch`);
      }
      for (let c = 0; c < cols; c++) {
        const ch = map[r][c];
        const k = key(r, c);
        if (ch === "#") walls.add(k);
        else if (ch === "X") hazards.add(k);
        else if (ch === "I") ice.add(k);
        else if (JUMP_CH[ch]) jumps.set(k, JUMP_CH[ch]);
        else if (ONEWAY_CH[ch]) oneway.set(k, ONEWAY_CH[ch]);
        else if (ch === "A") portalA = { r, c };
        else if (ch === "B") portalB = { r, c };
        else if (ch === "@") {
          portalB = { r, c };
          exit = { r, c };
        } else if (ch === "P" || ch === "p") player = { r, c };
        else if (ch === "S" || ch === "s") shadow = { r, c };
        else if (ch === "E" || ch === "e") exit = { r, c };
        else if (ch === "W" || ch === "w") switchPos = { r, c };
      }
    }

    if (!player || !shadow || !exit || !switchPos) {
      throw new Error(`Level ${level.id} missing markers`);
    }
    if ((portalA && !portalB) || (!portalA && portalB)) {
      throw new Error(`Level ${level.id} incomplete portals`);
    }

    return {
      rows,
      cols,
      walls,
      hazards,
      ice,
      jumps,
      oneway,
      player,
      shadow,
      exit,
      switchPos,
      portalA,
      portalB,
    };
  }

  function clonePos(p) {
    return { r: p.r, c: p.c };
  }

  function samePos(a, b) {
    return a && b && a.r === b.r && a.c === b.c;
  }

  function isDoorOpen() {
    return samePos(state.shadow, state.switchPos);
  }

  function loadLevel(index, force) {
    const levels = window.SHADOW_LEVELS;
    const clamped = Math.max(0, Math.min(index, levels.length - 1));
    if (!force && !isUnlocked(clamped)) {
      flashStatus("关卡未解锁 · 请按顺序通关", "fail");
      return;
    }
    state.levelIndex = clamped;
    const parsed = parseLevel(levels[clamped]);
    state.rows = parsed.rows;
    state.cols = parsed.cols;
    state.walls = parsed.walls;
    state.hazards = parsed.hazards;
    state.ice = parsed.ice;
    state.jumps = parsed.jumps;
    state.oneway = parsed.oneway;
    state.portalA = parsed.portalA;
    state.portalB = parsed.portalB;
    state.exit = parsed.exit;
    state.switchPos = parsed.switchPos;
    state.player = clonePos(parsed.player);
    state.shadow = clonePos(parsed.shadow);
    state.moves = 0;
    state.history = [];
    state.won = false;
    state.hintArrow = null;
    hideOverlay();
    hideHintOverlay();
    renderLevelSelect();
    renderAll();
    updateButtons();
  }

  function inBounds(r, c) {
    return r >= 0 && c >= 0 && r < state.rows && c < state.cols;
  }

  function isWallOrOob(r, c) {
    return !inBounds(r, c) || state.walls.has(key(r, c));
  }

  function isHazard(r, c) {
    return inBounds(r, c) && state.hazards.has(key(r, c));
  }

  function resolveEntity(start, moveDir, other) {
    let r = start.r;
    let c = start.c;
    const otherKey = other ? key(other.r, other.c) : null;

    // Ice
    if (moveDir && state.ice.has(key(r, c))) {
      const [dr, dc] = DIRS[moveDir];
      for (let i = 0; i < 40; i++) {
        const nr = r + dr;
        const nc = c + dc;
        if (isWallOrOob(nr, nc) || isHazard(nr, nc)) break;
        if (otherKey && key(nr, nc) === otherKey) break;
        const ow = state.oneway.get(key(nr, nc));
        if (ow && ow !== moveDir) break;
        r = nr;
        c = nc;
        if (!state.ice.has(key(r, c))) break;
      }
    }

    // Jump: leap 2 cells (skip intermediate); fallback 1 if 2 blocked
    const jd = state.jumps.get(key(r, c));
    if (jd) {
      const [dr, dc] = DIRS[jd];
      const tryLand = (dist) => {
        const nr = r + dist * dr;
        const nc = c + dist * dc;
        if (isWallOrOob(nr, nc) || isHazard(nr, nc)) return null;
        if (otherKey && key(nr, nc) === otherKey) return null;
        const ow = state.oneway.get(key(nr, nc));
        if (ow && ow !== jd) return null;
        return { r: nr, c: nc };
      };
      const land2 = tryLand(2);
      if (land2) {
        r = land2.r;
        c = land2.c;
      } else {
        const land1 = tryLand(1);
        if (land1) {
          r = land1.r;
          c = land1.c;
        }
      }
    }

    // Portal
    if (state.portalA && state.portalB) {
      if (r === state.portalA.r && c === state.portalA.c) {
        if (
          !(other && other.r === state.portalB.r && other.c === state.portalB.c)
        ) {
          r = state.portalB.r;
          c = state.portalB.c;
        }
      } else if (r === state.portalB.r && c === state.portalB.c) {
        if (
          !(other && other.r === state.portalA.r && other.c === state.portalA.c)
        ) {
          r = state.portalA.r;
          c = state.portalA.c;
        }
      }
    }

    return { r, c };
  }

  function tryMove(dir) {
    if (state.won) return;
    const delta = DIRS[dir];
    if (!delta) return;

    const nr = state.player.r + delta[0];
    const nc = state.player.c + delta[1];
    const opp = DIRS[OPP[dir]];
    let sr = state.shadow.r + opp[0];
    let sc = state.shadow.c + opp[1];
    let shadowParked = false;
    let sDir = OPP[dir];

    if (isWallOrOob(nr, nc)) {
      softFail(!inBounds(nr, nc) ? "走出边界了" : "撞墙了");
      return;
    }
    if (isHazard(nr, nc)) {
      softFail("踩到陷阱了");
      return;
    }
    const owP = state.oneway.get(key(nr, nc));
    if (owP && owP !== dir) {
      softFail("单向道 · 方向不对");
      return;
    }

    if (isHazard(sr, sc)) {
      softFail("影子踩到陷阱了");
      return;
    }

    if (isWallOrOob(sr, sc)) {
      sr = state.shadow.r;
      sc = state.shadow.c;
      shadowParked = true;
      sDir = null;
    } else {
      const owS = state.oneway.get(key(sr, sc));
      if (owS && owS !== OPP[dir]) {
        sr = state.shadow.r;
        sc = state.shadow.c;
        shadowParked = true;
        sDir = null;
      }
    }

    const sBasic = { r: sr, c: sc };
    const pFinal = resolveEntity({ r: nr, c: nc }, dir, sBasic);
    const sFinal = resolveEntity(sBasic, sDir, pFinal);

    if (pFinal.r === sFinal.r && pFinal.c === sFinal.c) {
      flashStatus("不能重叠", "fail");
      bumpPieces();
      return;
    }

    const shadowOnSwitchAfter =
      sFinal.r === state.switchPos.r && sFinal.c === state.switchPos.c;
    const playerOnExitAfter =
      pFinal.r === state.exit.r && pFinal.c === state.exit.c;

    if (playerOnExitAfter && !shadowOnSwitchAfter) {
      softFail("门还锁着 · 影子需踩住开关");
      return;
    }

    state.history.push({
      player: clonePos(state.player),
      shadow: clonePos(state.shadow),
      moves: state.moves,
    });

    state.player = pFinal;
    state.shadow = sFinal;
    state.moves += 1;
    state.hintArrow = null;

    renderPieces();
    updateHud();
    updateButtons();

    if (playerOnExitAfter && shadowOnSwitchAfter) {
      state.won = true;
      state.cleared.add(state.levelIndex);
      const id = window.SHADOW_LEVELS[state.levelIndex].id;
      if (id > state.maxCleared) state.maxCleared = id;
      saveProgress();
      renderLevelSelect();
      updateButtons();
      showWin();
    } else if (shadowParked && shadowOnSwitchAfter) {
      flashStatus("影子钉在开关上 · 门已开", "info");
    } else if (shadowOnSwitchAfter) {
      flashStatus("开关已踩下 · 门开了", "info");
    } else {
      clearStatus();
    }
  }

  function softFail(reason) {
    bumpPieces();
    flashStatus(`${reason} · 可撤销或重开`, "fail");
  }

  function bumpPieces() {
    const nodes = els.board.querySelectorAll(".piece");
    nodes.forEach((n) => {
      n.classList.remove("bump");
      void n.offsetWidth;
      n.classList.add("bump");
    });
  }

  function undo() {
    if (state.won || state.history.length === 0) return;
    const prev = state.history.pop();
    state.player = prev.player;
    state.shadow = prev.shadow;
    state.moves = prev.moves;
    state.hintArrow = null;
    clearStatus();
    renderPieces();
    updateHud();
    updateButtons();
  }

  function restart() {
    loadLevel(state.levelIndex, true);
  }

  function nextLevel() {
    if (state.levelIndex < window.SHADOW_LEVELS.length - 1) {
      loadLevel(state.levelIndex + 1);
    }
  }

  // --- Hints & simulated ads ---

  function levelNeedsAd() {
    const id = window.SHADOW_LEVELS[state.levelIndex].id;
    return id > AD_FREE_MAX_LEVEL;
  }

  function hintAlreadyUnlocked() {
    const id = window.SHADOW_LEVELS[state.levelIndex].id;
    return state.hintUnlocked.has(id);
  }

  function onHintClick() {
    if (state.won) return;
    if (levelNeedsAd() && !hintAlreadyUnlocked()) {
      startAdThenHint();
    } else {
      showHint();
    }
  }

  function startAdThenHint() {
    if (!els.adOverlay) return;
    els.adTitle.textContent = "观看广告中…";
    els.adMsg.textContent = "看完广告即可解锁本关提示（原型模拟，无真实广告）";
    els.adCountdown.textContent = AD_SECONDS.toFixed(1);
    els.adOverlay.classList.add("show");

    const start = performance.now();
    const total = AD_SECONDS * 1000;
    if (state.adTimer) cancelAnimationFrame(state.adTimer);

    const tick = (now) => {
      const left = Math.max(0, total - (now - start));
      els.adCountdown.textContent = (left / 1000).toFixed(1);
      if (left <= 0) {
        const id = window.SHADOW_LEVELS[state.levelIndex].id;
        state.hintUnlocked.add(id);
        els.adTitle.textContent = "广告结束，提示已解锁";
        els.adMsg.textContent = "正在显示提示…";
        els.adCountdown.textContent = "0.0";
        setTimeout(() => {
          els.adOverlay.classList.remove("show");
          showHint();
        }, 600);
        return;
      }
      state.adTimer = requestAnimationFrame(tick);
    };
    state.adTimer = requestAnimationFrame(tick);
  }

  /** BFS from current state for next best move; fallback to canned solution. */
  function computeHint() {
    const lv = window.SHADOW_LEVELS[state.levelIndex];
    const next = bfsNextDir();
    if (next) {
      return {
        dir: next.dir,
        text: `下一步建议：${DIR_LABEL[next.dir]} ${DIR_ARROW[next.dir]}（约 ${next.len} 步可解）`,
      };
    }
    if (lv.solution && lv.solution.length) {
      // Fallback: first move of canned solution only useful at start
      if (state.moves === 0) {
        const d = lv.solution[0];
        return {
          dir: d,
          text: lv.hintText || `推荐：${DIR_LABEL[d]} ${DIR_ARROW[d]}`,
        };
      }
      return {
        dir: null,
        text: lv.hintText || "试试撤销后换条路线；影子要踩住开关门才开。",
      };
    }
    return { dir: null, text: "让影子踩住开关，再走进出口。" };
  }

  function bfsNextDir() {
    const startP = clonePos(state.player);
    const startS = clonePos(state.shadow);
    const q = [{ p: startP, s: startS, path: [] }];
    const seen = new Set([`${key(startP.r, startP.c)}|${key(startS.r, startS.c)}`]);
    const order = ["up", "down", "left", "right"];

    while (q.length) {
      const cur = q.shift();
      if (cur.path.length > 80) continue;
      for (const d of order) {
        const res = simulateMove(cur.p, cur.s, d);
        if (!res) continue;
        const npath = cur.path.concat([d]);
        if (res.won) {
          return { dir: npath[0], len: npath.length };
        }
        const sk = `${key(res.p.r, res.p.c)}|${key(res.s.r, res.s.c)}`;
        if (!seen.has(sk)) {
          seen.add(sk);
          q.push({ p: res.p, s: res.s, path: npath });
        }
      }
    }
    return null;
  }

  function simulateMove(player, shadow, dir) {
    const delta = DIRS[dir];
    const opp = DIRS[OPP[dir]];
    const nr = player.r + delta[0];
    const nc = player.c + delta[1];
    let sr = shadow.r + opp[0];
    let sc = shadow.c + opp[1];
    let sDir = OPP[dir];

    if (isWallOrOob(nr, nc) || isHazard(nr, nc)) return null;
    const owP = state.oneway.get(key(nr, nc));
    if (owP && owP !== dir) return null;
    if (isHazard(sr, sc)) return null;

    if (isWallOrOob(sr, sc)) {
      sr = shadow.r;
      sc = shadow.c;
      sDir = null;
    } else {
      const owS = state.oneway.get(key(sr, sc));
      if (owS && owS !== OPP[dir]) {
        sr = shadow.r;
        sc = shadow.c;
        sDir = null;
      }
    }

    const sBasic = { r: sr, c: sc };
    // temporarily use resolve with given positions — resolveEntity reads state.* tiles only
    const pFinal = resolveEntity({ r: nr, c: nc }, dir, sBasic);
    const sFinal = resolveEntity(sBasic, sDir, pFinal);
    if (pFinal.r === sFinal.r && pFinal.c === sFinal.c) return null;

    const shadowOn =
      sFinal.r === state.switchPos.r && sFinal.c === state.switchPos.c;
    const playerOn = pFinal.r === state.exit.r && pFinal.c === state.exit.c;
    if (playerOn && !shadowOn) return null;
    return { p: pFinal, s: sFinal, won: playerOn && shadowOn };
  }

  function showHint() {
    const h = computeHint();
    state.hintArrow = h.dir;
    renderPieces();
    if (els.hintOverlay) {
      els.hintTitle.textContent = "提示";
      els.hintMsg.textContent = h.text;
      els.hintOverlay.classList.add("show");
    } else {
      flashStatus(h.text, "info");
    }
  }

  function hideHintOverlay() {
    if (els.hintOverlay) els.hintOverlay.classList.remove("show");
  }

  function updateHud() {
    const lv = window.SHADOW_LEVELS[state.levelIndex];
    els.levelLabel.textContent = `第 ${lv.id} 关 · ${lv.name}`;
    els.moveCount.textContent = `步数 ${state.moves}`;
    els.tip.textContent = lv.tip || "";
    const open = isDoorOpen();
    els.doorState.textContent = open ? "门：开" : "门：锁";
    els.doorState.className = "door-state " + (open ? "open" : "locked");
  }

  function updateButtons() {
    els.btnUndo.disabled = state.won || state.history.length === 0;
    const canNext =
      state.won && state.levelIndex < window.SHADOW_LEVELS.length - 1;
    els.btnNext.disabled = !canNext;
    els.btnRestart.disabled = false;
    if (els.btnHint) {
      els.btnHint.disabled = state.won;
      const needs = levelNeedsAd() && !hintAlreadyUnlocked();
      els.btnHint.textContent = needs ? "提示 (广告)" : "提示";
    }
  }

  function clearStatus() {
    els.status.textContent = "";
    els.status.className = "status";
  }

  function flashStatus(msg, cls) {
    els.status.textContent = msg;
    els.status.className = `status ${cls || ""}`;
  }

  function showWin() {
    const lv = window.SHADOW_LEVELS[state.levelIndex];
    const last = state.levelIndex >= window.SHADOW_LEVELS.length - 1;
    flashStatus(`通关！共用 ${state.moves} 步`, "win");
    els.overlayTitle.textContent = `第 ${lv.id} 关通关`;
    els.overlayMsg.textContent = last
      ? `全部 20 关完成！本关 ${state.moves} 步。影子踩开关，你走出门——谢谢试玩。`
      : `用了 ${state.moves} 步。已解锁第 ${lv.id + 1} 关。`;
    els.overlayNext.style.display = last ? "none" : "inline-block";
    els.overlay.classList.add("show");
  }

  function hideOverlay() {
    els.overlay.classList.remove("show");
  }

  function renderLevelSelect() {
    els.levelSelect.innerHTML = "";
    window.SHADOW_LEVELS.forEach((lv, i) => {
      const btn = document.createElement("button");
      const unlocked = isUnlocked(i);
      const cleared = state.cleared.has(i);
      btn.textContent = cleared ? `${lv.id}✓` : String(lv.id);
      btn.title = unlocked
        ? lv.name
        : `${lv.name}（未解锁）`;
      if (i === state.levelIndex) btn.classList.add("current");
      if (cleared) btn.classList.add("cleared");
      if (!unlocked) {
        btn.classList.add("locked");
        btn.disabled = true;
      } else {
        btn.addEventListener("click", () => loadLevel(i));
      }
      els.levelSelect.appendChild(btn);
    });
  }

  function cellClasses(r, c) {
    const k = key(r, c);
    const classes = ["cell"];
    if ((r + c) % 2 === 1) classes.push("alt");
    if (state.walls.has(k)) classes.push("wall");
    if (state.hazards.has(k)) classes.push("hazard");
    if (state.ice.has(k)) classes.push("ice");
    if (state.jumps.has(k)) {
      classes.push("jump");
      classes.push("jump-" + state.jumps.get(k));
    }
    if (state.oneway.has(k)) {
      classes.push("oneway");
      classes.push("oneway-" + state.oneway.get(k));
    }
    if (state.portalA && state.portalA.r === r && state.portalA.c === c) {
      classes.push("portal", "portal-a");
    }
    if (state.portalB && state.portalB.r === r && state.portalB.c === c) {
      classes.push("portal", "portal-b");
    }

    const isExit = state.exit.r === r && state.exit.c === c;
    const isSwitch = state.switchPos.r === r && state.switchPos.c === c;
    const doorOpen = isDoorOpen();

    if (isSwitch) {
      classes.push("switch");
      if (doorOpen) classes.push("switch-on");
    }
    if (isExit) {
      classes.push("exit");
      classes.push(doorOpen ? "exit-open" : "exit-locked");
    }
    return classes.join(" ");
  }

  function renderAll() {
    updateHud();
    els.board.style.gridTemplateColumns = `repeat(${state.cols}, var(--cell))`;
    els.board.innerHTML = "";
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const div = document.createElement("div");
        div.className = cellClasses(r, c);
        div.dataset.r = String(r);
        div.dataset.c = String(c);

        if (state.exit.r === r && state.exit.c === c) {
          const badge = document.createElement("span");
          badge.className = "tile-badge exit-badge";
          badge.textContent = isDoorOpen() ? "开" : "锁";
          div.appendChild(badge);
        }
        if (state.switchPos.r === r && state.switchPos.c === c) {
          const badge = document.createElement("span");
          badge.className = "tile-badge switch-badge";
          badge.textContent = "◎";
          div.appendChild(badge);
        }
        if (state.jumps.has(key(r, c))) {
          const badge = document.createElement("span");
          badge.className = "tile-badge jump-badge";
          badge.textContent = DIR_ARROW[state.jumps.get(key(r, c))];
          div.appendChild(badge);
        }
        if (state.oneway.has(key(r, c))) {
          const badge = document.createElement("span");
          badge.className = "tile-badge oneway-badge";
          badge.textContent = DIR_ARROW[state.oneway.get(key(r, c))];
          div.appendChild(badge);
        }
        if (state.portalA && state.portalA.r === r && state.portalA.c === c) {
          const badge = document.createElement("span");
          badge.className = "tile-badge portal-badge";
          badge.textContent = "A";
          div.appendChild(badge);
        }
        if (state.portalB && state.portalB.r === r && state.portalB.c === c) {
          const badge = document.createElement("span");
          badge.className = "tile-badge portal-badge";
          badge.textContent = "B";
          div.appendChild(badge);
        }
        if (state.ice.has(key(r, c))) {
          const badge = document.createElement("span");
          badge.className = "tile-badge ice-badge";
          badge.textContent = "❄";
          div.appendChild(badge);
        }

        els.board.appendChild(div);
      }
    }
    renderPieces();
    clearStatus();
  }

  function refreshTileStates() {
    const doorOpen = isDoorOpen();
    const cells = els.board.children;
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cell = cells[r * state.cols + c];
        if (!cell) continue;
        const isExit = state.exit.r === r && state.exit.c === c;
        const isSwitch = state.switchPos.r === r && state.switchPos.c === c;
        if (isSwitch) cell.classList.toggle("switch-on", doorOpen);
        if (isExit) {
          cell.classList.toggle("exit-open", doorOpen);
          cell.classList.toggle("exit-locked", !doorOpen);
          const badge = cell.querySelector(".exit-badge");
          if (badge) badge.textContent = doorOpen ? "开" : "锁";
        }
      }
    }
  }

  function renderPieces() {
    els.board.querySelectorAll(".piece, .hint-arrow").forEach((n) => n.remove());
    const cells = els.board.children;
    const idx = (r, c) => r * state.cols + c;

    refreshTileStates();

    if (!state.walls.has(key(state.player.r, state.player.c))) {
      const p = document.createElement("div");
      p.className = "piece player";
      p.textContent = "🧑";
      p.setAttribute("aria-label", "玩家");
      cells[idx(state.player.r, state.player.c)].appendChild(p);
    }

    if (!state.walls.has(key(state.shadow.r, state.shadow.c))) {
      const s = document.createElement("div");
      s.className = "piece shadow";
      if (isDoorOpen()) s.classList.add("on-switch");
      s.textContent = "👤";
      s.setAttribute("aria-label", "影子");
      cells[idx(state.shadow.r, state.shadow.c)].appendChild(s);
    }

    if (state.hintArrow && DIRS[state.hintArrow]) {
      const [dr, dc] = DIRS[state.hintArrow];
      const hr = state.player.r + dr;
      const hc = state.player.c + dc;
      if (inBounds(hr, hc) && !state.walls.has(key(hr, hc))) {
        const arrow = document.createElement("div");
        arrow.className = "hint-arrow";
        arrow.textContent = DIR_ARROW[state.hintArrow];
        cells[idx(hr, hc)].appendChild(arrow);
      }
    }
  }

  // --- Input ---
  window.addEventListener("keydown", (e) => {
    if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      undo();
      return;
    }
    if (e.key === "r" || e.key === "R") {
      restart();
      return;
    }
    if (e.key === "h" || e.key === "H") {
      onHintClick();
      return;
    }
    const dir = KEY_MAP[e.key];
    if (dir) {
      e.preventDefault();
      tryMove(dir);
    }
  });

  document.querySelectorAll(".dpad [data-dir]").forEach((btn) => {
    btn.addEventListener("click", () => tryMove(btn.dataset.dir));
  });

  let touchStart = null;
  const SWIPE_MIN = 24;

  function onSwipeEnd(e) {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      tryMove(dx > 0 ? "right" : "left");
    } else {
      tryMove(dy > 0 ? "down" : "up");
    }
  }

  els.board.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) return;
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    },
    { passive: true }
  );
  els.board.addEventListener("touchend", onSwipeEnd, { passive: true });

  const playArea = document.getElementById("play-area");
  playArea.addEventListener(
    "touchstart",
    (e) => {
      if (e.target.closest("button")) return;
      if (e.touches.length !== 1) return;
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    },
    { passive: true }
  );
  playArea.addEventListener(
    "touchend",
    (e) => {
      if (e.target.closest("button")) return;
      onSwipeEnd(e);
    },
    { passive: true }
  );

  els.btnRestart.addEventListener("click", restart);
  els.btnUndo.addEventListener("click", undo);
  els.btnNext.addEventListener("click", nextLevel);
  if (els.btnHint) els.btnHint.addEventListener("click", onHintClick);
  els.overlayNext.addEventListener("click", () => {
    hideOverlay();
    nextLevel();
  });
  els.overlayReplay.addEventListener("click", () => {
    hideOverlay();
    restart();
  });
  els.overlayClose.addEventListener("click", hideOverlay);
  if (els.hintClose) {
    els.hintClose.addEventListener("click", hideHintOverlay);
  }

  loadProgress();
  loadLevel(Math.min(state.maxCleared, window.SHADOW_LEVELS.length - 1), true);
})();

(() => {
  "use strict";

  const DIRS = {
    up: [-1, 0],
    down: [1, 0],
    left: [0, -1],
    right: [0, 1],
  };
  const OPP = { up: "down", down: "up", left: "right", right: "left" };
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
    levelSelect: document.getElementById("level-select"),
    overlay: document.getElementById("overlay"),
    overlayTitle: document.getElementById("overlay-title"),
    overlayMsg: document.getElementById("overlay-msg"),
    overlayNext: document.getElementById("overlay-next"),
    overlayReplay: document.getElementById("overlay-replay"),
    overlayClose: document.getElementById("overlay-close"),
  };

  const state = {
    levelIndex: 0,
    rows: 0,
    cols: 0,
    walls: new Set(),
    hazards: new Set(),
    exit: null,
    switchPos: null,
    player: null,
    shadow: null,
    moves: 0,
    history: [],
    won: false,
    cleared: new Set(),
  };

  function key(r, c) {
    return `${r},${c}`;
  }

  function parseLevel(level) {
    const map = level.map;
    const rows = map.length;
    const cols = map[0].length;
    const walls = new Set();
    const hazards = new Set();
    let player = null;
    let shadow = null;
    let exit = null;
    let switchPos = null;

    for (let r = 0; r < rows; r++) {
      if (map[r].length !== cols) {
        throw new Error(`Level ${level.id} row ${r} width mismatch`);
      }
      for (let c = 0; c < cols; c++) {
        const ch = map[r][c];
        const k = key(r, c);
        switch (ch) {
          case "#":
            walls.add(k);
            break;
          case "X":
            hazards.add(k);
            break;
          case "P":
          case "p":
            player = { r, c };
            break;
          case "S":
          case "s":
            shadow = { r, c };
            break;
          case "E":
          case "e":
            exit = { r, c };
            break;
          case "W":
          case "w":
            switchPos = { r, c };
            break;
          case ".":
            break;
          default:
            break;
        }
      }
    }

    if (!player || !shadow || !exit || !switchPos) {
      throw new Error(`Level ${level.id} missing markers`);
    }

    return { rows, cols, walls, hazards, player, shadow, exit, switchPos };
  }

  function clonePos(p) {
    return { r: p.r, c: p.c };
  }

  function samePos(a, b) {
    return a.r === b.r && a.c === b.c;
  }

  function isDoorOpen() {
    return samePos(state.shadow, state.switchPos);
  }

  function loadLevel(index) {
    const levels = window.SHADOW_LEVELS;
    const clamped = Math.max(0, Math.min(index, levels.length - 1));
    state.levelIndex = clamped;
    const parsed = parseLevel(levels[clamped]);
    state.rows = parsed.rows;
    state.cols = parsed.cols;
    state.walls = parsed.walls;
    state.hazards = parsed.hazards;
    state.exit = parsed.exit;
    state.switchPos = parsed.switchPos;
    state.player = clonePos(parsed.player);
    state.shadow = clonePos(parsed.shadow);
    state.moves = 0;
    state.history = [];
    state.won = false;
    hideOverlay();
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

  function tryMove(dir) {
    if (state.won) return;
    const delta = DIRS[dir];
    const opp = DIRS[OPP[dir]];
    if (!delta) return;

    const nr = state.player.r + delta[0];
    const nc = state.player.c + delta[1];
    let sr = state.shadow.r + opp[0];
    let sc = state.shadow.c + opp[1];
    let shadowParked = false;

    // Player soft-fail: wall / oob / hazard
    if (isWallOrOob(nr, nc)) {
      softFail(!inBounds(nr, nc) ? "走出边界了" : "撞墙了");
      return;
    }
    if (isHazard(nr, nc)) {
      softFail("踩到陷阱了");
      return;
    }

    // Shadow hazard ⇒ soft fail
    if (isHazard(sr, sc)) {
      softFail("影子踩到陷阱了");
      return;
    }

    // Shadow wall/oob ⇒ park (stay)
    if (isWallOrOob(sr, sc)) {
      sr = state.shadow.r;
      sc = state.shadow.c;
      shadowParked = true;
    }

    // Overlap ⇒ block
    if (nr === sr && nc === sc) {
      flashStatus("不能重叠", "fail");
      bumpPieces();
      return;
    }

    const shadowOnSwitchAfter = sr === state.switchPos.r && sc === state.switchPos.c;
    const playerOnExitAfter = nr === state.exit.r && nc === state.exit.c;

    // Locked exit: cannot enter unless shadow ends on switch (winning step)
    if (playerOnExitAfter && !shadowOnSwitchAfter) {
      softFail("门还锁着 · 影子需踩住开关");
      return;
    }

    state.history.push({
      player: clonePos(state.player),
      shadow: clonePos(state.shadow),
      moves: state.moves,
    });

    state.player = { r: nr, c: nc };
    state.shadow = { r: sr, c: sc };
    state.moves += 1;

    renderPieces();
    updateHud();
    updateButtons();

    if (playerOnExitAfter && shadowOnSwitchAfter) {
      state.won = true;
      state.cleared.add(state.levelIndex);
      renderLevelSelect();
      updateButtons();
      showWin();
    } else {
      if (shadowParked && shadowOnSwitchAfter) {
        flashStatus("影子钉在开关上 · 门已开", "info");
      } else if (shadowOnSwitchAfter) {
        flashStatus("开关已踩下 · 门开了", "info");
      } else {
        clearStatus();
      }
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
    clearStatus();
    renderPieces();
    updateHud();
    updateButtons();
  }

  function restart() {
    loadLevel(state.levelIndex);
  }

  function nextLevel() {
    if (state.levelIndex < window.SHADOW_LEVELS.length - 1) {
      loadLevel(state.levelIndex + 1);
    }
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
    els.btnNext.disabled =
      !state.won || state.levelIndex >= window.SHADOW_LEVELS.length - 1;
    els.btnRestart.disabled = false;
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
      ? `全部完成！本关 ${state.moves} 步。影子踩开关，你走出门——谢谢试玩。`
      : `用了 ${state.moves} 步。影子踩住开关，你走出了门！`;
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
      btn.textContent = String(lv.id);
      btn.title = lv.name;
      if (i === state.levelIndex) btn.classList.add("current");
      if (state.cleared.has(i)) btn.classList.add("cleared");
      btn.addEventListener("click", () => loadLevel(i));
      els.levelSelect.appendChild(btn);
    });
  }

  function cellClasses(r, c) {
    const k = key(r, c);
    const classes = ["cell"];
    if ((r + c) % 2 === 1) classes.push("alt");
    if (state.walls.has(k)) classes.push("wall");
    if (state.hazards.has(k)) classes.push("hazard");

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
        if (isSwitch) {
          cell.classList.toggle("switch-on", doorOpen);
        }
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
    els.board.querySelectorAll(".piece").forEach((n) => n.remove());
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
  }

  // --- Input: keyboard ---
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
    const dir = KEY_MAP[e.key];
    if (dir) {
      e.preventDefault();
      tryMove(dir);
    }
  });

  // --- Input: D-pad ---
  document.querySelectorAll(".dpad [data-dir]").forEach((btn) => {
    btn.addEventListener("click", () => tryMove(btn.dataset.dir));
  });

  // --- Input: swipe ---
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
  els.overlayNext.addEventListener("click", () => {
    hideOverlay();
    nextLevel();
  });
  els.overlayReplay.addEventListener("click", () => {
    hideOverlay();
    restart();
  });
  els.overlayClose.addEventListener("click", hideOverlay);

  loadLevel(0);
})();

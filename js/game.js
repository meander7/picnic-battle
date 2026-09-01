// ===================== Picnic Battle — game logic =====================
// A picnic-themed reskin of Battleship: food items are ships, ants are the
// bombs you send across the checkered blanket to find them.

(function () {
  "use strict";

  const BOARD_SIZE = 10;

  const SHIP_DEFS = [
    { id: "baguette", name: "Baguette", emoji: "🥖", size: 5 },
    { id: "watermelon", name: "Watermelon Slice", emoji: "🍉", size: 4 },
    { id: "corn", name: "Corn on the Cob", emoji: "🌽", size: 3 },
    { id: "pickle", name: "Pickle", emoji: "🥒", size: 3 },
    { id: "cherries", name: "Cherry Pair", emoji: "🍒", size: 2 },
  ];

  const HORIZONTAL = "horizontal";
  const VERTICAL = "vertical";

  // A tiny ant silhouette, colored via `currentColor` so the same markup can
  // be tinted dark (a miss) or red (a hit) purely with CSS.
  const ANT_SVG = `<svg viewBox="0 0 34 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none">
      <path d="M8 8 L3 4" /><path d="M8 8 L4 9" />
      <path d="M15 12 L9 7" /><path d="M15 12 L8 12" /><path d="M15 12 L9 17" />
      <path d="M23 14 L17 9" /><path d="M23 14 L16 14" /><path d="M23 14 L17 19" />
    </g>
    <g fill="currentColor">
      <circle cx="8" cy="8" r="3.4" />
      <circle cx="15" cy="12" r="4" />
      <ellipse cx="25" cy="14" rx="6.2" ry="5.4" />
    </g>
  </svg>`;

  function antIconHTML(kind, extraClass) {
    const cls = ["ant-icon", `ant-${kind}`, extraClass].filter(Boolean).join(" ");
    return `<span class="${cls}">${ANT_SVG}</span>`;
  }

  // ---------- Small helpers ----------

  function makeEmptyGrid() {
    return Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => ({
        shipId: null,
        attacked: false,
      }))
    );
  }

  function inBounds(row, col) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
  }

  function randInt(max) {
    return Math.floor(Math.random() * max);
  }

  // ---------- Board model ----------

  function createBoardState() {
    return {
      grid: makeEmptyGrid(),
      ships: {}, // id -> { def, cells: [{row,col}], hits: 0, sunk: bool }
    };
  }

  function shipCells(row, col, size, orientation) {
    const cells = [];
    for (let i = 0; i < size; i++) {
      cells.push(
        orientation === HORIZONTAL ? { row, col: col + i } : { row: row + i, col }
      );
    }
    return cells;
  }

  function canPlace(board, row, col, size, orientation) {
    const cells = shipCells(row, col, size, orientation);
    for (const c of cells) {
      if (!inBounds(c.row, c.col)) return false;
      // disallow overlap and touching (adjacent) other ships, incl. diagonals,
      // so foods stay tidily spaced out on the blanket.
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = c.row + dr;
          const nc = c.col + dc;
          if (inBounds(nr, nc) && board.grid[nr][nc].shipId) return false;
        }
      }
    }
    return true;
  }

  function placeShip(board, def, row, col, orientation) {
    const cells = shipCells(row, col, def.size, orientation);
    for (const c of cells) {
      board.grid[c.row][c.col].shipId = def.id;
    }
    board.ships[def.id] = { def, cells, hits: 0, sunk: false };
  }

  function randomizeFleet(board) {
    board.grid = makeEmptyGrid();
    board.ships = {};
    for (const def of SHIP_DEFS) {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 500) {
        attempts++;
        const orientation = Math.random() < 0.5 ? HORIZONTAL : VERTICAL;
        const row = randInt(BOARD_SIZE);
        const col = randInt(BOARD_SIZE);
        if (canPlace(board, row, col, def.size, orientation)) {
          placeShip(board, def, row, col, orientation);
          placed = true;
        }
      }
    }
  }

  // Returns { hit, shipId, sunk } for an attack on `board` at row/col.
  function attackCell(board, row, col) {
    const cell = board.grid[row][col];
    cell.attacked = true;
    if (!cell.shipId) {
      return { hit: false, shipId: null, sunk: false };
    }
    const ship = board.ships[cell.shipId];
    ship.hits++;
    if (ship.hits >= ship.def.size) {
      ship.sunk = true;
    }
    return { hit: true, shipId: ship.def.id, sunk: ship.sunk };
  }

  function allSunk(board) {
    return Object.values(board.ships).every((s) => s.sunk);
  }

  // ---------- AI ----------

  function createAI() {
    return {
      targetQueue: [], // candidate {row,col} cells to try next, from recent hits
    };
  }

  function aiChooseTarget(ai, board) {
    while (ai.targetQueue.length) {
      const candidate = ai.targetQueue.shift();
      const cell = board.grid[candidate.row][candidate.col];
      if (!cell.attacked) return candidate;
    }
    // Hunt mode: pick a random untried cell (checkerboard parity keeps the
    // search efficient, mirroring the smallest ship size of 2).
    const untried = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (!board.grid[row][col].attacked && (row + col) % 2 === 0) {
          untried.push({ row, col });
        }
      }
    }
    if (untried.length === 0) {
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          if (!board.grid[row][col].attacked) untried.push({ row, col });
        }
      }
    }
    return untried[randInt(untried.length)];
  }

  function aiObserveResult(ai, board, target, result) {
    if (!result.hit) return;
    if (result.sunk) {
      ai.targetQueue = [];
      return;
    }
    const neighbors = [
      { row: target.row - 1, col: target.col },
      { row: target.row + 1, col: target.col },
      { row: target.row, col: target.col - 1 },
      { row: target.row, col: target.col + 1 },
    ].filter((n) => inBounds(n.row, n.col) && !board.grid[n.row][n.col].attacked);
    ai.targetQueue.push(...neighbors);
  }

  // ---------- App state ----------

  const state = {
    phase: "placement", // "placement" | "battle" | "over"
    playerBoard: createBoardState(),
    enemyBoard: createBoardState(),
    ai: createAI(),
    placement: {
      remaining: SHIP_DEFS.map((d) => d.id),
      selectedId: null,
      orientation: HORIZONTAL,
    },
    playersTurn: true,
  };

  // ---------- DOM refs ----------

  const el = {
    placementScreen: document.getElementById("placement-screen"),
    battleScreen: document.getElementById("battle-screen"),
    placementBoard: document.getElementById("placement-board"),
    shipTray: document.getElementById("ship-tray"),
    placementHint: document.getElementById("placement-hint"),
    rotateBtn: document.getElementById("rotate-btn"),
    randomizeBtn: document.getElementById("randomize-btn"),
    startBattleBtn: document.getElementById("start-battle-btn"),
    statusText: document.getElementById("status-text"),
    playerBoard: document.getElementById("player-board"),
    enemyBoard: document.getElementById("enemy-board"),
    playerFleet: document.getElementById("player-fleet"),
    enemyFleet: document.getElementById("enemy-fleet"),
    restartBtn: document.getElementById("restart-btn"),
    modal: document.getElementById("gameover-modal"),
    modalTitle: document.getElementById("gameover-title"),
    modalMessage: document.getElementById("gameover-message"),
    playAgainBtn: document.getElementById("play-again-btn"),
    toastContainer: document.getElementById("toast-container"),
  };

  // ---------- Toasts ----------

  function toast(message) {
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    el.toastContainer.appendChild(node);
    setTimeout(() => node.remove(), 3000);
  }

  // ---------- Placement screen ----------

  function shipById(id) {
    return SHIP_DEFS.find((d) => d.id === id);
  }

  function renderShipTray() {
    el.shipTray.innerHTML = "";
    for (const def of SHIP_DEFS) {
      const li = document.createElement("li");
      li.className = "ship-tray-item";
      const isPlaced = !state.placement.remaining.includes(def.id);
      if (isPlaced) li.classList.add("placed");
      if (state.placement.selectedId === def.id) li.classList.add("selected");

      const emojiRow = document.createElement("span");
      emojiRow.className = "emoji-row";
      emojiRow.textContent = def.emoji.repeat(def.size);

      const name = document.createElement("span");
      name.className = "name";
      name.textContent = `${def.name} (${def.size})`;

      li.appendChild(emojiRow);
      li.appendChild(name);

      if (!isPlaced) {
        li.addEventListener("click", () => {
          state.placement.selectedId = def.id;
          renderShipTray();
          renderPlacementBoard();
          el.placementHint.textContent = `Placing the ${def.name}. Click your blanket, or press Rotate to change direction.`;
        });
      }

      el.shipTray.appendChild(li);
    }
  }

  function renderPlacementBoard(hoverCell) {
    const board = state.playerBoard;
    el.placementBoard.innerHTML = "";

    let previewCells = [];
    let previewValid = false;
    const selectedDef = state.placement.selectedId && shipById(state.placement.selectedId);
    if (selectedDef && hoverCell) {
      previewCells = shipCells(
        hoverCell.row,
        hoverCell.col,
        selectedDef.size,
        state.placement.orientation
      );
      previewValid = canPlace(board, hoverCell.row, hoverCell.col, selectedDef.size, state.placement.orientation);
    }

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell " + ((row + col) % 2 === 0 ? "checker-a" : "checker-b");
        btn.dataset.row = String(row);
        btn.dataset.col = String(col);

        const cellData = board.grid[row][col];
        if (cellData.shipId) {
          btn.classList.add("ship-here");
          const def = shipById(cellData.shipId);
          btn.textContent = def.emoji;
        }

        const inPreview = previewCells.some((c) => c.row === row && c.col === col);
        if (inPreview) {
          btn.classList.add(previewValid ? "preview-ok" : "preview-bad");
        }

        btn.addEventListener("mouseenter", () => {
          if (selectedDef) renderPlacementBoard({ row, col });
        });
        btn.addEventListener("click", () => handlePlacementClick(row, col));

        el.placementBoard.appendChild(btn);
      }
    }
  }

  function handlePlacementClick(row, col) {
    const def = state.placement.selectedId && shipById(state.placement.selectedId);
    if (!def) {
      el.placementHint.textContent = "Pick a food from the basket first!";
      return;
    }
    if (!canPlace(state.playerBoard, row, col, def.size, state.placement.orientation)) {
      toast("Can't set food there — too close to another item or off the blanket!");
      return;
    }
    placeShip(state.playerBoard, def, row, col, state.placement.orientation);
    state.placement.remaining = state.placement.remaining.filter((id) => id !== def.id);
    state.placement.selectedId = state.placement.remaining[0] || null;

    renderShipTray();
    renderPlacementBoard();
    updatePlacementHint();
    updateStartButton();
  }

  function updatePlacementHint() {
    if (state.placement.remaining.length === 0) {
      el.placementHint.textContent = "Basket packed! Ready to start the battle.";
    } else if (state.placement.selectedId) {
      const def = shipById(state.placement.selectedId);
      el.placementHint.textContent = `Placing the ${def.name}. Click your blanket, or press Rotate to change direction.`;
    } else {
      el.placementHint.textContent = "Pick a food below, then click your blanket to set it down.";
    }
  }

  function updateStartButton() {
    el.startBattleBtn.disabled = state.placement.remaining.length > 0;
  }

  el.rotateBtn.addEventListener("click", () => {
    state.placement.orientation =
      state.placement.orientation === HORIZONTAL ? VERTICAL : HORIZONTAL;
    renderPlacementBoard();
  });

  el.randomizeBtn.addEventListener("click", () => {
    randomizeFleet(state.playerBoard);
    state.placement.remaining = [];
    state.placement.selectedId = null;
    renderShipTray();
    renderPlacementBoard();
    updatePlacementHint();
    updateStartButton();
  });

  el.startBattleBtn.addEventListener("click", startBattle);

  // ---------- Battle screen ----------

  function renderFleetStatus(listEl, board, revealAll) {
    listEl.innerHTML = "";
    for (const def of SHIP_DEFS) {
      const li = document.createElement("li");
      const ship = board.ships[def.id];
      const known = revealAll || (ship && ship.sunk);
      if (known) {
        li.textContent = def.emoji;
        if (ship && ship.sunk) li.classList.add("sunk-item");
      } else {
        li.textContent = "❓";
        li.classList.add("unknown");
      }
      li.title = revealAll || (ship && ship.sunk) ? def.name : "Unknown food";
      listEl.appendChild(li);
    }
  }

  function markFor(cellData, board) {
    if (!cellData.attacked) return null;
    if (!cellData.shipId) return { cls: "miss" };
    const ship = board.ships[cellData.shipId];
    if (ship.sunk) return { cls: "sunk", emoji: ship.def.emoji };
    return { cls: "hit" };
  }

  // Fills a cell with the right visual for an attack result: a dark ant for
  // a miss, a red ant for a hit, or the revealed food (plus a red ant badge)
  // once its ship is fully sunk.
  function renderAttackResult(element, result) {
    element.classList.add("attacked", result.cls);
    if (result.cls === "sunk") {
      element.innerHTML =
        `<span class="food-emoji">${result.emoji}</span>` + antIconHTML("hit", "ant-badge");
    } else {
      element.innerHTML = antIconHTML(result.cls === "hit" ? "hit" : "miss");
    }
  }

  function renderPlayerBoard() {
    const board = state.playerBoard;
    el.playerBoard.innerHTML = "";
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cellData = board.grid[row][col];
        const div = document.createElement("div");
        div.className = "cell disabled " + ((row + col) % 2 === 0 ? "checker-a" : "checker-b");

        if (cellData.shipId && !cellData.attacked) {
          const def = shipById(cellData.shipId);
          div.textContent = def.emoji;
          div.classList.add("ship-here");
        }

        const result = markFor(cellData, board);
        if (result) renderAttackResult(div, result);
        el.playerBoard.appendChild(div);
      }
    }
    renderFleetStatus(el.playerFleet, board, true);
  }

  function renderEnemyBoard() {
    const board = state.enemyBoard;
    el.enemyBoard.innerHTML = "";
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cellData = board.grid[row][col];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell " + ((row + col) % 2 === 0 ? "checker-a" : "checker-b");

        const result = markFor(cellData, board);
        if (result) {
          renderAttackResult(btn, result);
          btn.disabled = true;
        } else if (!state.playersTurn || state.phase !== "battle") {
          btn.classList.add("disabled");
          btn.disabled = true;
        }

        btn.addEventListener("click", () => handlePlayerAttack(row, col));
        el.enemyBoard.appendChild(btn);
      }
    }
    renderFleetStatus(el.enemyFleet, board, false);
  }

  function renderBattle() {
    renderPlayerBoard();
    renderEnemyBoard();
  }

  function startBattle() {
    randomizeFleet(state.enemyBoard);
    state.ai = createAI();
    state.playersTurn = true;
    state.phase = "battle";

    el.placementScreen.classList.add("hidden");
    el.battleScreen.classList.remove("hidden");
    el.statusText.textContent = "Your move — click the enemy blanket to send in the ants!";
    renderBattle();
  }

  function handlePlayerAttack(row, col) {
    if (state.phase !== "battle" || !state.playersTurn) return;
    const board = state.enemyBoard;
    if (board.grid[row][col].attacked) return;

    const result = attackCell(board, row, col);
    announcePlayerResult(result);
    renderBattle();

    if (allSunk(board)) {
      endGame(true);
      return;
    }

    state.playersTurn = false;
    renderBattle(); // lock enemy board while AI thinks
    el.statusText.textContent = "🐜 The enemy ants are scouting your blanket...";
    setTimeout(aiTurn, 800);
  }

  function announcePlayerResult(result) {
    if (result.sunk) {
      const def = shipById(result.shipId);
      toast(`Direct hit! The enemy's ${def.name} got swarmed by ants! ${def.emoji}🐜`);
    } else if (result.hit) {
      toast("Your ants found food! 🐜🍽️");
    } else {
      toast("Your ants wandered off empty-handed. 🐜");
    }
  }

  function aiTurn() {
    if (state.phase !== "battle") return;
    const board = state.playerBoard;
    const target = aiChooseTarget(state.ai, board);
    const result = attackCell(board, target.row, target.col);
    aiObserveResult(state.ai, board, target, result);

    if (result.sunk) {
      const def = shipById(result.shipId);
      toast(`Uh oh! Enemy ants swarmed your ${def.name}! ${def.emoji}🐜`);
    } else if (result.hit) {
      toast("The enemy's ants found your food! 🐜");
    } else {
      toast("The enemy's ants wandered off empty-handed. 🐜");
    }

    renderBattle();

    if (allSunk(board)) {
      endGame(false);
      return;
    }

    state.playersTurn = true;
    el.statusText.textContent = "Your move — click the enemy blanket to send in the ants!";
    renderBattle();
  }

  function endGame(playerWon) {
    state.phase = "over";
    renderBattle();
    el.modal.classList.remove("hidden");
    if (playerWon) {
      el.modalTitle.textContent = "🎉 Picnic Saved!";
      el.modalMessage.textContent =
        "Your ants raided every last snack on the enemy's blanket. Victory is delicious!";
    } else {
      el.modalTitle.textContent = "😱 Ants Win!";
      el.modalMessage.textContent =
        "The enemy ants ate your entire picnic. Better luck (and better hiding spots) next time!";
    }
  }

  el.restartBtn.addEventListener("click", () => {
    if (confirm("Start a brand new picnic? Your current game will be lost.")) {
      resetGame();
    }
  });

  el.playAgainBtn.addEventListener("click", resetGame);

  function resetGame() {
    state.phase = "placement";
    state.playerBoard = createBoardState();
    state.enemyBoard = createBoardState();
    state.ai = createAI();
    state.placement = {
      remaining: SHIP_DEFS.map((d) => d.id),
      selectedId: null,
      orientation: HORIZONTAL,
    };
    state.playersTurn = true;

    el.modal.classList.add("hidden");
    el.battleScreen.classList.add("hidden");
    el.placementScreen.classList.remove("hidden");

    renderShipTray();
    renderPlacementBoard();
    updatePlacementHint();
    updateStartButton();
  }

  // ---------- Init ----------

  function init() {
    state.placement.selectedId = SHIP_DEFS[0].id;
    renderShipTray();
    renderPlacementBoard();
    updatePlacementHint();
    updateStartButton();
  }

  init();
})();

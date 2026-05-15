"use strict";

const canvas = document.getElementById("lifeCanvas");
const ctx = canvas.getContext("2d");

const playPauseButton = document.getElementById("playPauseButton");
const stepButton = document.getElementById("stepButton");
const clearButton = document.getElementById("clearButton");
const randomizeButton = document.getElementById("randomizeButton");
const speedSlider = document.getElementById("speedSlider");
const speedValue = document.getElementById("speedValue");
const densitySlider = document.getElementById("densitySlider");
const densityValue = document.getElementById("densityValue");
const columnsInput = document.getElementById("columnsInput");
const rowsInput = document.getElementById("rowsInput");
const applySizeButton = document.getElementById("applySizeButton");
const patternSelect = document.getElementById("patternSelect");
const wrapToggle = document.getElementById("wrapToggle");
const generationCount = document.getElementById("generationCount");
const liveCount = document.getElementById("liveCount");

const patterns = {
  block: [
    [0, 0], [1, 0],
    [0, 1], [1, 1]
  ],
  blinker: [
    [-1, 0], [0, 0], [1, 0]
  ],
  glider: [
    [1, 0],
    [2, 1],
    [0, 2], [1, 2], [2, 2]
  ],
  gosper: [
    [24, 0],
    [22, 1], [24, 1],
    [12, 2], [13, 2], [20, 2], [21, 2], [34, 2], [35, 2],
    [11, 3], [15, 3], [20, 3], [21, 3], [34, 3], [35, 3],
    [0, 4], [1, 4], [10, 4], [16, 4], [20, 4], [21, 4],
    [0, 5], [1, 5], [10, 5], [14, 5], [16, 5], [17, 5], [22, 5], [24, 5],
    [10, 6], [16, 6], [24, 6],
    [11, 7], [15, 7],
    [12, 8], [13, 8]
  ]
};

let columns = 64;
let rows = 40;
let cells = new Uint8Array(columns * rows);
let generation = 0;
let liveCells = 0;
let timerId = null;
let cellSize = 10;
let isDrawing = false;
let drawState = 1;
let lastDrawnIndex = -1;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function indexFor(col, row) {
  return row * columns + col;
}

function createEmptyGrid(nextColumns = columns, nextRows = rows) {
  columns = nextColumns;
  rows = nextRows;
  cells = new Uint8Array(columns * rows);
  generation = 0;
  liveCells = 0;
  columnsInput.value = columns;
  rowsInput.value = rows;
  resizeCanvas();
  updateStats();
}

function countLiveCells() {
  let total = 0;
  for (let i = 0; i < cells.length; i += 1) {
    total += cells[i];
  }
  liveCells = total;
}

function updateStats() {
  generationCount.textContent = generation.toLocaleString();
  liveCount.textContent = liveCells.toLocaleString();
}

function updateSliderLabels() {
  speedValue.textContent = `${speedSlider.value} gen/s`;
  densityValue.textContent = `${densitySlider.value}%`;
}

function getSpeedDelay() {
  return Math.round(1000 / Number(speedSlider.value));
}

function startSimulation() {
  if (timerId !== null) {
    return;
  }

  timerId = window.setInterval(stepSimulation, getSpeedDelay());
  playPauseButton.textContent = "Pause";
}

function pauseSimulation() {
  if (timerId === null) {
    return;
  }

  window.clearInterval(timerId);
  timerId = null;
  playPauseButton.textContent = "Play";
}

function toggleSimulation() {
  if (timerId === null) {
    startSimulation();
  } else {
    pauseSimulation();
  }
}

function countNeighbors(col, row) {
  let count = 0;
  const shouldWrap = wrapToggle.checked;

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) {
        continue;
      }

      let nextCol = col + colOffset;
      let nextRow = row + rowOffset;

      if (shouldWrap) {
        nextCol = (nextCol + columns) % columns;
        nextRow = (nextRow + rows) % rows;
      } else if (nextCol < 0 || nextCol >= columns || nextRow < 0 || nextRow >= rows) {
        continue;
      }

      count += cells[indexFor(nextCol, nextRow)];
    }
  }

  return count;
}

function stepSimulation() {
  const nextCells = new Uint8Array(cells.length);
  let nextLiveCells = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const index = indexFor(col, row);
      const isAlive = cells[index] === 1;
      const neighbors = countNeighbors(col, row);
      const survives = isAlive && (neighbors === 2 || neighbors === 3);
      const isBorn = !isAlive && neighbors === 3;

      if (survives || isBorn) {
        nextCells[index] = 1;
        nextLiveCells += 1;
      }
    }
  }

  cells = nextCells;
  liveCells = nextLiveCells;
  generation += 1;
  render();
  updateStats();
}

function clearGrid() {
  pauseSimulation();
  cells.fill(0);
  generation = 0;
  liveCells = 0;
  patternSelect.value = "";
  render();
  updateStats();
}

function randomizeGrid() {
  pauseSimulation();
  const density = Number(densitySlider.value) / 100;
  liveCells = 0;

  for (let i = 0; i < cells.length; i += 1) {
    cells[i] = Math.random() < density ? 1 : 0;
    liveCells += cells[i];
  }

  generation = 0;
  patternSelect.value = "";
  render();
  updateStats();
}

function getPatternBounds(pattern) {
  let minCol = Infinity;
  let maxCol = -Infinity;
  let minRow = Infinity;
  let maxRow = -Infinity;

  for (const [col, row] of pattern) {
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
  }

  return {
    minCol,
    minRow,
    width: maxCol - minCol + 1,
    height: maxRow - minRow + 1
  };
}

function ensurePatternFits(pattern) {
  const bounds = getPatternBounds(pattern);
  const neededColumns = Math.max(columns, bounds.width + 8);
  const neededRows = Math.max(rows, bounds.height + 8);

  if (neededColumns !== columns || neededRows !== rows) {
    createEmptyGrid(neededColumns, neededRows);
  }
}

function placePattern(name) {
  const pattern = patterns[name];
  if (!pattern) {
    return;
  }

  pauseSimulation();
  ensurePatternFits(pattern);
  const bounds = getPatternBounds(pattern);
  cells.fill(0);

  const originCol = Math.floor((columns - bounds.width) / 2) - bounds.minCol;
  const originRow = Math.floor((rows - bounds.height) / 2) - bounds.minRow;

  for (const [col, row] of pattern) {
    const targetCol = originCol + col;
    const targetRow = originRow + row;

    if (targetCol >= 0 && targetCol < columns && targetRow >= 0 && targetRow < rows) {
      cells[indexFor(targetCol, targetRow)] = 1;
    }
  }

  generation = 0;
  countLiveCells();
  render();
  updateStats();
}

function resizeCanvas() {
  const board = canvas.parentElement;
  const boardStyles = window.getComputedStyle(board);
  const horizontalPadding = parseFloat(boardStyles.paddingLeft) + parseFloat(boardStyles.paddingRight);
  const availableWidth = Math.max(1, board.clientWidth - horizontalPadding);
  const availableHeight = Math.min(window.innerHeight * 0.68, 760);
  let displayWidth = availableWidth;
  let displayHeight = displayWidth * (rows / columns);

  if (displayHeight > availableHeight) {
    displayHeight = availableHeight;
    displayWidth = displayHeight * (columns / rows);
  }

  displayWidth = Math.floor(displayWidth);
  displayHeight = Math.floor(displayHeight);

  const pixelRatio = window.devicePixelRatio || 1;
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;
  canvas.width = Math.floor(displayWidth * pixelRatio);
  canvas.height = Math.floor(displayHeight * pixelRatio);
  cellSize = displayWidth / columns;
  render();
}

function render() {
  const width = canvas.width / (window.devicePixelRatio || 1);
  const height = canvas.height / (window.devicePixelRatio || 1);
  const pixelRatio = window.devicePixelRatio || 1;

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#f7f5ef";
  ctx.fillRect(0, 0, width, height);

  const gap = cellSize >= 8 ? 1 : cellSize >= 5 ? 0.5 : 0;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      if (cells[indexFor(col, row)] === 1) {
        ctx.fillStyle = (row + col) % 2 === 0 ? "#16343b" : "#226b5f";
        ctx.fillRect(
          col * cellSize + gap,
          row * cellSize + gap,
          Math.max(1, cellSize - gap * 2),
          Math.max(1, cellSize - gap * 2)
        );
      }
    }
  }

  if (cellSize >= 7) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(29, 36, 40, 0.14)";
    ctx.lineWidth = 1;

    for (let col = 0; col <= columns; col += 1) {
      const x = col * cellSize;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rows * cellSize);
    }

    for (let row = 0; row <= rows; row += 1) {
      const y = row * cellSize;
      ctx.moveTo(0, y);
      ctx.lineTo(columns * cellSize, y);
    }

    ctx.stroke();
  }
}

function cellFromPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const col = Math.floor(((event.clientX - rect.left) / rect.width) * columns);
  const row = Math.floor(((event.clientY - rect.top) / rect.height) * rows);

  if (col < 0 || col >= columns || row < 0 || row >= rows) {
    return null;
  }

  return { col, row, index: indexFor(col, row) };
}

function drawCellFromPointer(event) {
  const cell = cellFromPointer(event);

  if (!cell || cell.index === lastDrawnIndex) {
    return;
  }

  const previous = cells[cell.index];
  cells[cell.index] = drawState;
  lastDrawnIndex = cell.index;

  if (previous !== drawState) {
    liveCells += drawState === 1 ? 1 : -1;
    updateStats();
  }

  render();
}

canvas.addEventListener("pointerdown", (event) => {
  const cell = cellFromPointer(event);
  if (!cell) {
    return;
  }

  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  isDrawing = true;
  drawState = cells[cell.index] === 1 ? 0 : 1;
  lastDrawnIndex = -1;
  drawCellFromPointer(event);
});

canvas.addEventListener("pointermove", (event) => {
  if (!isDrawing) {
    return;
  }

  event.preventDefault();
  drawCellFromPointer(event);
});

canvas.addEventListener("pointerup", (event) => {
  isDrawing = false;
  lastDrawnIndex = -1;

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
});

canvas.addEventListener("pointercancel", () => {
  isDrawing = false;
  lastDrawnIndex = -1;
});

playPauseButton.addEventListener("click", toggleSimulation);

stepButton.addEventListener("click", () => {
  pauseSimulation();
  stepSimulation();
});

clearButton.addEventListener("click", clearGrid);
randomizeButton.addEventListener("click", randomizeGrid);

speedSlider.addEventListener("input", () => {
  updateSliderLabels();

  if (timerId !== null) {
    pauseSimulation();
    startSimulation();
  }
});

densitySlider.addEventListener("input", updateSliderLabels);

applySizeButton.addEventListener("click", () => {
  pauseSimulation();
  const nextColumns = clamp(Number.parseInt(columnsInput.value, 10) || columns, 12, 160);
  const nextRows = clamp(Number.parseInt(rowsInput.value, 10) || rows, 12, 120);
  patternSelect.value = "";
  createEmptyGrid(nextColumns, nextRows);
});

columnsInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    applySizeButton.click();
  }
});

rowsInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    applySizeButton.click();
  }
});

patternSelect.addEventListener("change", () => {
  if (patternSelect.value) {
    placePattern(patternSelect.value);
  }
});

wrapToggle.addEventListener("change", () => {
  render();
});

window.addEventListener("resize", resizeCanvas);

updateSliderLabels();
createEmptyGrid(columns, rows);
placePattern("glider");
patternSelect.value = "glider";

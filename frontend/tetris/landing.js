// Animated block preview on the hero canvas
const canvas = document.getElementById('preview-canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const CELL = 15;
const COLS = Math.floor(W / CELL);
const ROWS = Math.floor(H / CELL);

const PIECES = [
  { shape: [[1,1,1,1]], color: '#00f0f0' },
  { shape: [[1,1],[1,1]], color: '#f0f000' },
  { shape: [[0,1,0],[1,1,1]], color: '#a000f0' },
  { shape: [[0,1,1],[1,1,0]], color: '#00f000' },
  { shape: [[1,1,0],[0,1,1]], color: '#f00000' },
  { shape: [[1,0,0],[1,1,1]], color: '#0000f0' },
  { shape: [[0,0,1],[1,1,1]], color: '#f0a000' },
];

const board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
let piece = null, raf;

function randomPiece() {
  const t = PIECES[Math.floor(Math.random() * PIECES.length)];
  return {
    shape: t.shape,
    color: t.color,
    x: Math.floor(COLS / 2) - Math.floor(t.shape[0].length / 2),
    y: -t.shape.length,
  };
}

function collides(shape, x, y) {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      if (x + c < 0 || x + c >= COLS || y + r >= ROWS) return true;
      if (y + r >= 0 && board[y + r][x + c]) return true;
    }
  return false;
}

function lock() {
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c] && piece.y + r >= 0)
        board[piece.y + r][piece.x + c] = piece.color;

  // clear full lines
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(c => c !== null)) {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(null));
      r++;
    }
  }

  // if board is too full, reset
  if (board[1].some(c => c !== null)) {
    board.forEach((row, i) => board[i].fill(null));
  }

  piece = randomPiece();
}

function drawCell(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, 3);
}

let lastTime = 0, timer = 0;
const DROP_INTERVAL = 300;

function loop(ts) {
  const delta = ts - lastTime;
  lastTime = ts;
  timer += delta;

  if (timer >= DROP_INTERVAL) {
    timer = 0;
    if (!collides(piece.shape, piece.x, piece.y + 1)) {
      piece.y++;
    } else {
      lock();
    }
  }

  ctx.clearRect(0, 0, W, H);

  // grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 0.5;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]) drawCell(c, r, board[r][c]);

  // falling piece
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c] && piece.y + r >= 0)
        drawCell(piece.x + c, piece.y + r, piece.color);

  raf = requestAnimationFrame(loop);
}

piece = randomPiece();
raf = requestAnimationFrame(ts => { lastTime = ts; loop(ts); });

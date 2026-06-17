const COLS = 10;
const ROWS = 20;
const CELL = 30;
const NCELL = 25; // next-piece canvas cell size

const TETROMINOES = [
  { shape: [[1,1,1,1]], color: '#00f0f0' },
  { shape: [[1,1],[1,1]], color: '#f0f000' },
  { shape: [[0,1,0],[1,1,1]], color: '#a000f0' },
  { shape: [[0,1,1],[1,1,0]], color: '#00f000' },
  { shape: [[1,1,0],[0,1,1]], color: '#f00000' },
  { shape: [[1,0,0],[1,1,1]], color: '#0000f0' },
  { shape: [[0,0,1],[1,1,1]], color: '#f0a000' },
];

const SCORE_TABLE = [0, 100, 300, 500, 800];
const TIME_PER_LEVEL = 30000;
const FLASH_DURATION = 500;
const FLASH_INTERVAL = 80;

const API_BASE = CONFIG.API_BASE;

// ── BGM: Tetris Type-A (Korobeiniki) ──────────────────────────────────────
const BPM = 145;
const Q = 60 / BPM, E = Q / 2, H = Q * 2, DQ = Q * 1.5;
const FR = { A4:440, B4:493.88, C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99, A5:880 };
const MELODY = [
  // Section A
  [FR.E5,Q],[FR.B4,E],[FR.C5,E],[FR.D5,Q],[FR.C5,E],[FR.B4,E],
  [FR.A4,Q],[FR.A4,E],[FR.C5,E],[FR.E5,Q],[FR.D5,E],[FR.C5,E],
  [FR.B4,DQ],[FR.C5,E],[FR.D5,Q],[FR.E5,Q],
  [FR.C5,Q],[FR.A4,Q],[FR.A4,H],
  // Section B
  [0,E],
  [FR.D5,Q],[FR.F5,E],[FR.A5,Q],[FR.G5,E],[FR.F5,E],
  [FR.E5,DQ],[FR.C5,E],[FR.E5,Q],[FR.D5,E],[FR.C5,E],
  [FR.B4,Q],[FR.B4,E],[FR.C5,E],[FR.D5,Q],[FR.E5,Q],
  [FR.C5,Q],[FR.A4,Q],[FR.A4,Q],[0,Q],
];

// ── DOM ───────────────────────────────────────────────────────────────────
const canvas     = document.getElementById('board');
const ctx        = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx    = nextCanvas.getContext('2d');
const scoreEl    = document.getElementById('score');
const levelEl    = document.getElementById('level');
const linesEl    = document.getElementById('lines');
const overlay    = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const overlaySaved = document.getElementById('overlay-saved');

// ── State ─────────────────────────────────────────────────────────────────
let board, score, level, lines, current, nextPiece;
let dropTimer, lastTime, gameStartTs, animId, gameOver;
let flashingRows, flashTimer;
let audioCtx = null, bgmTimeout = null, bgmActive = false;

// ── Auth state ────────────────────────────────────────────────────────────
let currentUser = null;
let authToken = null;

function loadAuth() {
  authToken = localStorage.getItem('tetris_token');
  const userJson = localStorage.getItem('tetris_user');
  if (authToken && userJson) {
    try { currentUser = JSON.parse(userJson); } catch { clearAuth(); return; }
  }
  updateAuthUI();
}

function saveAuth(token, user) {
  authToken = token;
  currentUser = user;
  localStorage.setItem('tetris_token', token);
  localStorage.setItem('tetris_user', JSON.stringify(user));
  updateAuthUI();
}

function clearAuth() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('tetris_token');
  localStorage.removeItem('tetris_user');
  updateAuthUI();
}

function updateAuthUI() {
  const userStatus = document.getElementById('user-status');
  const authBtn = document.getElementById('auth-btn');
  if (currentUser) {
    userStatus.textContent = `${currentUser.username}님`;
    authBtn.textContent = '로그아웃';
  } else {
    userStatus.textContent = '';
    authBtn.textContent = '로그인 / 회원가입';
  }
}

// ── API helpers ───────────────────────────────────────────────────────────
async function apiRequest(method, path, body = null, requireAuth = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (requireAuth && authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || '오류가 발생했습니다');
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function fetchTopScore() {
  try {
    const data = await apiRequest('GET', '/scores/top');
    const el = document.getElementById('top-score');
    const userEl = document.getElementById('top-score-user');
    if (data) {
      el.textContent = data.score.toLocaleString();
      userEl.textContent = data.username;
    } else {
      el.textContent = '-';
      userEl.textContent = '';
    }
  } catch { /* 서버 미연결 시 무시 */ }
}

async function submitScore(s, l, lv) {
  if (!authToken) return null;
  try {
    return await apiRequest('POST', '/scores', { score: s, lines: l, level: lv }, true);
  } catch { return null; }
}

// ── Audio ─────────────────────────────────────────────────────────────────
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  stopBGM();
  scheduleBGM(audioCtx.currentTime + 0.1);
  bgmActive = true;
}

function playNote(freq, t, dur) {
  if (!audioCtx || freq === 0) return;
  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = 'square';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.06, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.88);
  osc.start(t);
  osc.stop(t + dur);
}

function scheduleBGM(startTime) {
  if (!audioCtx) return;
  let t = startTime, total = 0;
  for (const [freq, dur] of MELODY) { playNote(freq, t, dur); t += dur; total += dur; }
  const delay = Math.max(0, (startTime + total - audioCtx.currentTime - 0.3) * 1000);
  bgmTimeout = setTimeout(() => scheduleBGM(startTime + total), delay);
}

function stopBGM() {
  clearTimeout(bgmTimeout);
  bgmTimeout = null;
  bgmActive = false;
}

function tryStartAudio() {
  if (bgmActive) {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  } else {
    initAudio();
  }
}

// ── Board helpers ─────────────────────────────────────────────────────────
function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece() {
  const t = TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];
  return {
    shape: t.shape.map(r => [...r]),
    color: t.color,
    x: Math.floor(COLS / 2) - Math.floor(t.shape[0].length / 2),
    y: 0,
  };
}

function rotate(shape) {
  const rows = shape.length, cols = shape[0].length;
  const res = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      res[c][rows - 1 - r] = shape[r][c];
  return res;
}

function collides(shape, x, y) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = x + c, ny = y + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

// ── Piece logic ───────────────────────────────────────────────────────────
function lockPiece() {
  for (let r = 0; r < current.shape.length; r++) {
    for (let c = 0; c < current.shape[r].length; c++) {
      if (!current.shape[r][c]) continue;
      const ny = current.y + r, nx = current.x + c;
      if (ny < 0) { endGame(); return; }
      board[ny][nx] = current.color;
    }
  }
  const fullRows = [];
  for (let r = 0; r < ROWS; r++) {
    if (board[r].every(cell => cell !== null)) fullRows.push(r);
  }
  if (fullRows.length > 0) {
    flashingRows = fullRows;
    flashTimer = 0;
  } else {
    spawnPiece();
  }
}

function finishLineClear() {
  const cleared = flashingRows.length;
  const surviving = board.filter((_, r) => !flashingRows.includes(r));
  board = [
    ...Array.from({ length: cleared }, () => Array(COLS).fill(null)),
    ...surviving,
  ];
  lines += cleared;
  score += SCORE_TABLE[cleared] * level;
  level = Math.max(level, Math.floor(lines / 10) + 1);
  updateStats();
  flashingRows = null;
  flashTimer = 0;
  spawnPiece();
}

function spawnPiece() {
  current = nextPiece;
  nextPiece = randomPiece();
  drawNext();
  if (collides(current.shape, current.x, current.y)) endGame();
}

function movePiece(dx, dy) {
  if (collides(current.shape, current.x + dx, current.y + dy)) {
    if (dy > 0) lockPiece();
    return false;
  }
  current.x += dx;
  current.y += dy;
  return true;
}

function rotatePiece() {
  const rotated = rotate(current.shape);
  if (!collides(rotated, current.x, current.y)) {
    current.shape = rotated;
  } else if (!collides(rotated, current.x - 1, current.y)) {
    current.shape = rotated; current.x -= 1;
  } else if (!collides(rotated, current.x + 1, current.y)) {
    current.shape = rotated; current.x += 1;
  }
}

function hardDrop() { while (movePiece(0, 1)) {} }

function dropSpeed() { return Math.max(100, 1000 - (level - 1) * 100); }

function updateStats() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;
}

// ── Drawing ───────────────────────────────────────────────────────────────
function drawCell(c, x, y, color, size) {
  c.fillStyle = color;
  c.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  c.fillStyle = 'rgba(255,255,255,0.15)';
  c.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  c.fillRect(x * size + 1, y * size + 1, 4, size - 2);
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 0.5;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
}

function drawGhost() {
  let ghostY = current.y;
  while (!collides(current.shape, current.x, ghostY + 1)) ghostY++;
  if (ghostY === current.y) return;
  ctx.globalAlpha = 0.2;
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawCell(ctx, current.x + c, ghostY + r, current.color, CELL);
  ctx.globalAlpha = 1;
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = nextPiece.shape;
  const ox = Math.floor((4 - shape[0].length) / 2);
  const oy = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c])
        drawCell(nextCtx, ox + c, oy + r, nextPiece.color, NCELL);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!board[r][c]) continue;
      if (flashingRows && flashingRows.includes(r)) {
        const bright = Math.floor(flashTimer / FLASH_INTERVAL) % 2 === 0;
        drawCell(ctx, c, r, bright ? '#ffffff' : board[r][c], CELL);
      } else {
        drawCell(ctx, c, r, board[r][c], CELL);
      }
    }
  }

  if (!flashingRows) {
    drawGhost();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawCell(ctx, current.x + c, current.y + r, current.color, CELL);
  }
}

// ── Game loop ─────────────────────────────────────────────────────────────
function gameLoop(ts) {
  if (gameOver) return;
  const delta = ts - lastTime;
  lastTime = ts;

  if (flashingRows) {
    flashTimer += delta;
    if (flashTimer >= FLASH_DURATION) finishLineClear();
    draw();
    animId = requestAnimationFrame(gameLoop);
    return;
  }

  dropTimer += delta;
  const timeLevel = Math.floor((ts - gameStartTs) / TIME_PER_LEVEL) + 1;
  if (timeLevel > level) { level = timeLevel; updateStats(); }

  if (dropTimer >= dropSpeed()) { movePiece(0, 1); dropTimer = 0; }

  draw();
  animId = requestAnimationFrame(gameLoop);
}

async function endGame() {
  gameOver = true;
  stopBGM();
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `최종 점수: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');

  if (currentUser) {
    overlaySaved.style.color = '#aaa';
    overlaySaved.textContent = '점수 저장 중...';
    const result = await submitScore(score, lines, level);
    if (result) {
      overlaySaved.style.color = '#4caf50';
      overlaySaved.textContent = '기록이 저장되었습니다!';
      fetchTopScore();
    } else {
      overlaySaved.style.color = '#e94560';
      overlaySaved.textContent = '점수 저장에 실패했습니다';
    }
  } else {
    overlaySaved.style.color = '#888';
    overlaySaved.textContent = '로그인하면 기록이 저장됩니다';
  }
}

function startGame() {
  board = createBoard();
  score = 0; level = 1; lines = 0;
  gameOver = false; dropTimer = 0; lastTime = 0;
  flashingRows = null; flashTimer = 0;
  nextPiece = randomPiece();
  updateStats();
  overlay.classList.add('hidden');
  overlaySaved.textContent = '';
  stopBGM();
  spawnPiece();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(ts => { lastTime = ts; gameStartTs = ts; gameLoop(ts); });
}

// ── Input ─────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  tryStartAudio();
  if (gameOver || flashingRows) return;
  switch (e.key) {
    case 'ArrowLeft':  e.preventDefault(); movePiece(-1, 0); break;
    case 'ArrowRight': e.preventDefault(); movePiece(1, 0);  break;
    case 'ArrowDown':  e.preventDefault(); movePiece(0, 1);  break;
    case 'ArrowUp':    e.preventDefault(); rotatePiece();    break;
    case 'z': case 'Z': rotatePiece(); break;
    case ' ':          e.preventDefault(); hardDrop();       break;
  }
});

document.getElementById('restart-btn').addEventListener('click', () => {
  startGame();
  initAudio();
});

// ── Auth UI ───────────────────────────────────────────────────────────────
const authModal = document.getElementById('auth-modal');

document.getElementById('auth-btn').addEventListener('click', () => {
  if (currentUser) {
    clearAuth();
  } else {
    openModal('login');
  }
});

document.getElementById('modal-close').addEventListener('click', () => {
  authModal.classList.add('hidden');
});

authModal.addEventListener('click', e => {
  if (e.target === authModal) authModal.classList.add('hidden');
});

function openModal(tab) {
  authModal.classList.remove('hidden');
  switchTab(tab);
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(p => p.classList.add('hidden'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.remove('hidden');
  document.getElementById(`${tab === 'login' ? 'login' : 'reg'}-error`).textContent = '';
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.getElementById('login-submit').addEventListener('click', async () => {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl  = document.getElementById('login-error');
  const btn      = document.getElementById('login-submit');
  errorEl.textContent = '';
  if (!email || !password) { errorEl.textContent = '이메일과 비밀번호를 입력해주세요'; return; }
  btn.disabled = true;
  try {
    const data = await apiRequest('POST', '/auth/login', { email, password });
    saveAuth(data.access_token, data.user);
    authModal.classList.add('hidden');
    document.getElementById('login-password').value = '';
    fetchTopScore();
  } catch (e) {
    errorEl.textContent = e.message;
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('login-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('login-submit').click();
});

document.getElementById('reg-submit').addEventListener('click', async () => {
  const username = document.getElementById('reg-username').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errorEl  = document.getElementById('reg-error');
  const btn      = document.getElementById('reg-submit');
  errorEl.textContent = '';
  if (!username) { errorEl.textContent = '닉네임을 입력해주세요'; return; }
  if (!email)    { errorEl.textContent = '이메일을 입력해주세요'; return; }
  if (password.length < 6) { errorEl.textContent = '비밀번호는 6자 이상이어야 합니다'; return; }
  btn.disabled = true;
  try {
    const data = await apiRequest('POST', '/auth/register', { username, email, password });
    saveAuth(data.access_token, data.user);
    authModal.classList.add('hidden');
    document.getElementById('reg-password').value = '';
    fetchTopScore();
  } catch (e) {
    errorEl.textContent = e.message;
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('reg-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('reg-submit').click();
});

// ── Init ──────────────────────────────────────────────────────────────────
loadAuth();
fetchTopScore();
setInterval(fetchTopScore, 30000); // 30초마다 최고점수 갱신
startGame();

// ── Mobile scaling ────────────────────────────────────────────────────────
function scaleGameArea() {
  const gameArea = document.querySelector('.game-area');
  const vw = document.documentElement.clientWidth;
  const naturalW = canvas.width + 20 + 140; // board + gap + sidebar
  if (vw >= naturalW + 32) {
    gameArea.style.transform = '';
    gameArea.style.marginBottom = '';
    return;
  }
  const scale = (vw - 16) / naturalW;
  const heightReduction = canvas.height * (1 - scale);
  gameArea.style.transform = `scale(${scale.toFixed(4)})`;
  gameArea.style.marginBottom = `-${Math.round(heightReduction)}px`;
}

window.addEventListener('resize', scaleGameArea);
scaleGameArea();

// ── Touch swipe on canvas ─────────────────────────────────────────────────
let touchStartX = 0, touchStartY = 0, lastSwipeX = 0, swipeMoved = false;

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  tryStartAudio();
  touchStartX = lastSwipeX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  swipeMoved = false;
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (gameOver || flashingRows) return;
  const dx = e.touches[0].clientX - lastSwipeX;
  if (Math.abs(dx) >= 20) {
    movePiece(dx > 0 ? 1 : -1, 0);
    lastSwipeX = e.touches[0].clientX;
    swipeMoved = true;
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  if (gameOver || flashingRows || swipeMoved) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  const absDx = Math.abs(dx), absDy = Math.abs(dy);
  if (absDx < 10 && absDy < 10) {
    rotatePiece();                          // tap → rotate
  } else if (dy > 40 && absDy > absDx) {
    hardDrop();                             // swipe down → hard drop
  } else if (dy < -30 && absDy > absDx) {
    rotatePiece();                          // swipe up → rotate
  }
}, { passive: false });

// ── On-screen button helpers ──────────────────────────────────────────────
function addRepeatBtn(id, action) {
  const btn = document.getElementById(id);
  if (!btn) return;
  let interval;
  const press = e => {
    e.preventDefault();
    tryStartAudio();
    if (!gameOver && !flashingRows) action();
    clearInterval(interval);
    interval = setInterval(() => { if (!gameOver && !flashingRows) action(); }, 100);
  };
  const release = () => clearInterval(interval);
  btn.addEventListener('touchstart', press, { passive: false });
  btn.addEventListener('touchend', release);
  btn.addEventListener('touchcancel', release);
  btn.addEventListener('mousedown', press);
  btn.addEventListener('mouseup', release);
  btn.addEventListener('mouseleave', release);
}

function addTapBtn(id, action) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('touchstart', e => {
    e.preventDefault();
    tryStartAudio();
    if (!gameOver && !flashingRows) action();
  }, { passive: false });
  btn.addEventListener('mousedown', () => {
    tryStartAudio();
    if (!gameOver && !flashingRows) action();
  });
}

addRepeatBtn('btn-left',   () => movePiece(-1, 0));
addRepeatBtn('btn-right',  () => movePiece(1, 0));
addRepeatBtn('btn-down',   () => movePiece(0, 1));
addTapBtn('btn-rotate', rotatePiece);
addTapBtn('btn-hard',   hardDrop);

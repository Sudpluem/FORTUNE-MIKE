const symbols = [
  { id: 'wild',   img: 'images/wild.png',   label: 'wild',   mult: 50  },
  { id: 'tong',   img: 'images/tong.jpg',   label: 'tong',   mult: 10  },
  { id: 'yok',    img: 'images/yok.jpg',    label: 'yok',    mult: 5   },
  { id: 'angpao', img: 'images/angpao.jpg', label: 'angpao', mult: 1.5 },
  { id: 'pratud', img: 'images/pratud.jpg', label: 'pratud', mult: 1   },
  { id: 'som',    img: 'images/som.jpg',    label: 'som',    mult: 0.5 },
];

const WEIGHTS = [50, 50, 50, 50, 50, 50];

let balance  = 1000;
let bet      = 10;
let totalWin = 0;
let spinning = false;
let turboMode = false;
let autoMode  = false;
let autoInterval = null;
let grid = Array(3).fill(null).map(() => Array(3).fill(0));

// ===== BUILD GRID =====
function buildReels() {
  const reelsEl = document.getElementById('reels');
  reelsEl.innerHTML = '';
  for (let col = 0; col < 3; col++) {
    const reelEl = document.createElement('div');
    reelEl.className = 'reel';
    reelEl.id = `reel-${col}`;
    for (let row = 0; row < 3; row++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.id = `cell-${col}-${row}`;
      reelEl.appendChild(cell);
    }
    reelsEl.appendChild(reelEl);
  }
}

function renderSymbol(cell, symIdx) {
  const sym = symbols[symIdx];
  if (sym.img) {
    cell.textContent = '';
    const img = document.createElement('img');
    img.src = sym.img;
    img.alt = sym.label;
    cell.appendChild(img);
  } else {
    cell.textContent = sym.emoji;
  }
}

function setCell(col, row, symIdx) {
  const cell = document.getElementById(`cell-${col}-${row}`);
  renderSymbol(cell, symIdx);
  grid[col][row] = symIdx;
}

function cryptoRandom() {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] / 0x100000000;
}

function randomSym() {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  let r = cryptoRandom() * total;
  for (let i = 0; i < WEIGHTS.length; i++) {
    r -= WEIGHTS[i];
    if (r <= 0) return i;
  }
  return symbols.length - 1;
}

// ===== SPIN =====
async function spin() {
  if (spinning) return;
  if (balance < bet) { alert('เครดิตไม่พอ! รีเฟรชเพื่อรับเครดิตใหม่'); return; }

  spinning = true;
  balance -= bet;
  totalWin = 0;
  updateUI();
  clearWinEffects();
  hideWinText();
  document.getElementById('btnSpin').disabled = true;

  // เร็วขึ้น: turbo 300ms, ปกติ 700ms
  const spinDuration = turboMode ? 300 : 700;
  const reelDelay    = turboMode ? 60  : 120;

  for (let col = 0; col < 3; col++) startSpinAnimation(col);

  for (let col = 0; col < 3; col++) {
    await sleep(spinDuration + col * reelDelay);
    stopReel(col);
  }

  await sleep(turboMode ? 80 : 150);

  const result = checkWin();
  const isWild = result.lines.some(l => l.sym === 0);

  if (result.amount > 0) {
    balance  += result.amount;
    totalWin  = result.amount;
    showWin(result);
  } else if (bet === 789) {
    document.getElementById('idleText').style.display = 'none';
    document.getElementById('winText').style.display = 'block';
    document.getElementById('winText').textContent = '🔥 เบทลับ WILD!';
    spawnParticles(10);
    setTimeout(() => triggerWildFeature(), 900);
  }

  updateUI();
  spinning = false;
  if (!isWild && bet !== 789) {
    document.getElementById('btnSpin').disabled = false;
  }
}

function startSpinAnimation(col) {
  for (let row = 0; row < 3; row++) {
    document.getElementById(`cell-${col}-${row}`).classList.add('spinning');
  }
  const iv = setInterval(() => {
    for (let row = 0; row < 3; row++) {
      const cell = document.getElementById(`cell-${col}-${row}`);
      renderSymbol(cell, Math.floor(cryptoRandom() * symbols.length));
    }
  }, 50); // อัพเดทรูปทุก 50ms — เร็วขึ้น
  document.getElementById(`reel-${col}`).dataset.interval = iv;
}

function stopReel(col) {
  clearInterval(parseInt(document.getElementById(`reel-${col}`).dataset.interval));
  for (let row = 0; row < 3; row++) {
    const idx = randomSym();
    grid[col][row] = idx;
    const cell = document.getElementById(`cell-${col}-${row}`);
    cell.classList.remove('spinning');
    renderSymbol(cell, idx);
  }
}

// ===== WIN CHECK =====
function checkWin() {
  let totalAmount = 0;
  const winLines  = [];
  const lineNames = ['top', 'mid', 'bot'];

  // แนวนอน — 3 ตัวเหมือนกันเท่านั้น
  for (let row = 0; row < 3; row++) {
    const [s0, s1, s2] = [grid[0][row], grid[1][row], grid[2][row]];
    if (s0 === s1 && s1 === s2) {
      const amount = bet * symbols[s0].mult;
      totalAmount += amount;
      winLines.push({ line: lineNames[row], cells: [[0,row],[1,row],[2,row]], mult: symbols[s0].mult, amount, sym: s0 });
    }
  }

  return { amount: totalAmount, lines: winLines };
}

function showWin(result) {
  document.getElementById('idleText').style.display = 'none';
  const winText = document.getElementById('winText');
  winText.style.display = 'block';

  const isWildJackpot = result.lines.some(l => l.sym === 0);
  if (isWildJackpot) {
    winText.textContent = `✨ WILD! +${result.amount}`;
    spawnParticles(15);
    document.getElementById('btnSpin').disabled = true;
    setTimeout(() => triggerWildFeature(), 900);
  } else {
    winText.textContent = `🏆 WIN! +${result.amount}`;
    spawnParticles(6);
  }

  result.lines.forEach(l => {
    const el = document.getElementById(`winLine${capitalize(l.line)}`);
    if (el) el.style.display = 'block';
    l.cells.forEach(([col, row]) => {
      document.getElementById(`cell-${col}-${row}`).classList.add('win-glow');
    });
  });
}

function clearWinEffects() {
  ['Top','Mid','Bot'].forEach(l => {
    const el = document.getElementById(`winLine${l}`);
    if (el) el.style.display = 'none';
  });
  for (let col = 0; col < 3; col++)
    for (let row = 0; row < 3; row++)
      document.getElementById(`cell-${col}-${row}`).classList.remove('win-glow');
}

function hideWinText() {
  document.getElementById('winText').style.display = 'none';
  document.getElementById('idleText').style.display = 'block';
}

// ===== WILD FEATURE =====
function triggerWildFeature() {
  const zoomEl = document.getElementById('wildZoomOverlay');
  zoomEl.classList.add('show');
  setTimeout(() => {
    zoomEl.classList.remove('show');
    buildFeatureGrid();
    document.getElementById('featureOverlay').classList.add('show');
  }, 1500);
}

function buildFeatureGrid() {
  const gridEl = document.getElementById('featureGrid');
  gridEl.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'feature-cell';
    cell.id = `fcell-${i}`;
    const img = document.createElement('img');
    img.src = symbols[0].img;
    img.alt = symbols[0].label;
    cell.appendChild(img);
    gridEl.appendChild(cell);
  }
  document.getElementById('featureTarget').innerHTML = '';
  document.getElementById('featureResult').textContent = '';
  document.getElementById('featureSpinBtn').style.display = 'flex';
  document.getElementById('featureSpinBtn').disabled = false;
  document.getElementById('featureCloseBtn').style.display = 'none';
}

async function featureSpin() {
  document.getElementById('featureSpinBtn').disabled = true;

  // สุ่ม 1 symbol เป็นเป้าหมาย (เบทลับ = wild เสมอ)
  const targetIdx = bet === 789 ? 0 : Math.floor(cryptoRandom() * symbols.length);
  const target = symbols[targetIdx];
  document.getElementById('featureTarget').innerHTML =
    `🎯 เป้าหมาย: <img src="${target.img}" alt="${target.label}"> ${target.label}`;

  const cells = Array.from({length: 9}, (_, i) => document.getElementById(`fcell-${i}`));
  cells.forEach(c => c.classList.add('feature-spinning'));

  // หมุนสุ่มรูปไปเรื่อยๆ 2.5 วินาที
  const iv = setInterval(() => {
    cells.forEach(cell => {
      const sym = symbols[Math.floor(cryptoRandom() * symbols.length)];
      cell.innerHTML = `<img src="${sym.img}" alt="${sym.label}">`;
    });
  }, 80);

  await sleep(2500);
  clearInterval(iv);
  cells.forEach(c => c.classList.remove('feature-spinning'));

  // เบทลับ = ชนะ 100% ด้วย wild, ปกติ = 30%
  const allMatch = bet === 789 || cryptoRandom() < 0.30;

  if (allMatch) {
    cells.forEach(cell => {
      cell.innerHTML = `<img src="${target.img}" alt="${target.label}">`;
      cell.classList.add('feature-win-glow');
    });
    const prize = Math.round(bet * target.mult * 10);
    balance += prize;
    totalWin += prize;
    updateUI();
    document.getElementById('featureResult').textContent = `🎉 ALL MATCH! +${prize} เครดิต!`;
    spawnParticles(25);
  } else {
    cells.forEach(cell => {
      const sym = symbols[Math.floor(cryptoRandom() * symbols.length)];
      cell.innerHTML = `<img src="${sym.img}" alt="${sym.label}">`;
    });
    document.getElementById('featureResult').textContent = 'ไม่ตรง... โชคดีครั้งหน้านะ!';
  }

  document.getElementById('featureSpinBtn').style.display = 'none';
  document.getElementById('featureCloseBtn').style.display = 'block';
}

function closeFeature() {
  document.getElementById('featureOverlay').classList.remove('show');
  Array.from({length: 9}, (_, i) => document.getElementById(`fcell-${i}`))
    .forEach(c => c && c.classList.remove('feature-win-glow'));
  document.getElementById('btnSpin').disabled = false;
}

// ===== PARTICLES =====
function spawnParticles(count = 10) {
  const wrapper = document.getElementById('gameWrapper');
  const emojis  = ['🎉','✨','💰','🌟','🎊','💫','🪙'];
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const p = document.createElement('div');
      p.className   = 'particle';
      p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      p.style.left  = Math.random() * 90 + '%';
      p.style.top   = Math.random() * 60 + 20 + '%';
      wrapper.appendChild(p);
      setTimeout(() => p.remove(), 1600);
    }, i * 70);
  }
}

// ===== BET =====
function changeBet(delta) {
  if (spinning) return;
  if (bet === 100 && delta > 0) {
    bet = 789;
  } else if (bet === 789 && delta < 0) {
    bet = 100;
  } else if (bet !== 789) {
    bet = Math.max(10, Math.min(100, bet + delta));
  }
  updateUI();
}

// ===== TURBO / AUTO =====
function toggleTurbo() {
  turboMode = !turboMode;
  document.getElementById('btnTurbo').classList.toggle('active-btn', turboMode);
}

function toggleAuto() {
  autoMode = !autoMode;
  document.getElementById('btnAuto').classList.toggle('active-btn', autoMode);
  if (autoMode) {
    autoInterval = setInterval(() => { if (!spinning) spin(); }, turboMode ? 500 : 1200);
  } else {
    clearInterval(autoInterval);
  }
}

// ===== UI =====
function updateUI() {
  document.getElementById('balanceDisplay').textContent = balance;
  document.getElementById('betDisplay').textContent     = bet;
  document.getElementById('winDisplay').textContent     = totalWin;
  document.getElementById('betAmt').textContent         = bet === 789 ? '🔥 ลับ 789' : `฿${bet}`;
}

// ===== UTILS =====
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ===== INIT =====
buildReels();
for (let col = 0; col < 3; col++)
  for (let row = 0; row < 3; row++)
    setCell(col, row, randomSym());
updateUI();

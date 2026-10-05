const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const textMenu = document.getElementById('textFloatingMenu');
const bInput = document.getElementById('brightness');
const cInput = document.getElementById('contrast');
const sInput = document.getElementById('saturation');
const nInput = document.getElementById('noise');
const subjAmt = document.getElementById('subjectAmount');
const tInput = document.getElementById('textContent');
const sizeInput = document.getElementById('fontSize');

let img = new Image();
let imgLoaded = false;
let originalImageSrc = null;
let currentFilter = 'none';
let currentBorder = 'none';
let currentBorderColor = '#ffffff';
let currentBorderSize = 5;
let currentTemplate = 'none';
let currentBgColor = null;
let currentBgColorSize = 8;
let currentBgImage = null;
let currentBgImageSize = 8;
let currentProjectId = null;
let currentProjectName = '';
let currentFx = 'none';
let currentFxAmount = 70;
let advDefaultSize = 35;
let removedSubjectImage = null;

let textLayers = [];
let activeLayerId = null;
let isDraggingText = false;
let undoStack = [], redoStack = [];
let touches = new Map();
let gesture = null;
let subjectMode = 'none';
let strokeColor = '#ffffff';
let personMask = null;
let subjectReady = false;
let selfieSeg = null;
let crop = { x:0, y:0, w:1, h:1 };
let cropDrag = null;
let counterLocked = false;

const BG_COLORS = ['#ffffff', '#ff2c2c', '#000000'];

const TEMPLATES = [
  { name:'None',b:100,c:100,s:100,n:0,f:'none' },
  { name:'Fresh',b:106,c:104,s:112,n:0,f:'none' },
  { name:'Euro',b:98,c:108,s:92,n:12,f:'sepia(22%)' },
  { name:'Portrait',b:108,c:96,s:112,n:6,f:'none' },
  { name:'Moody',b:90,c:125,s:90,n:8,f:'none' },
  { name:'Cinematic',b:96,c:118,s:95,n:6,f:'hue-rotate(-6deg) saturate(95%)' },
  { name:'Summer',b:108,c:108,s:128,n:0,f:'saturate(120%)' },
  { name:'Mono',b:100,c:118,s:0,n:0,f:'grayscale(100%)' },
  { name:'Noir',b:92,c:150,s:0,n:14,f:'grayscale(100%) contrast(140%)' },
  { name:'Golden',b:106,c:106,s:116,n:12,f:'sepia(30%) saturate(120%)' }
];

const FILTERS = [
  { name:'Normal', code:'none' },
  { name:'Mono', code:'grayscale(100%) contrast(140%)' },
  { name:'Vintage', code:'sepia(80%) contrast(130%)' },
  { name:'Cyber', code:'invert(15%) hue-rotate(180deg)' },
  { name:'Neon', code:'hue-rotate(90deg) saturate(150%)' },
  { name:'Velvet', code:'hue-rotate(270deg) saturate(140%)' }
];

const BORDERS = [
  { name:'None', code:'none' },
  { name:'Frame', code:'white' },
  { name:'Thick', code:'black' },
  { name:'Rounded', code:'rounded' },
  { name:'Polaroid', code:'polaroid' },
  { name:'Shadow', code:'shadow' }
];

const EFFECTS_BASE = './effects/';
let FX_CATEGORIES = [];
let currentFxTab = 'grunge';
const ADVISORY_CONFIG = { prefix:'advisory', max:12, files:[] };
const BG_CONFIG = { prefix:'background', max:12, files:[] };
const fxImages = {};
const advisoryImages = {};
const bgImages = {};

function loadImage(url) {
  return new Promise(res => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = url;
  });
}

async function loadCategoryConfig() {
  try {
    const r = await fetch('./effects.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('not found');
    const data = await r.json();
    if (data && Array.isArray(data.categories)) {
      FX_CATEGORIES = data.categories.map(c => ({
        key: c.prefix, label: c.label || c.prefix, prefix: c.prefix,
        blend: c.blend || 'screen', max: 60, files: []
      }));
    }
  } catch (e) {
    FX_CATEGORIES = [
      { key:'grunge', label:'Grunge', prefix:'grunge', blend:'screen', max:60, files:[] },
      { key:'lightleak', label:'Light Leak', prefix:'lightleak', blend:'screen', max:60, files:[] },
      { key:'fire', label:'Fire', prefix:'fire', blend:'screen', max:60, files:[] },
      { key:'noise', label:'Noise', prefix:'noise', blend:'overlay', max:60, files:[] },
      { key:'streetlight', label:'Street Light', prefix:'streetlight', blend:'screen', max:60, files:[] },
      { key:'af', label:'AF', prefix:'af', blend:'screen', max:60, files:[] },
      { key:'heart', label:'Heart', prefix:'heart', blend:'normal', max:60, files:[] }
    ];
  }
  if (FX_CATEGORIES.length && !FX_CATEGORIES.find(c => c.key === currentFxTab)) currentFxTab = FX_CATEGORIES[0].key;
}

async function probeOne(base) {
  let im = await loadImage(EFFECTS_BASE + base + '.jpg');
  if (im) return { fname: base + '.jpg', im };
  im = await loadImage(EFFECTS_BASE + base + '.jpeg');
  if (im) return { fname: base + '.jpeg', im };
  im = await loadImage(EFFECTS_BASE + base + '.png');
  if (im) return { fname: base + '.png', im };
  return null;
}

async function probeCategory(cat) {
  const promises = [];
  for (let i = 1; i <= cat.max; i++) {
    promises.push(probeOne(cat.prefix + i).then(r => r ? { base: cat.prefix + i, ...r } : null));
  }
  const results = await Promise.all(promises);
  cat.files = results.filter(r => r !== null);
  cat.files.forEach(r => { fxImages[cat.key + ':' + r.fname] = r.im; });
}

async function probeAdvisory() {
  const cfg = ADVISORY_CONFIG;
  const promises = [];
  for (let i = 1; i <= cfg.max; i++) {
    promises.push((async () => {
      let r = await probeOne('Advisory' + i);
      if (r) return r;
      r = await probeOne('advisory' + i);
      return r;
    })());
  }
  const results = await Promise.all(promises);
  cfg.files = results.filter(r => r !== null);
  cfg.files.forEach(r => { advisoryImages[r.fname] = r.im; });
}

async function probeBackgrounds() {
  const cfg = BG_CONFIG;
  const promises = [];
  for (let i = 1; i <= cfg.max; i++) promises.push(probeOne('background' + i));
  const results = await Promise.all(promises);
  cfg.files = results.filter(r => r !== null);
  cfg.files.forEach(r => { bgImages[r.fname] = r.im; });
}

async function preloadEffects() {
  await loadCategoryConfig();
  await Promise.all([
    ...FX_CATEGORIES.map(c => probeCategory(c)),
    probeAdvisory(),
    probeBackgrounds()
  ]);
  buildFxTabs();
  buildFxGrids();
  buildAdvisoryGrid();
  buildBgImageGrid();
}

// ============ 5-SEC COUNT SPLASH (LOCKED) ============
function playCount(callback) {
  if (counterLocked) return;
  counterLocked = true;
  const el = document.getElementById('splashScreen');
  const c = document.getElementById('splashCount');
  const b = document.getElementById('splashBarFill');
  const s = document.getElementById('splashStatus');
  if (!el) { counterLocked = false; if (callback) callback(); return; }
  el.classList.remove('fade-out');
  el.style.display = 'flex';
  if (s) s.textContent = 'Loading…';

  const DURATION = 5000;
  const start = performance.now();
  let callbackRun = false;

  function step(now) {
    const elapsed = now - start;
    const pct = Math.min(100, Math.round((elapsed / DURATION) * 100));
    if (c) c.textContent = pct;
    if (b) b.style.width = pct + '%';

    if (!callbackRun && pct >= 30 && callback) {
      callbackRun = true;
      try { callback(); } catch (e) { console.warn(e); }
    }

    if (pct < 100) {
      requestAnimationFrame(step);
    } else {
      if (!callbackRun && callback) { try { callback(); } catch (e) {} }
      setTimeout(() => {
        el.classList.add('fade-out');
        setTimeout(() => {
          el.style.display = 'none';
          counterLocked = false;
        }, 500);
      }, 200);
    }
  }
  requestAnimationFrame(step);
}

function buildFxTabs() {
  const bar = document.getElementById('fxTabBar');
  if (!bar) return;
  let html = '';
  FX_CATEGORIES.forEach(cat => {
    const sel = (currentFxTab === cat.key) ? 'active' : '';
    html += `<button class="sub-tab ${sel}" onclick="switchFxTab('${cat.key}', this)">${cat.label.toUpperCase()}</button>`;
  });
  bar.innerHTML = html;
}

function buildFxGrids() {
  const container = document.getElementById('fxGrids');
  if (!container) return;
  let html = '';
  FX_CATEGORIES.forEach(cat => {
    const active = (currentFxTab === cat.key) ? 'active' : '';
    html += `<div id="fx-tab-${cat.key}" class="sub-view ${active}"><div class="fx-grid" id="fxGrid-${cat.key}"></div></div>`;
  });
  container.innerHTML = html;
  FX_CATEGORIES.forEach(cat => buildFxGrid(cat.key));
}

function switchFxTab(key, el) {
  currentFxTab = key;
  const panel = el.closest('.panel');
  panel.querySelectorAll('.sub-view').forEach(v => v.classList.remove('active'));
  panel.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('fx-tab-' + key).classList.add('active');
  el.classList.add('active');
}

function buildFxGrid(catKey) {
  const cat = FX_CATEGORIES.find(c => c.key === catKey);
  if (!cat) return;
  const g = document.getElementById('fxGrid-' + catKey);
  if (!g) return;
  let html = `<div class="fx-card ${currentFx === catKey + ':none' ? 'selected' : ''}" onclick="setFx('${catKey}:none', this)">
    <div class="fx-card-preview" style="display:flex;align-items:center;justify-content:center;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </div>
    <span class="fx-card-label">Off</span>
  </div>`;
  if (!cat.files || !cat.files.length) {
    html += `<div class="filter-empty">No files</div>`;
  } else {
    cat.files.forEach(f => {
      const key = catKey + ':' + f.fname;
      const sel = (currentFx === key) ? 'selected' : '';
      html += `<div class="fx-card ${sel}" onclick="setFx('${key}', this)">
        <div class="fx-card-preview"><img src="${EFFECTS_BASE + f.fname}" style="width:100%;height:100%;object-fit:cover;" alt=""></div>
        <span class="fx-card-label">${f.base}</span>
      </div>`;
    });
  }
  g.innerHTML = html;
}

function setFx(key, el) {
  currentFx = key;
  document.querySelectorAll('.fx-card').forEach(c => c.classList.remove('selected'));
  if (el) el.classList.add('selected');
  redraw(); saveState();
}

function setFxAmount(v) {
  currentFxAmount = parseInt(v);
  document.getElementById('fxVal').innerText = v;
  redraw(); saveState();
}

function buildAdvisoryGrid() {
  const g = document.getElementById('stickerGrid');
  if (!g) return;
  if (!ADVISORY_CONFIG.files.length) { g.innerHTML = '<div class="filter-empty">No files</div>'; return; }
  let html = '';
  ADVISORY_CONFIG.files.forEach(f => {
    html += `<div class="sticker-item" onclick="addSticker('${f.fname}')"><img src="${EFFECTS_BASE + f.fname}" alt=""></div>`;
  });
  g.innerHTML = html;
}

function buildBgImageGrid() {
  const g = document.getElementById('bgImageGrid');
  if (!g) return;
  if (!BG_CONFIG.files.length) { g.innerHTML = '<div class="filter-empty">No files</div>'; return; }
  let html = '';
  BG_CONFIG.files.forEach(f => {
    const sel = (currentBgImage && currentBgImage.src.endsWith(f.fname)) ? 'selected' : '';
    html += `<div class="bg-item ${sel}" onclick="setBgImage('${f.fname}', this)"><img src="${EFFECTS_BASE + f.fname}" alt=""></div>`;
  });
  g.innerHTML = html;
}

function setBgImage(fname, el) {
  const im = bgImages[fname];
  if (!im) return;
  currentBgImage = im;
  currentBgColor = null;
  document.querySelectorAll('.bg-item').forEach(x => x.classList.remove('selected'));
  if (el) el.classList.add('selected');
  document.querySelectorAll('.bgcolor-swatch').forEach(s => s.classList.remove('selected'));
  redraw(); saveState();
}

function setBgImageSize(v) {
  currentBgImageSize = parseInt(v);
  document.getElementById('bgImgSizeVal').innerText = v;
  redraw(); saveState();
}

function clearBgImage() {
  currentBgImage = null;
  document.querySelectorAll('.bg-item').forEach(x => x.classList.remove('selected'));
  redraw(); saveState();
}

function setAdvDefaultSize(v) {
  advDefaultSize = parseInt(v);
  document.getElementById('advSizeVal').innerText = v;
}

function addSticker(fname) {
  const im = advisoryImages[fname];
  if (!im || !imgLoaded) return;
  const w = Math.round(Math.min(canvas.width, canvas.height) * (advDefaultSize / 100));
  const h = Math.round(w * (im.naturalHeight / im.naturalWidth));
  const id = Date.now() + Math.random();
  const layer = { id, image: im, imageUrl: EFFECTS_BASE + fname, isImage: true, x: canvas.width/2, y: canvas.height/2, width: w, height: h, rotation: 0, size: w };
  textLayers.push(layer);
  activeLayerId = id;
  updateTextLayersUI();
  showFloatingMenu(layer.x, layer.y);
  redraw(); saveState();
}

function trimActiveSticker() {
  const l = textLayers.find(x => x.id === activeLayerId);
  if (!l || !l.isImage || !l.image) { alert('Select a sticker on the canvas first'); return; }
  const im = l.image;
  const c = document.createElement('canvas');
  c.width = im.naturalWidth || im.width;
  c.height = im.naturalHeight || im.height;
  const cx = c.getContext('2d');
  cx.drawImage(im, 0, 0);
  const d = cx.getImageData(0, 0, c.width, c.height).data;
  let minX = c.width, minY = c.height, maxX = 0, maxY = 0;
  for (let y = 0; y < c.height; y += 2) {
    for (let x = 0; x < c.width; x += 2) {
      const i = (y * c.width + x) * 4;
      const bright = (d[i] + d[i+1] + d[i+2]) / 3;
      if (bright < 200) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (minX >= maxX || minY >= maxY) { alert('Nothing to trim'); return; }
  const tw = maxX - minX, th = maxY - minY;
  const tc = document.createElement('canvas');
  tc.width = tw; tc.height = th;
  tc.getContext('2d').drawImage(c, minX, minY, tw, th, 0, 0, tw, th);
  const trimmed = new Image();
  trimmed.onload = () => {
    l.image = trimmed;
    l.height = Math.round(l.width * (th / tw));
    redraw(); saveState();
  };
  trimmed.src = tc.toDataURL('image/png');
}

// ============ BG REMOVER (NEW) ============
function showBGRemoverPanel() {
  const menu = document.getElementById('bgRemoverMenu');
  if (menu) menu.style.display = 'block';
  const out = document.getElementById('bgRemoverOutput');
  if (out) out.style.display = 'none';
}

function hideBGRemoverPanel() {
  const menu = document.getElementById('bgRemoverMenu');
  if (menu) menu.style.display = 'none';
  const out = document.getElementById('bgRemoverOutput');
  if (out) out.style.display = 'block';
}

async function removeBgFast() {
  if (!imgLoaded) { alert('Load a photo first'); return; }
  if (typeof SelfieSegmentation === 'undefined') { alert('Model not loaded'); return; }
  playCount(async () => {
    try {
      if (!selfieSeg) {
        selfieSeg = new SelfieSegmentation({ locateFile:f => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/${f}` });
        selfieSeg.setOptions({ modelSelection:1 });
      }
      const result = await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('Timed out')), 30000);
        selfieSeg.onResults(r => { clearTimeout(t); resolve(r); });
        selfieSeg.send({ image: img });
      });
      const c = document.createElement('canvas');
      c.width = canvas.width; c.height = canvas.height;
      const cx = c.getContext('2d');
      cx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const mask = document.createElement('canvas');
      mask.width = canvas.width; mask.height = canvas.height;
      const mctx = mask.getContext('2d');
      mctx.drawImage(result.segmentationMask, 0, 0, canvas.width, canvas.height);
      const id = mctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) d[i+3] = d[i];
      mctx.putImageData(id, 0, 0);
      cx.globalCompositeOperation = 'destination-in';
      cx.drawImage(mask, 0, 0);
      const url = c.toDataURL('image/png');
      const newImg = new Image();
      newImg.onload = () => {
        removedSubjectImage = newImg;
        img = newImg;
        originalImageSrc = url;
        imgLoaded = true;
        currentBgColor = '#ffffff';
        buildBgColors();
        redraw(); saveState();
      };
      newImg.src = url;
    } catch (e) { alert('Fast remove failed: ' + e.message); }
  });
}

async function removeBgBest() {
  if (!imgLoaded) { alert('Load a photo first'); return; }
  playCount(async () => {
    try {
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width; tmp.height = canvas.height;
      tmp.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = tmp.toDataURL('image/jpeg', 0.9);
      const r = await fetch('/api/remove-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl })
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        alert('Best remove failed: ' + (err.error || r.status));
        return;
      }
      const data = await r.json();
      if (!data.image) { alert('No image returned'); return; }
      const newImg = new Image();
      newImg.onload = () => {
        removedSubjectImage = newImg;
        img = newImg;
        originalImageSrc = data.image;
        canvas.width = newImg.width;
        canvas.height = newImg.height;
        imgLoaded = true;
        currentBgColor = '#ffffff';
        buildBgColors();
        redraw(); saveState();
      };
      newImg.src = data.image;
    } catch (e) { alert('Best remove failed: ' + e.message); }
  });
}

// ============ TEXT PANEL ============
function buildFontGrid() {
  const c = document.getElementById('fontGridContainer');
  const fontList = ["Impact","Bebas Neue","Oswald","Montserrat","Anton","Pacifico","Permanent Marker","Russo One","Press Start 2P","Righteous","Orbitron","Bungee","Bungee Inline","Creepster","Monoton","Luckiest Guy","Rye","Satisfy","Yellowtail","Chewy","Alfa Slab One","Cinzel","Audiowide","Black Ops One","Chango","Coiny","Damion","Diplomata SC","Frijole","Gloria Hallelujah","Gugi","Knewave","Lobster","Parisienne","Poppins","Playfair Display","Special Elite","Great Vibes","Merriweather","Dancing Script"];
  let html = '';
  fontList.forEach(f => {
    const sel = (f === 'Impact') ? 'selected' : '';
    html += `<div class="font-pill ${sel}" style="font-family:'${f}',sans-serif" onclick="setActiveFont('${f}', this)">${f}</div>`;
  });
  c.innerHTML = html;
}

function buildBgColors() {
  const c = document.getElementById('bgColorRow');
  if (!c) return;
  let html = '';
  const noneSel = (!currentBgColor && !currentBgImage) ? 'selected' : '';
  html += `<div class="bgcolor-swatch ${noneSel}" style="background:linear-gradient(135deg,#2a2a2a 45%,#111 45%,#111 55%,#2a2a2a 55%);display:flex;align-items:center;justify-content:center;" onclick="setBgColor(null, this)">
    <span style="color:#888;font-size:11px;font-weight:700;letter-spacing:1px;">NONE</span>
  </div>`;
  BG_COLORS.forEach(col => {
    const sel = (currentBgColor === col) ? 'selected' : '';
    html += `<div class="bgcolor-swatch ${sel}" style="background:${col};" onclick="setBgColor('${col}', this)"></div>`;
  });
  c.innerHTML = html;
}

function setBgColor(color, el) {
  currentBgColor = color;
  currentBgImage = null;
  document.querySelectorAll('.bgcolor-swatch').forEach(s => s.classList.remove('selected'));
  document.querySelectorAll('.bg-item').forEach(x => x.classList.remove('selected'));
  if (el) el.classList.add('selected');
  redraw(); saveState();
}

function setBgColorSize(v) {
  currentBgColorSize = parseInt(v);
  document.getElementById('bgColorSizeVal').innerText = v;
  redraw(); saveState();
}

function buildTemplates() {
  const c = document.getElementById('templateContainer');
  if (!c) return;
  if (!imgLoaded || !img.src) { c.innerHTML = '<div class="filter-empty">Load a photo to see templates</div>'; return; }
  const src = img.src;
  let html = '';
  TEMPLATES.forEach((t, i) => {
    const sel = (currentTemplate === t.name) ? 'selected' : '';
    const filterStyle = `brightness(${t.b}%) contrast(${t.c}%) saturate(${t.s}%) ${t.f !== 'none' ? t.f : ''}`;
    html += `<div class="template-thumb ${sel}" onclick="applyTemplate(${i}, this)">
      <div class="template-thumb-img" style="background-image:url('${src}'); filter:${filterStyle};"></div>
      <span class="template-thumb-label">${t.name}</span>
    </div>`;
  });
  c.innerHTML = html;
}

function applyTemplate(i, el) {
  const t = TEMPLATES[i]; if (!t) return;
  bInput.value=t.b; cInput.value=t.c; sInput.value=t.s; nInput.value=t.n;
  currentFilter = t.f; currentTemplate = t.name;
  el.parentElement.querySelectorAll('.template-thumb').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  buildFilterThumbs(); redraw(); saveState();
}

function buildBorders() {
  const c = document.getElementById('borderContainer');
  if (!c) return;
  let html = '';
  BORDERS.forEach(b => {
    const sel = (currentBorder === b.code) ? 'selected' : '';
    html += `<div class="border-thumb ${sel}" onclick="setBorder('${b.code}', this)">
      <div class="border-thumb-img">${borderPreviewHTML(b.code)}</div>
      <span class="border-thumb-label">${b.name}</span>
    </div>`;
  });
  c.innerHTML = html;
}

function borderPreviewHTML(code) {
  const col = currentBorderColor;
  if (code === 'none') return '<div class="bt-inner"></div>';
  if (code === 'white') return `<div class="bt-inner"></div><div style="position:absolute;inset:0;border:5px solid ${col};box-sizing:border-box;"></div>`;
  if (code === 'black') return `<div class="bt-inner"></div><div style="position:absolute;inset:0;border:8px solid ${col};box-sizing:border-box;"></div>`;
  if (code === 'rounded') return `<div class="bt-inner"></div><div style="position:absolute;inset:3px;border:4px solid ${col};border-radius:10px;box-sizing:border-box;"></div>`;
  if (code === 'polaroid') return `<div class="bt-inner" style="inset:0 0 14px 0;"></div><div style="position:absolute;inset:0;border:4px solid ${col};border-bottom-width:12px;box-sizing:border-box;"></div>`;
  if (code === 'shadow') return `<div class="bt-inner"></div><div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,transparent 30%,rgba(0,0,0,.85) 100%);"></div>`;
  return '<div class="bt-inner"></div>';
}

function setBorder(code, el) {
  currentBorder = code;
  el.parentElement.querySelectorAll('.border-thumb').forEach(t => t.classList.remove('selected'));
  el.classList.add('selected');
  redraw(); saveState();
}

function setBorderColor(color, el) {
  currentBorderColor = color;
  if (el) {
    el.parentElement.querySelectorAll('.bcolor-circle').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
  }
  buildBorders(); redraw(); saveState();
}

function setBorderSize(v) {
  currentBorderSize = parseInt(v);
  document.getElementById('borderSizeVal').innerText = v;
  redraw(); saveState();
}

function buildFilterThumbs() {
  const el = document.getElementById('filterThumbsContainer');
  if (!el) return;
  if (!imgLoaded || !img.src) { el.innerHTML = '<div class="filter-empty">Load a photo to see filters</div>'; return; }
  const src = img.src;
  let html = '';
  FILTERS.forEach((f, i) => {
    const sel = (currentFilter === f.code) ? 'selected' : '';
    const filterStyle = f.code === 'none' ? 'none' : f.code;
    html += `<div class="filter-thumb ${sel}" onclick="applyFilterByIndex(${i}, this)">
      <div class="filter-thumb-img" style="background-image:url('${src}'); filter:${filterStyle};"></div>
      <span class="filter-thumb-label">${f.name}</span>
    </div>`;
  });
  el.innerHTML = html;
}

function applyFilterByIndex(i, el) {
  const f = FILTERS[i]; if (!f) return;
  currentFilter = f.code; currentTemplate = 'none';
  el.parentElement.querySelectorAll('.filter-thumb').forEach(t => t.classList.remove('selected'));
  el.classList.add('selected');
  saveState(); redraw();
}

// ============ HOME SCREEN ============
function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff/60) + ' min ago';
  if (diff < 86400) return Math.floor(diff/3600) + ' hr ago';
  if (diff < 604800) return Math.floor(diff/86400) + 'd ago';
  return d.toLocaleDateString();
}

function renderProjectsList() {
  const container = document.getElementById('gallery');
  const keys = Object.keys(localStorage).filter(k => k.startsWith('music_proj_'));
  const items = [];
  keys.forEach(key => {
    try {
      const p = JSON.parse(localStorage.getItem(key));
      items.push({
        key, image: p.image, name: p.name || 'Untitled',
        date: p.date || null,
        timestamp: p.savedAt || new Date(p.date || 0).getTime() || 0
      });
    } catch(e) {}
  });
  items.sort((a, b) => b.timestamp - a.timestamp);

  let html = '';
  if (items.length === 0) {
    html = `<div class="home-empty">
      <div class="home-empty-icon">🎨</div>
      <div class="home-empty-title">START YOUR FIRST COVER</div>
      <div class="home-empty-sub">Upload a photo and make something real.</div>
      <button class="home-empty-btn" onclick="document.getElementById('homeImageUpload').click()">+ Create New</button>
    </div>`;
  } else {
    const featured = items[0];
    html += `<div class="featured-card" onclick="openProjectWithCount('${featured.key}')">
      <div class="featured-img"><img src="${featured.image}" alt=""></div>
      <div class="featured-info">
        <div class="featured-name">${featured.name}</div>
        <div class="featured-date">${timeAgo(featured.date)}</div>
      </div>
    </div>`;

    if (items.length > 1) {
      html += `<div class="section-title">All Projects</div><div class="projects-grid">`;
      items.slice(1).forEach(it => {
        html += `<div class="project-card" onclick="openProjectWithCount('${it.key}')">
          <div class="project-card-img"><img src="${it.image}" alt=""></div>
          <div class="project-card-info">
            <div class="project-card-name">${it.name}</div>
            <div class="project-card-date">${timeAgo(it.date)}</div>
          </div>
          <button class="project-card-del" onclick="event.stopPropagation();deleteProject('${it.key}')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>`;
      });
      html += `</div>`;
    }
  }
  container.innerHTML = html;
}

function openProjectWithCount(key) {
  if (counterLocked) return;
  playCount(() => { loadProject(key); });
}

function deleteProject(key) {
  if (confirm("Delete this project?")) { localStorage.removeItem(key); renderProjectsList(); }
}function setupCanvasFromImage(newImg) {
  img = newImg;
  const MAX = 1080;
  let w = newImg.width, h = newImg.height;
  if (w > MAX || h > MAX) { const s = MAX / Math.max(w, h); w = Math.round(w*s); h = Math.round(h*s); }
  canvas.width = w; canvas.height = h;
}

// ============ UNDO — WISE (never removes photo) ============
function resetStudioState() {
  img = new Image();
  imgLoaded = false;
  originalImageSrc = null;
  textLayers = [];
  activeLayerId = null;
  currentFilter = 'none';
  currentBorder = 'none';
  currentBorderColor = '#ffffff';
  currentBorderSize = 5;
  currentTemplate = 'none';
  currentBgColor = null;
  currentBgImage = null;
  currentFx = 'none';
  currentFxAmount = 70;
  crop = { x:0, y:0, w:1, h:1 };
  subjectMode = 'none';
  personMask = null;
  subjectReady = false;
  removedSubjectImage = null;
  undoStack = []; redoStack = [];
  updateHistoryButtons();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function saveState() {
  if (!imgLoaded) return;
  const state = canvas.toDataURL();
  // Skip if same as last
  if (undoStack.length && undoStack[undoStack.length - 1] === state) return;
  // Only keep last 25
  undoStack.push(state);
  if (undoStack.length > 25) undoStack.shift();
  redoStack = [];
  updateHistoryButtons();
}

function undo() {
  // Wise: never go past the state where photo was loaded
  if (undoStack.length > 1) {
    redoStack.push(undoStack.pop());
    const prev = undoStack[undoStack.length - 1];
    const t = new Image();
    t.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(t, 0, 0);
      updateHistoryButtons();
    };
    t.src = prev;
    haptic(6);
  }
}

function redo() {
  if (redoStack.length) {
    const nxt = redoStack.pop();
    undoStack.push(nxt);
    const t = new Image();
    t.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(t, 0, 0);
      updateHistoryButtons();
    };
    t.src = nxt;
    haptic(6);
  }
}

function updateHistoryButtons() {
  document.getElementById('undoBtn').disabled = undoStack.length <= 1;
  document.getElementById('redoBtn').disabled = redoStack.length === 0;
}

function getCanvasCoordinates(e, touch) {
  const rect = canvas.getBoundingClientRect();
  const cx = touch ? touch.clientX : (e.touches ? e.touches[0].clientX : e.clientX);
  const cy = touch ? touch.clientY : (e.touches ? e.touches[0].clientY : e.clientY);
  return { x:(cx-rect.left)*(canvas.width/rect.width), y:(cy-rect.top)*(canvas.height/rect.height) };
}

function touchDist(a,b) { return Math.hypot(a.x-b.x, a.y-b.y); }
function touchAngle(a,b) { return Math.atan2(b.y-a.y, b.x-a.x); }
function haptic(ms) { if (navigator.vibrate) try { navigator.vibrate(ms || 4); } catch(e) {} }

canvas.addEventListener('mousedown', startTouch);
canvas.addEventListener('touchstart', startTouch, {passive:false});
canvas.addEventListener('mousemove', onTouchMove);
canvas.addEventListener('touchmove', onTouchMove, {passive:false});
canvas.addEventListener('mouseup', endTouch);
canvas.addEventListener('touchend', endTouch);
canvas.addEventListener('touchcancel', endTouch);

function startTouch(e) {
  if (!imgLoaded || isCropPanelActive()) return;
  if (e.preventDefault) e.preventDefault();
  if (e.touches) { touches.clear(); for (const t of e.touches) touches.set(t.identifier, { x:t.clientX, y:t.clientY }); }
  else { touches.clear(); touches.set('mouse', { x:e.clientX, y:e.clientY }); }

  if (touches.size === 2) {
    const arr = Array.from(touches.values());
    const dist = touchDist(arr[0], arr[1]);
    const ang = touchAngle(arr[0], arr[1]);
    if (activeLayerId !== null) {
      const l = textLayers.find(x => x.id === activeLayerId);
      if (l) {
        gesture = { type:'text', id:l.id, startDist:dist, startAngle:ang, startSize:l.size||l.width||100, startRot:l.rotation||0 };
        return;
      }
    }
    return;
  }
  if (touches.size !== 1) return;
  const pos = getCanvasCoordinates(e, e.touches ? e.touches[0] : null);

  let clickedLayer = null;
  for (let i = textLayers.length - 1; i >= 0; i--) {
    const layer = textLayers[i];
    if (layer.isImage) {
      const hw = layer.width / 2, hh = layer.height / 2;
      if (pos.x >= layer.x - hw - 10 && pos.x <= layer.x + hw + 10 && pos.y >= layer.y - hh - 10 && pos.y <= layer.y + hh + 10) { clickedLayer = layer; break; }
    } else {
      ctx.font = `bold ${layer.size}px '${layer.font}', sans-serif`;
      const m = ctx.measureText(layer.text);
      const w = m.width, h = parseInt(layer.size);
      if (pos.x >= layer.x - w/2 - 20 && pos.x <= layer.x + w/2 + 20 && pos.y >= layer.y - h && pos.y <= layer.y + 15) { clickedLayer = layer; break; }
    }
  }
  if (clickedLayer) {
    activeLayerId = clickedLayer.id;
    syncActiveInputs(); updateTextLayersUI();
    isDraggingText = true;
    showFloatingMenu(clickedLayer.x, clickedLayer.y);
    haptic(6);
    redraw();
  } else {
    activeLayerId = null;
    textMenu.style.display = 'none';
    updateTextLayersUI();
    redraw();
  }
}

function onTouchMove(e) {
  if (!imgLoaded || isCropPanelActive()) return;
  if (e.preventDefault) e.preventDefault();
  if (e.touches) { for (const t of e.touches) touches.set(t.identifier, { x:t.clientX, y:t.clientY }); }
  else if (touches.has('mouse')) { touches.set('mouse', { x:e.clientX, y:e.clientY }); }

  if (touches.size === 2 && gesture) {
    const arr = Array.from(touches.values());
    const dist = touchDist(arr[0], arr[1]);
    const ang = touchAngle(arr[0], arr[1]);
    const scale = dist / gesture.startDist;
    const rotDelta = ang - gesture.startAngle;
    if (gesture.type === 'text') {
      const l = textLayers.find(x => x.id === gesture.id);
      if (l) {
        if (l.isImage) {
          const newW = Math.max(20, Math.min(canvas.width*2, Math.round(gesture.startSize * scale)));
          const ratio = l.height / l.width;
          l.width = newW; l.height = Math.round(newW * ratio); l.size = newW;
        } else {
          l.size = Math.max(8, Math.min(400, Math.round(gesture.startSize * scale)));
        }
        l.rotation = gesture.startRot + rotDelta;
      }
    }
    redraw();
    return;
  }
  const pos = getCanvasCoordinates(e, e.touches ? e.touches[0] : null);
  if (isDraggingText) {
    const l = textLayers.find(x => x.id === activeLayerId);
    if (l) { l.x = pos.x; l.y = pos.y; showFloatingMenu(l.x, l.y); redraw(); }
  }
}

function endTouch(e) {
  if (e && e.changedTouches) { for (const t of e.changedTouches) touches.delete(t.identifier); } else { touches.delete('mouse'); }
  if (touches.size < 2) gesture = null;
  if (isDraggingText) { isDraggingText = false; saveState(); syncActiveInputs(); }
}

function showFloatingMenu(x, y) {
  const rect = canvas.getBoundingClientRect();
  const contRect = canvas.parentElement.getBoundingClientRect();
  const ox = rect.left - contRect.left;
  const oy = rect.top - contRect.top;
  const sx = rect.width / canvas.width, sy = rect.height / canvas.height;
  textMenu.style.left = (ox + x * sx) + 'px';
  textMenu.style.top = (oy + y * sy - 30) + 'px';
  textMenu.style.display = 'block';
}

function moveActiveText(dx, dy) {
  const l = textLayers.find(x => x.id === activeLayerId);
  if (l) { l.x += dx; l.y += dy; showFloatingMenu(l.x, l.y); syncActiveInputs(); redraw(); saveState(); }
}

function centerActiveTextHoriz() {
  const l = textLayers.find(x => x.id === activeLayerId);
  if (l) { l.x = canvas.width / 2; showFloatingMenu(l.x, l.y); syncActiveInputs(); redraw(); saveState(); }
}

function alignText(horiz, vert) {
  const l = textLayers.find(x => x.id === activeLayerId);
  if (!l) return;
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const margin = Math.min(canvas.width, canvas.height) * 0.12;
  const layerH = l.isImage ? l.height : (l.size || 40);
  const layerW = l.isImage ? l.width : (() => { ctx.font = `bold ${l.size}px '${l.font}', sans-serif`; return ctx.measureText(l.text || '').width; })();
  if (horiz === 'left')   l.x = layerW / 2 + margin;
  if (horiz === 'center') l.x = cx;
  if (horiz === 'right')  l.x = canvas.width - layerW / 2 - margin;
  if (vert === 'top')     l.y = layerH / 2 + margin;
  if (vert === 'middle')  l.y = cy;
  if (vert === 'bottom')  l.y = canvas.height - layerH / 2 - margin;
  showFloatingMenu(l.x, l.y);
  haptic(6);
  syncActiveInputs(); redraw(); saveState();
}

function addNewTextLayer() {
  const id = Date.now();
  const newLayer = { id, text:"TEXT", x:canvas.width/2, y:canvas.height/2, font:"Impact", size:Math.round(canvas.width*0.1), color:"#ffffff", style:"normal", rotation:0 };
  textLayers.push(newLayer);
  activeLayerId = id;
  syncActiveInputs(); updateTextLayersUI();
  showFloatingMenu(newLayer.x, newLayer.y);
  redraw(); saveState();
  setTimeout(() => { tInput.focus(); tInput.select(); }, 60);
}

function deleteActiveTextLayer() {
  if (textLayers.length === 0) { textMenu.style.display = 'none'; return; }
  textLayers = textLayers.filter(x => x.id !== activeLayerId);
  activeLayerId = textLayers.length ? textLayers[0].id : null;
  textMenu.style.display = 'none';
  syncActiveInputs(); updateTextLayersUI(); redraw(); saveState();
}

function selectLayer(id) {
  activeLayerId = id;
  syncActiveInputs(); updateTextLayersUI();
  const l = textLayers.find(x => x.id === id);
  if (l) showFloatingMenu(l.x, l.y);
  redraw();
}

function updateTextLayersUI() {
  const el = document.getElementById('textLayersList');
  if (!el) return;
  if (textLayers.length === 0) { el.innerHTML = ''; return; }
  let html = '';
  textLayers.forEach(l => {
    const act = l.id === activeLayerId ? 'active' : '';
    const label = l.isImage ? '🖼 Sticker' : (l.text || '(Empty)');
    html += `<div class="text-layer-item ${act}" onclick="selectLayer(${l.id})">
      <span style="font-weight:bold;font-size:11px;">${label}</span>
      <span style="font-size:10px;color:#666;">${l.isImage ? 'IMG' : l.font}</span>
    </div>`;
  });
  el.innerHTML = html;
}

function hexToHsl(hex) {
  hex = (hex || '#ffffff').replace('#','');
  if (hex.length === 3) hex = hex.split('').map(c => c+c).join('');
  const r = parseInt(hex.substr(0,2),16)/255, g = parseInt(hex.substr(2,2),16)/255, b = parseInt(hex.substr(4,2),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h = 0, s = 0, l = (max+min)/2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    if (max === r) h = ((g-b)/d + (g<b?6:0)) / 6;
    else if (max === g) h = ((b-r)/d + 2) / 6;
    else h = ((r-g)/d + 4) / 6;
  }
  return { h: Math.round(h*360), s: Math.round(s*100), l: Math.round(l*100) };
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h/30) % 12;
  const a = s * Math.min(l, 1-l);
  const f = n => l - a * Math.max(-1, Math.min(k(n)-3, Math.min(9-k(n), 1)));
  const toHex = x => { const v = Math.round(x*255).toString(16); return v.length === 1 ? '0'+v : v; };
  return '#' + toHex(f(0)) + toHex(f(8)) + toHex(f(4));
}

function setActiveTextBrightness(v) {
  v = parseInt(v);
  document.getElementById('brVal').innerText = v;
  const l = textLayers.find(x => x.id === activeLayerId);
  if (!l || l.isImage) return;
  const hsl = hexToHsl(l.color || '#ffffff');
  l.color = hslToHex(hsl.h, hsl.s, v);
  updateColorPreview();
  redraw(); saveState();
}

function setActiveTextHue(v) {
  v = parseInt(v);
  document.getElementById('hueVal').innerText = v + '°';
  const l = textLayers.find(x => x.id === activeLayerId);
  if (!l || l.isImage) return;
  const hsl = hexToHsl(l.color || '#ffffff');
  l.color = hslToHex(v, Math.max(hsl.s, 70), hsl.l);
  updateColorPreview();
  redraw(); saveState();
}

function updateColorPreview() {
  const l = textLayers.find(x => x.id === activeLayerId);
  const prev = document.getElementById('colorPreview');
  if (prev && l && !l.isImage) prev.style.background = l.color;
}

function syncActiveInputs() {
  const l = textLayers.find(x => x.id === activeLayerId);
  const px = document.getElementById('posX');
  const py = document.getElementById('posY');
  if (px) px.max = Math.max(2000, canvas.width * 1.2);
  if (py) py.max = Math.max(2000, canvas.height * 1.2);
  if (!l) {
    if (tInput) tInput.value = '';
    if (sizeInput) sizeInput.value = 36;
    const fs = document.getElementById('fSizeVal'); if (fs) fs.innerText = '36';
    const fr = document.getElementById('fontRotation'); if (fr) fr.value = 0;
    const frv = document.getElementById('fRotVal'); if (frv) frv.innerText = '0°';
    if (px) { px.value = 0; document.getElementById('posXVal').innerText = '0'; }
    if (py) { py.value = 0; document.getElementById('posYVal').innerText = '0'; }
    return;
  }
  if (px) { px.value = Math.round(l.x); document.getElementById('posXVal').innerText = Math.round(l.x); }
  if (py) { py.value = Math.round(l.y); document.getElementById('posYVal').innerText = Math.round(l.y); }
  if (l.isImage) {
    if (tInput) tInput.value = '';
    if (sizeInput) sizeInput.value = l.width || 100;
    const fs = document.getElementById('fSizeVal'); if (fs) fs.innerText = Math.round(l.width || 100);
  } else {
    if (tInput) tInput.value = l.text;
    if (sizeInput) sizeInput.value = l.size;
    const fs = document.getElementById('fSizeVal'); if (fs) fs.innerText = l.size;
    const cb = document.getElementById('colorBrightness');
    if (cb) {
      const hsl = hexToHsl(l.color || '#ffffff');
      cb.value = hsl.l;
      document.getElementById('brVal').innerText = hsl.l;
      document.getElementById('colorHue').value = hsl.h;
      document.getElementById('hueVal').innerText = hsl.h + '°';
      updateColorPreview();
    }
  }
  const fr = document.getElementById('fontRotation');
  if (fr) {
    const deg = Math.round((l.rotation || 0) * 180 / Math.PI);
    fr.value = deg;
    document.getElementById('fRotVal').innerText = deg + '°';
  }
}

function setActivePos(axis, v) {
  const l = textLayers.find(x => x.id === activeLayerId);
  if (!l) return;
  v = parseInt(v);
  if (axis === 'x') { l.x = v; document.getElementById('posXVal').innerText = v; }
  else { l.y = v; document.getElementById('posYVal').innerText = v; }
  showFloatingMenu(l.x, l.y);
  redraw(); saveState();
}

function updateActiveTextContent(v) {
  let l = textLayers.find(x => x.id === activeLayerId);
  if (!l || l.isImage) {
    if (!v) return;
    const id = Date.now();
    l = { id, text:v, x:canvas.width/2, y:canvas.height/2, font:"Impact", size:Math.round(canvas.width*0.1), color:"#ffffff", style:"normal", rotation:0 };
    textLayers.push(l); activeLayerId = id;
    showFloatingMenu(l.x, l.y);
  } else { l.text = v; }
  updateTextLayersUI(); redraw(); saveState();
}

function setActiveFontSize(v) {
  const l = textLayers.find(x => x.id === activeLayerId);
  if (!l) { const fs = document.getElementById('fSizeVal'); if (fs) fs.innerText = v; return; }
  if (l.isImage) {
    const ratio = l.height / l.width;
    l.width = parseInt(v); l.height = Math.round(l.width * ratio);
  } else {
    l.size = parseInt(v);
  }
  const fs = document.getElementById('fSizeVal'); if (fs) fs.innerText = v;
  redraw(); saveState();
}

function setActiveFontRotation(v) {
  const frv = document.getElementById('fRotVal'); if (frv) frv.innerText = v + '°';
  const l = textLayers.find(x => x.id === activeLayerId);
  if (!l) return;
  l.rotation = parseInt(v) * Math.PI / 180;
  redraw(); saveState();
}

function setActiveFont(f, el) { const l = textLayers.find(x => x.id === activeLayerId); updateSelection(el); if (!l || l.isImage) return; l.font = f; redraw(); saveState(); }
function setActiveTextColor(c, el) { const l = textLayers.find(x => x.id === activeLayerId); updateSelection(el); if (!l || l.isImage) return; l.color = c; syncActiveInputs(); redraw(); saveState(); }
function setActiveTextStyle(s, el) { const l = textLayers.find(x => x.id === activeLayerId); updateSelection(el); if (!l || l.isImage) return; l.style = s; redraw(); saveState(); }

function saveProjectToHome() {
  if (!imgLoaded) return;
  if (!currentProjectId) currentProjectId = 'proj_' + Date.now();
  const serializedLayers = textLayers.map(l => {
    if (l.isImage) return { id:l.id, isImage:true, imageUrl:l.imageUrl, x:l.x, y:l.y, width:l.width, height:l.height, rotation:l.rotation, size:l.size };
    return l;
  });
  let bgFile = null;
  if (currentBgImage) {
    for (const f of BG_CONFIG.files) if (bgImages[f.fname] === currentBgImage) { bgFile = f.fname; break; }
  }
  const now = new Date();
  let autoName = currentProjectName;
  if (!autoName || autoName.startsWith('Cover ')) {
    const firstText = textLayers.find(l => !l.isImage && l.text && l.text.trim());
    autoName = firstText ? firstText.text.trim().slice(0, 24) : (currentProjectName || 'Cover');
  }
  try {
    localStorage.setItem('music_' + currentProjectId, JSON.stringify({
      name: autoName, date: now.toISOString(), savedAt: now.getTime(),
      image: canvas.toDataURL('image/jpeg', 0.85),
      originalImage: originalImageSrc,
      canvasW: canvas.width, canvasH: canvas.height,
      textLayers: serializedLayers,
      brightness: bInput.value, contrast: cInput.value, saturation: sInput.value, noise: nInput.value,
      filter: currentFilter, border: currentBorder, borderColor: currentBorderColor, borderSize: currentBorderSize,
      bgColor: currentBgColor, bgColorSize: currentBgColorSize,
      bgImageFile: bgFile, bgImageSize: currentBgImageSize,
      template: currentTemplate, fx: currentFx, fxAmount: currentFxAmount,
      subjectMode, strokeColor, subjectAmount: subjAmt.value
    }));
  } catch(e) { alert('Storage full — try saving fewer photos.'); return; }
  undoStack = []; redoStack = []; updateHistoryButtons();
  playCount(() => { goHome(); });
}

function saveImage() {
  if (!imgLoaded) return;
  const dataUrl = canvas.toDataURL('image/png');
  playCount(() => {
    const a = document.createElement('a');
    a.download = 'samarid-studio-' + Date.now() + '.png';
    a.href = dataUrl;
    a.click();
    haptic(30);
  });
}

function switchPanel(name, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  if (btn) btn.classList.add('active');
  if (name === 'filters') buildFilterThumbs();
  if (name === 'border') buildBorders();
  if (name === 'adjust') buildTemplates();
  if (name === 'color') buildBgColors();
  if (name === 'fx') { buildFxTabs(); buildFxGrids(); }
  if (name === 'advisory') buildAdvisoryGrid();
  if (name === 'bgimage') buildBgImageGrid();
  if (name === 'bgremover') showBGRemoverPanel();
  if (name === 'crop') showCropOverlay(true); else showCropOverlay(false);
  syncActiveInputs();
}

function isCropPanelActive() { return document.getElementById('panel-crop').classList.contains('active'); }

function switchSubTab(name, el) {
  const panel = el.closest('.panel');
  panel.querySelectorAll('.sub-view').forEach(v => v.classList.remove('active'));
  panel.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
  panel.querySelector('#subtab-' + name).classList.add('active');
  el.classList.add('active');
  if (name === 'basic' || name === 'layers') syncActiveInputs();
}

function setSubjectMode(mode, el) { subjectMode = mode; updateSelection(el); redraw(); saveState(); }

function updateSelection(el) {
  el.parentElement.querySelectorAll('.h-card, .font-pill, .color-circle').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

[bInput, cInput, sInput, nInput, subjAmt].forEach(input => {
  if (!input) return;
  input.addEventListener('input', () => {
    const sa = document.getElementById('subjectAmtVal');
    if (sa) sa.innerText = subjAmt.value;
    currentTemplate = 'none';
    const tmpl = document.getElementById('templateContainer');
    if (tmpl) tmpl.querySelectorAll('.template-thumb').forEach(c => c.classList.remove('selected'));
    redraw();
  });
  input.addEventListener('change', saveState);
});

function showCropOverlay(show) {
  const ov = document.getElementById('cropOverlay');
  if (show && imgLoaded) { ov.classList.add('active'); crop = { x:0, y:0, w:1, h:1 }; updateCropBox(); }
  else { ov.classList.remove('active'); }
}

function updateCropBox() {
  const box = document.getElementById('cropBox');
  const rect = canvas.getBoundingClientRect();
  const contRect = canvas.parentElement.getBoundingClientRect();
  const ox = rect.left - contRect.left;
  const oy = rect.top - contRect.top;
  box.style.left = (ox + rect.width * crop.x) + 'px';
  box.style.top = (oy + rect.height * crop.y) + 'px';
  box.style.width = (rect.width * crop.w) + 'px';
  box.style.height = (rect.height * crop.h) + 'px';
}

function initCropOverlay() {
  const box = document.getElementById('cropBox');
  if (!box) return;
  box.addEventListener('pointerdown', e => {
    if (!isCropPanelActive()) return;
    e.preventDefault(); e.stopPropagation();
    const isCorner = e.target.classList.contains('crop-corner');
    const corner = isCorner ? e.target.dataset.corner : null;
    const rect = canvas.getBoundingClientRect();
    cropDrag = { type:corner||'move', startX:e.clientX, startY:e.clientY, start:{...crop}, canvasRect:rect };
  });
  window.addEventListener('pointermove', e => {
    if (!cropDrag) return;
    e.preventDefault();
    const dx = (e.clientX - cropDrag.startX) / cropDrag.canvasRect.width;
    const dy = (e.clientY - cropDrag.startY) / cropDrag.canvasRect.height;
    const s = cropDrag.start; const MIN = 0.15;
    let { x, y, w, h } = s;
    if (cropDrag.type === 'move') { x = Math.max(0, Math.min(1-s.w, s.x+dx)); y = Math.max(0, Math.min(1-s.h, s.y+dy)); }
    else if (cropDrag.type === 'tl') { const nx = Math.max(0, Math.min(s.x+s.w-MIN, s.x+dx)); const ny = Math.max(0, Math.min(s.y+s.h-MIN, s.y+dy)); x=nx; y=ny; w=s.x+s.w-nx; h=s.y+s.h-ny; }
    else if (cropDrag.type === 'tr') { const ny = Math.max(0, Math.min(s.y+s.h-MIN, s.y+dy)); y=ny; h=s.y+s.h-ny; w=Math.max(MIN, Math.min(1-s.x, s.w+dx)); }
    else if (cropDrag.type === 'bl') { const nx = Math.max(0, Math.min(s.x+s.w-MIN, s.x+dx)); x=nx; w=s.x+s.w-nx; h=Math.max(MIN, Math.min(1-s.y, s.h+dy)); }
    else if (cropDrag.type === 'br') { w=Math.max(MIN, Math.min(1-s.x, s.w+dx)); h=Math.max(MIN, Math.min(1-s.y, s.h+dy)); }
    crop = { x, y, w, h };
    updateCropBox();
  });
  window.addEventListener('pointerup', () => { cropDrag = null; });
  window.addEventListener('pointercancel', () => { cropDrag = null; });
  window.addEventListener('resize', () => { if (isCropPanelActive()) updateCropBox(); });
}

function setCropRect(ratio) {
  if (ratio === 'free') { crop = { x:0, y:0, w:1, h:1 }; updateCropBox(); return; }
  let tr;
  if (ratio === '1:1') tr = 1;
  else if (ratio === '4:5') tr = 4/5;
  else if (ratio === '9:16') tr = 9/16;
  else if (ratio === '16:9') tr = 16/9;
  const ca = canvas.width / canvas.height;
  const cr = tr / ca;
  let w, h;
  if (cr >= 1) { w = 1; h = 1/cr; } else { h = 1; w = cr; }
  crop = { x:(1-w)/2, y:(1-h)/2, w, h };
  updateCropBox();
}

function resetCrop() { crop = { x:0, y:0, w:1, h:1 }; updateCropBox(); }

function applyCropNow() {
  if (!imgLoaded) return;
  if (crop.w >= 0.99 && crop.h >= 0.99 && crop.x < 0.01 && crop.y < 0.01) return;
  const px = Math.round(crop.x * canvas.width);
  const py = Math.round(crop.y * canvas.height);
  const pw = Math.round(crop.w * canvas.width);
  const ph = Math.round(crop.h * canvas.height);
  const full = document.createElement('canvas');
  full.width = canvas.width; full.height = canvas.height;
  full.getContext('2d').drawImage(img, 0, 0);
  const tmp = document.createElement('canvas');
  tmp.width = pw; tmp.height = ph;
  tmp.getContext('2d').drawImage(full, px, py, pw, ph, 0, 0, pw, ph);
  const url = tmp.toDataURL('image/png');
  const newImg = new Image();
  newImg.onload = function() {
    img = newImg; originalImageSrc = url;
    canvas.width = pw; canvas.height = ph;
    personMask = null; subjectReady = false;
    crop = { x:0, y:0, w:1, h:1 };
    buildFilterThumbs(); buildTemplates();
    redraw(); saveState();
    showCropOverlay(false);
    switchPanel('adjust', document.querySelector('.nav-btn[data-panel="adjust"]'));
  };
  newImg.src = url;
}

function rotateImage(deg) {
  if (!imgLoaded) return;
  const c = document.createElement('canvas');
  c.width = canvas.height; c.height = canvas.width;
  const cx = c.getContext('2d');
  cx.translate(c.width/2, c.height/2);
  cx.rotate(deg * Math.PI / 180);
  cx.drawImage(img, -canvas.width/2, -canvas.height/2);
  const url = c.toDataURL('image/png');
  const newImg = new Image();
  newImg.onload = function() {
    img = newImg; originalImageSrc = url;
    canvas.width = c.width; canvas.height = c.height;
    redraw(); saveState(); buildFilterThumbs(); buildTemplates();
    if (isCropPanelActive()) { crop = { x:0, y:0, w:1, h:1 }; updateCropBox(); }
  };
  newImg.src = url;
}

function flipImage(dir) {
  if (!imgLoaded) return;
  const c = document.createElement('canvas');
  c.width = canvas.width; c.height = canvas.height;
  const cx = c.getContext('2d');
  cx.translate(dir === 'h' ? canvas.width : 0, dir === 'v' ? canvas.height : 0);
  cx.scale(dir === 'h' ? -1 : 1, dir === 'v' ? -1 : 1);
  cx.drawImage(img, 0, 0);
  const url = c.toDataURL('image/png');
  const newImg = new Image();
  newImg.onload = function() { img = newImg; originalImageSrc = url; redraw(); saveState(); buildFilterThumbs(); buildTemplates(); };
  newImg.src = url;
}

window.detectSubject = async function() {
  const status = document.getElementById('subjectStatus');
  const btn = document.getElementById('detectBtn');
  if (!imgLoaded) { status.textContent = 'Upload an image first.'; return; }
  if (typeof SelfieSegmentation === 'undefined') { status.textContent = 'Model failed to load.'; return; }
  btn.disabled = true;
  status.textContent = 'Loading model...';
  try {
    if (!selfieSeg) {
      selfieSeg = new SelfieSegmentation({ locateFile:f => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/${f}` });
      selfieSeg.setOptions({ modelSelection:1 });
    }
    status.textContent = 'Analysing photo...';
    const result = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Timed out.')), 30000);
      selfieSeg.onResults(r => { clearTimeout(t); resolve(r); });
      selfieSeg.send({ image: img });
    });
    const raw = document.createElement('canvas');
    raw.width = canvas.width; raw.height = canvas.height;
    const rctx = raw.getContext('2d');
    rctx.drawImage(result.segmentationMask, 0, 0, canvas.width, canvas.height);
    const id = rctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) d[i+3] = d[i];
    rctx.putImageData(id, 0, 0);
    const soft = document.createElement('canvas');
    soft.width = canvas.width; soft.height = canvas.height;
    const sctx = soft.getContext('2d');
    sctx.filter = 'blur(3px)';
    sctx.drawImage(raw, 0, 0);
    personMask = soft; subjectReady = true;
    status.textContent = 'Subject detected. Pick Blur or Stroke below.';
    btn.textContent = 'RE-DETECT'; btn.disabled = false;
    redraw(); saveState();
  } catch(err) { status.textContent = 'Failed: ' + err.message; btn.disabled = false; }
};

function drawBorder() {
  if (!imgLoaded || currentBorder === 'none') return;
  const w = canvas.width, h = canvas.height;
  const base = Math.min(w, h);
  const col = currentBorderColor;
  const pct = currentBorderSize / 100;
  if (currentBorder === 'white') {
    const t = Math.round(base * pct);
    ctx.fillStyle = col;
    ctx.fillRect(0,0,w,t); ctx.fillRect(0,h-t,w,t); ctx.fillRect(0,0,t,h); ctx.fillRect(w-t,0,t,h);
  } else if (currentBorder === 'black') {
    const t = Math.round(base * pct * 1.6);
    ctx.fillStyle = col;
    ctx.fillRect(0,0,w,t); ctx.fillRect(0,h-t,w,t); ctx.fillRect(0,0,t,h); ctx.fillRect(w-t,0,t,h);
  } else if (currentBorder === 'rounded') {
    const t = Math.round(base * pct);
    const r = Math.round(base * pct * 1.6);
    ctx.save(); ctx.fillStyle = col;
    ctx.beginPath();
    ctx.rect(0,0,w,h);
    ctx.moveTo(t+r, t); ctx.lineTo(w-t-r, t); ctx.quadraticCurveTo(w-t, t, w-t, t+r);
    ctx.lineTo(w-t, h-t-r); ctx.quadraticCurveTo(w-t, h-t, w-t-r, h-t);
    ctx.lineTo(t+r, h-t); ctx.quadraticCurveTo(t, h-t, t, h-t-r);
    ctx.lineTo(t, t+r); ctx.quadraticCurveTo(t, t, t+r, t);
    ctx.closePath(); ctx.fill('evenodd'); ctx.restore();
  } else if (currentBorder === 'polaroid') {
    const side = Math.round(base * pct);
    const bottom = Math.round(base * pct * 3.4);
    ctx.fillStyle = col;
    ctx.fillRect(0,0,w,side); ctx.fillRect(0,0,side,h); ctx.fillRect(w-side,0,side,h); ctx.fillRect(0,h-bottom,w,bottom);
  } else if (currentBorder === 'shadow') {
    const grad = ctx.createRadialGradient(w/2, h/2, base*0.25, w/2, h/2, Math.max(w,h)*0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${0.4 + pct * 3})`);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  }
}

function drawCover(x, y, w, h, im) {
  const sr = im.naturalWidth / im.naturalHeight;
  const dr = w / h;
  let sx = 0, sy = 0, sw = im.naturalWidth, sh = im.naturalHeight;
  if (sr > dr) { sw = sh * dr; sx = (im.naturalWidth - sw) / 2; }
  else { sh = sw / dr; sy = (im.naturalHeight - sh) / 2; }
  ctx.drawImage(im, sx, sy, sw, sh, x, y, w, h);
}

function drawFxLayer() {
  if (!imgLoaded || currentFx === 'none' || currentFxAmount === 0) return;
  const parts = currentFx.split(':');
  const catKey = parts[0], fname = parts[1];
  if (fname === 'none') return;
  const im = fxImages[catKey + ':' + fname];
  if (!im) return;
  const cat = FX_CATEGORIES.find(c => c.key === catKey);
  const a = currentFxAmount / 100;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.globalCompositeOperation = (cat && cat.blend) ? cat.blend : 'screen';
  drawCover(0, 0, canvas.width, canvas.height, im);
  ctx.restore();
}

function drawSelectionBox(bx, by, bw, bh) {
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(bx,      by,      5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(bx+bw,   by,      5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(bx,      by+bh,   5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(bx+bw,   by+bh,   5, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(bx + bw/2, by); ctx.lineTo(bx + bw/2, by - 26); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(bx + bw/2, by - 30, 6, 0, Math.PI*2); ctx.fill();
}

function redraw() {
  if (!imgLoaded) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let filterString = `brightness(${bInput.value}%) contrast(${cInput.value}%) saturate(${sInput.value}%) `;
  if (currentFilter !== 'none') filterString += currentFilter;
  const OVER = 6;

  const photoLayer = document.createElement('canvas');
  photoLayer.width = canvas.width;
  photoLayer.height = canvas.height;
  const plctx = photoLayer.getContext('2d');

  if (subjectReady && personMask && subjectMode !== 'none') {
    const amt = parseInt(subjAmt.value);
    const blurred = document.createElement('canvas');
    blurred.width = canvas.width; blurred.height = canvas.height;
    const bctx = blurred.getContext('2d');
    bctx.filter = filterString + ` blur(${amt}px)`;
    bctx.drawImage(img, -OVER, -OVER, canvas.width+OVER*2, canvas.height+OVER*2);
    const person = document.createElement('canvas');
    person.width = canvas.width; person.height = canvas.height;
    const pctx = person.getContext('2d');
    pctx.filter = filterString;
    pctx.drawImage(img, -OVER, -OVER, canvas.width+OVER*2, canvas.height+OVER*2);
    pctx.globalCompositeOperation = 'destination-in';
    pctx.drawImage(personMask, 0, 0);
    if (subjectMode === 'blur') { plctx.drawImage(blurred, 0, 0); plctx.drawImage(person, 0, 0); }
    else if (subjectMode === 'stroke') {
      const sharp = document.createElement('canvas');
      sharp.width = canvas.width; sharp.height = canvas.height;
      const sctx = sharp.getContext('2d');
      sctx.filter = filterString;
      sctx.drawImage(img, -OVER, -OVER, canvas.width+OVER*2, canvas.height+OVER*2);
      plctx.drawImage(sharp, 0, 0);
      const ring = document.createElement('canvas');
      ring.width = canvas.width; ring.height = canvas.height;
      const rctx = ring.getContext('2d');
      const offset = Math.max(3, amt);
      for (let a2 = 0; a2 < 360; a2 += 10) {
        const rad = a2 * Math.PI / 180;
        rctx.drawImage(personMask, Math.cos(rad) * offset, Math.sin(rad) * offset);
      }
      rctx.globalCompositeOperation = 'destination-out';
      rctx.drawImage(personMask, 0, 0);
      rctx.globalCompositeOperation = 'source-in';
      rctx.fillStyle = strokeColor;
      rctx.fillRect(0, 0, canvas.width, canvas.height);
      plctx.drawImage(ring, 0, 0);
      plctx.drawImage(person, 0, 0);
    }
  } else {
    plctx.filter = filterString;
    plctx.drawImage(img, -OVER, -OVER, canvas.width+OVER*2, canvas.height+OVER*2);
    plctx.filter = 'none';
  }

  if (currentBgImage) {
    drawCover(0, 0, canvas.width, canvas.height, currentBgImage);
    const pad = Math.round(Math.min(canvas.width, canvas.height) * (currentBgImageSize / 100));
    ctx.drawImage(photoLayer, 0, 0, canvas.width, canvas.height, pad, pad, canvas.width - pad*2, canvas.height - pad*2);
  } else if (currentBgColor) {
    ctx.fillStyle = currentBgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const pad = Math.round(Math.min(canvas.width, canvas.height) * (currentBgColorSize / 100));
    ctx.drawImage(photoLayer, 0, 0, canvas.width, canvas.height, pad, pad, canvas.width - pad*2, canvas.height - pad*2);
  } else {
    ctx.drawImage(photoLayer, 0, 0);
  }

  const fade = parseInt(nInput.value);
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${(fade/100)*0.4})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }

  if (!currentBgColor && !currentBgImage) drawBorder();

  drawFxLayer();

  textLayers.forEach(layer => {
    if (layer.isImage && layer.image && layer.image.complete) {
      ctx.save();
      ctx.translate(layer.x, layer.y);
      if (layer.rotation) ctx.rotate(layer.rotation);
      const w = layer.width, h = layer.height;
      ctx.drawImage(layer.image, -w/2, -h/2, w, h);
      if (activeLayerId === layer.id) drawSelectionBox(-w/2 - 4, -h/2 - 4, w + 8, h + 8);
      ctx.restore();
    } else if (layer.text && layer.text.trim() !== '') {
      ctx.save();
      ctx.translate(layer.x, layer.y);
      if (layer.rotation) ctx.rotate(layer.rotation);
      ctx.font = `bold ${layer.size}px '${layer.font}', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (layer.style === 'stroke') { ctx.lineWidth = Math.max(2, layer.size * 0.08); ctx.strokeStyle = '#000'; ctx.strokeText(layer.text, 0, 0); }
      else if (layer.style === 'shadow') { ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 12; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 4; }
      else if (layer.style === 'glow') { ctx.shadowColor = layer.color; ctx.shadowBlur = 20; }
      ctx.fillStyle = layer.color;
      ctx.fillText(layer.text, 0, 0);
      if (activeLayerId === layer.id) {
        const m = ctx.measureText(layer.text);
        const bw = m.width + 16, bh = layer.size + 8;
        drawSelectionBox(-bw/2, -bh/2, bw, bh);
      }
      ctx.restore();
    }
  });
}

function initHomeUpload() {
  document.getElementById('homeImageUpload').addEventListener('change', async function(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';
    let overlay = document.getElementById('importOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'importOverlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-size:14px;';
      overlay.innerHTML = '<div id="importCount" style="margin-bottom:12px;">Importing...</div><div style="width:180px;height:3px;background:#1a1a1a;border-radius:2px;overflow:hidden;"><div id="importBar" style="height:100%;width:0;background:#fff;transition:width .2s;"></div></div>';
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    let done = 0;
    for (const file of files) {
      await importOnePhoto(file);
      done++;
      document.getElementById('importBar').style.width = Math.round((done / files.length) * 100) + '%';
      document.getElementById('importCount').textContent = 'Importing ' + done + ' / ' + files.length;
    }
    overlay.style.display = 'none';
    renderProjectsList();
  });
}

function importOnePhoto(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = ev => {
      const newImg = new Image();
      newImg.onload = function() {
        const MAX = 1080; let w = newImg.width, h = newImg.height;
        if (w > MAX || h > MAX) { const s = MAX / Math.max(w, h); w = Math.round(w*s); h = Math.round(h*s); }
        const tmp = document.createElement('canvas');
        tmp.width = w; tmp.height = h;
        tmp.getContext('2d').drawImage(newImg, 0, 0, w, h);
        const dataURL = tmp.toDataURL('image/jpeg', 0.85);
        const id = 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
        const now = new Date();
        try {
          localStorage.setItem('music_' + id, JSON.stringify({
            name: 'Cover ' + (Object.keys(localStorage).filter(k => k.startsWith('music_proj_')).length + 1),
            date: now.toISOString(), savedAt: now.getTime(),
            image: dataURL, originalImage: dataURL,
            canvasW: w, canvasH: h, textLayers: [],
            brightness: 100, contrast: 100, saturation: 100, noise: 0,
            filter: 'none', border: 'none', borderColor: '#ffffff', borderSize: 5,
            bgColor: null, bgColorSize: 8, template: 'none',
            fx: 'none', fxAmount: 70, subjectMode: 'none', strokeColor: '#ffffff', subjectAmount: 12,
            bgImageFile: null, bgImageSize: 8
          }));
        } catch(err) {}
        resolve();
      };
      newImg.onerror = () => resolve();
      newImg.src = ev.target.result;
    };
    reader.onerror = () => resolve();
    reader.readAsDataURL(file);
  });
}

function loadProject(key) {
  resetStudioState();
  const p = JSON.parse(localStorage.getItem(key));
  currentProjectId = key.replace('music_', '');
  currentProjectName = p.name || 'Untitled';
  textLayers = p.textLayers || [];
  activeLayerId = null;
  textLayers.forEach(l => {
    if (l.isImage && l.imageUrl) { const im = new Image(); im.src = l.imageUrl; l.image = im; }
  });
  bInput.value = p.brightness ?? 100; cInput.value = p.contrast ?? 100; sInput.value = p.saturation ?? 100; nInput.value = p.noise ?? 0;
  subjAmt.value = p.subjectAmount ?? 12;
  currentFilter = p.filter ?? 'none';
  currentBorder = p.border ?? 'none'; currentBorderColor = p.borderColor ?? '#ffffff'; currentBorderSize = p.borderSize ?? 5;
  currentBgColor = p.bgColor ?? null; currentBgColorSize = p.bgColorSize ?? 8;
  currentBgImageSize = p.bgImageSize ?? 8;
  currentBgImage = (p.bgImageFile && bgImages[p.bgImageFile]) ? bgImages[p.bgImageFile] : null;
  currentFx = p.fx ?? 'none'; currentFxAmount = p.fxAmount ?? 70;
  document.getElementById('fxAmount').value = currentFxAmount;
  document.getElementById('fxVal').innerText = currentFxAmount;
  document.getElementById('borderSizeInput').value = currentBorderSize; document.getElementById('borderSizeVal').innerText = currentBorderSize;
  document.getElementById('bgColorSizeInput').value = currentBgColorSize; document.getElementById('bgColorSizeVal').innerText = currentBgColorSize;
  document.getElementById('bgImgSizeInput').value = currentBgImageSize; document.getElementById('bgImgSizeVal').innerText = currentBgImageSize;
  currentTemplate = p.template ?? 'none';
  subjectMode = p.subjectMode ?? 'none'; strokeColor = p.strokeColor ?? '#ffffff';

  const sourceImage = p.originalImage || p.image;
  originalImageSrc = sourceImage;
  img.onload = function() {
    if (p.canvasW && p.canvasH) { canvas.width = p.canvasW; canvas.height = p.canvasH; } else setupCanvasFromImage(img);
    imgLoaded = true;
    buildFilterThumbs(); buildTemplates(); buildBorders(); buildBgColors();
    buildFxGrids(); buildAdvisoryGrid(); buildBgImageGrid();
    saveState(); redraw();
  };
  img.src = sourceImage;

  document.getElementById('view-home').classList.remove('active');
  document.getElementById('view-studio').classList.add('active');
  document.getElementById('cropOverlay').classList.remove('active');
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-adjust').classList.add('active');
  document.querySelector('.nav-btn[data-panel="adjust"]').classList.add('active');
}

function goHome() {
  document.getElementById('view-studio').classList.remove('active');
  document.getElementById('view-home').classList.add('active');
  textMenu.style.display = 'none';
  document.getElementById('cropOverlay').classList.remove('active');
  resetStudioState();
  renderProjectsList();
}

function resetEverything() {
  bInput.value = 100; cInput.value = 100; sInput.value = 100; nInput.value = 0;
  currentFilter = 'none'; currentBorder = 'none'; currentBgColor = null; currentBgImage = null;
  currentFx = 'none'; textLayers = []; activeLayerId = null;
  subjectMode = 'none'; personMask = null; subjectReady = false;
  document.querySelectorAll('.template-thumb, .filter-thumb, .border-thumb, .bgcolor-swatch, .bg-item, .fx-card').forEach(c => c.classList.remove('selected'));
  syncActiveInputs(); updateTextLayersUI(); redraw(); saveState();
}

window.onload = function() {
  const el = document.getElementById('splashScreen');
  if (el) { el.classList.remove('fade-out'); el.style.display = 'flex'; }

  (async () => {
    buildFontGrid();
    buildTemplates();
    buildBorders();
    buildBgColors();
    updateTextLayersUI();
    initCropOverlay();
    initHomeUpload();
    renderProjectsList();

    try {
      if (typeof preloadEffects === 'function') await preloadEffects();
    } catch (e) { console.warn(e); }

    playCount(() => {});
  })();
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW failed', e));
  });
}
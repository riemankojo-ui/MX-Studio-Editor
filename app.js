const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const textMenu = document.getElementById('textFloatingMenu');
const bInput = document.getElementById('brightness');
const cInput = document.getElementById('contrast');
const sInput = document.getElementById('saturation');
const nInput = document.getElementById('noise');
const subjAmt = document.getElementById('subjectAmount');
const sizeInput = document.getElementById('fontSize');

let img = new Image();
let imgLoaded = false;
let originalImageSrc = null;
let preCropImageSrc = null;
let preCropCanvasW = 0;
let preCropCanvasH = 0;
let currentFilter = 'none';
let currentBorder = 'none';
let currentBorderColor = '#ffffff';
let currentBorderSize = 5;
let currentTemplate = 'none';
let currentBgColor = null;
let currentBgColorSize = 8;
let currentBgImage = null;
let currentBgImageSize = 8;
let currentBgImageZoom = 100;
let currentBgImageX = 0;
let currentBgImageY = 0;
let currentProjectId = null;
let currentProjectName = '';
let currentFx = 'none';
let currentFxAmount = 70;
let textLayers = [];
let activeLayerId = null;
let isDraggingText = false;
let cutBodyActive = false;
let backgroundRemoved = false;
let cutBox = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
let isDraggingCutBox = false;
let cutBoxDragStart = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let undoStack = [], redoStack = [];
let touches = new Map();
let gesture = null;
let subjectMode = 'none';
let strokeColor = '#ffffff';
let personMask = null;
let subjectReady = false;
let selfieSeg = null;
let counterLocked = false;
let fxX = 0.5, fxY = 0.5, fxScale = 1, fxRotation = 0;
let gestureTarget = 'text';
let isDraggingFx = false;
let fxDragStart = null;
let subjectX = 0.5, subjectY = 0.5, subjectScale = 1;
let isDraggingSubject = false;
let subjectDragStart = null;
let bgDragMode = 'subject';
let isDraggingBg = false;
let bgDragStart = null;
let unshowOpacity = 100;
let overlayImg = null;
let overlayX = 0.5, overlayY = 0.5, overlayScale = 1, overlayRotation = 0, overlayOpacity = 0;
let overlayTint = null;
let overlayTintAmount = 60;
let overlayCropRatio = 'free';
let overlayRound = 0;
let cartoonStyle = 'none';
let cartoonAmount = 70;
let cartoonLevels = 6;
let cartoonEdge = 1.2;
let cartoonCanvas = null;
let isDraggingOverlay = false;
let overlayDragStart = null;
let cutTop = 0, cutBottom = 0, cutLeft = 0, cutRight = 0;
let cutFeather = 0;
let cornerRound = 0;
let crop = { x:0.05, y:0.05, w:0.9, h:0.9 };
let customBgImage = null;
let cutOpacity = 100;

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

const BG_LABELS = {
  'background1.jpg':'Silk','background2.jpg':'Cream','background3.jpg':'Gold','background4.jpg':'Orange','background5.jpg':'Pink','background6.jpg':'Teal','background7.jpg':'Red','background8.jpg':'Paper','background9.jpg':'Soft','background10.jpg':'White','background11.jpg':'Silk 2','background12.jpg':'Beige','background13.jpg':'Pure','background14.jpg':'Concrete','background15.jpg':'Scratch','background16.jpg':'Dark','background17.jpg':'Black'
};

const EFFECTS_BASE = './effects/';
let FX_CATEGORIES = [];
let currentFxTab = 'grunge';
const BG_CONFIG = { prefix:'background', max:20, files:[] };
const fxImages = {};
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
  FX_CATEGORIES = [];
  const isLocal = location.protocol === 'content:' || location.protocol === 'file:';
  if (!isLocal) {
    try {
      const r = await fetch('./effects.json', { cache: 'no-cache' });
      if (r.ok) {
        const data = await r.json();
        let list = null;
        if (Array.isArray(data.tabs)) list = data.tabs;
        else if (Array.isArray(data.categories)) list = data.categories;
        if (list) {
          FX_CATEGORIES = list.map(t => ({
            key: t.prefix, label: t.label || t.prefix, prefix: t.prefix,
            blend: t.blend || 'screen', max: t.max || 60,
            fileList: Array.isArray(t.files) ? t.files : null, files: []
          }));
        }
      }
    } catch (e) {}
  }
  if (!FX_CATEGORIES.length) {
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
  if (cat.fileList && Array.isArray(cat.fileList) && cat.fileList.length) {
    const results = await Promise.all(cat.fileList.map(async fname => {
      const im = await loadImage(EFFECTS_BASE + fname);
      return im ? { fname, im } : null;
    }));
    cat.files = results.filter(Boolean);
    cat.files.forEach(r => { fxImages[cat.key + ':' + r.fname] = r.im; });
    return;
  }
  const promises = [];
  for (let i = 1; i <= cat.max; i++) promises.push(probeOne(cat.prefix + i).then(r => r ? { base: cat.prefix + i, ...r } : null));
  const results = await Promise.all(promises);
  cat.files = results.filter(r => r !== null);
  cat.files.forEach(r => { fxImages[cat.key + ':' + r.fname] = r.im; });
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
  const smallCats = FX_CATEGORIES.filter(c => c.fileList && c.fileList.length <= 10);
  const noListCats = FX_CATEGORIES.filter(c => !c.fileList);
  await Promise.all([...smallCats.map(c => probeCategory(c)), ...noListCats.map(c => probeCategory(c)), probeBackgrounds()]);
  buildFxTabs();
  buildFxGrids();
  buildBgImageGrid();
  if (imgLoaded) redraw();
}

function playCount(callback) {
  if (counterLocked) return;
  counterLocked = true;
  const el = document.getElementById('splashScreen');
  const ring = document.getElementById('splashRing');
  if (!el) { counterLocked = false; if (callback) callback(); return; }
  el.classList.remove('fade-out');
  el.style.display = 'flex';
  const DURATION = 1500;
  const CIRC = 238.76;
  const start = performance.now();
  let cb = false;
  if (ring) ring.setAttribute('stroke-dashoffset', CIRC);
  function step(now) {
    const elapsed = now - start;
    const pct = Math.min(1, elapsed / DURATION);
    if (ring) ring.setAttribute('stroke-dashoffset', CIRC * (1 - pct));
    if (!cb && pct >= 0.4 && callback) { cb = true; try { callback(); } catch(e){} }
    if (pct < 1) requestAnimationFrame(step);
    else {
      if (!cb && callback) { try { callback(); } catch(e){} }
      setTimeout(() => {
        el.classList.add('fade-out');
        setTimeout(() => { el.style.display = 'none'; counterLocked = false; }, 300);
      }, 100);
    }
  }
  requestAnimationFrame(step);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerText = msg || 'Saved';
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 1500);
}

function switchAdjustCat(name, el) {
  const panel = el.closest('.panel');
  panel.querySelectorAll('.sub-view').forEach(v => v.classList.remove('active'));
  panel.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
  const sv = panel.querySelector('#adjust-' + name);
  if (sv) sv.classList.add('active');
  el.classList.add('active');
  if (name === 'templates') buildTemplates();
  if (name === 'presets') buildPresetThumbs();
}

function buildPresetThumbs() {
  const el = document.getElementById('presetThumbsContainer');
  if (!el) return;
  if (!imgLoaded || !img.src) { el.innerHTML = '<div class="filter-empty">Load a photo</div>'; return; }
  const src = img.src;
  let html = '';
  FILTERS.forEach((f, i) => {
    const sel = (currentFilter === f.code) ? 'selected' : '';
    const filterStyle = f.code === 'none' ? 'none' : f.code;
    html += `<div class="filter-thumb ${sel}" onclick="applyFilterByIndex(${i}, this)"><div class="filter-thumb-img" style="background-image:url('${src}'); filter:${filterStyle};"></div><span class="filter-thumb-label">${f.name}</span></div>`;
  });
  el.innerHTML = html;
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
  const cat = FX_CATEGORIES.find(c => c.key === key);
  if (cat && cat.fileList && (!cat.files || !cat.files.length)) {
    const g = document.getElementById('fxGrid-' + key);
    if (g) g.innerHTML = '<div class="filter-empty">Loading ' + cat.fileList.length + ' effects...</div>';
    probeCategory(cat).then(() => { buildFxGrid(key); });
  }
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
  if (!cat.files || !cat.files.length) html += `<div class="filter-empty">No files</div>`;
  else {
    cat.files.forEach(f => {
      const key = catKey + ':' + f.fname;
      const sel = (currentFx === key) ? 'selected' : '';
      html += `<div class="fx-card ${sel}" onclick="setFx('${key}', this)"><div class="fx-card-preview"><img src="${EFFECTS_BASE + f.fname}" style="width:100%;height:100%;object-fit:cover;"></div><span class="fx-card-label">${f.base}</span></div>`;
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
  const fv = document.getElementById('fxVal'); if (fv) fv.innerText = v;
  redraw(); saveState();
}

function resetFxTransform() {
  fxX = 0.5; fxY = 0.5; fxScale = 1; fxRotation = 0;
  redraw(); saveState();
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
  const cw = canvas.width, ch = canvas.height;
  const baseW = cw * fxScale;
  const baseH = ch * fxScale;
  ctx.translate(fxX * cw, fxY * ch);
  if (fxRotation) ctx.rotate(fxRotation);
  const sr = im.naturalWidth / im.naturalHeight;
  const dr = baseW / baseH;
  let sx = 0, sy = 0, sw = im.naturalWidth, sh = im.naturalHeight;
  if (sr > dr) { sw = sh * dr; sx = (im.naturalWidth - sw) / 2; }
  else { sh = sw / dr; sy = (im.naturalHeight - sh) / 2; }
  ctx.drawImage(im, sx, sy, sw, sh, -baseW/2, -baseH/2, baseW, baseH);
  ctx.restore();
}

function buildBgImageGrid() {
  const g = document.getElementById('bgImageGrid');
  if (!g) return;
  let html = '';
  const noneSel = (!currentBgImage && !currentBgColor) ? 'selected' : '';
  html += '<div class="bg-item ' + noneSel + '" onclick="clearAllBg()"><div class="bg-item-img" style="display:flex;align-items:center;justify-content:center;background:#1a1a1a;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div><span class="bg-item-label">None</span></div>';
  if (!BG_CONFIG.files.length) { g.innerHTML = html; return; }
  BG_CONFIG.files.forEach(f => {
    if (f.fname === 'background10.jpg') return;
    const sel = (currentBgImage && currentBgImage.src.endsWith(f.fname)) ? 'selected' : '';
    const label = BG_LABELS[f.fname] || f.fname.replace('.jpg','').replace('background','');
    html += `<div class="bg-item ${sel}" onclick="setBgImage('${f.fname}', this)"><div class="bg-item-img"><img src="${EFFECTS_BASE + f.fname}"></div><span class="bg-item-label">${label}</span></div>`;
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

function setBgImageSize(v) { currentBgImageSize = parseInt(v); const e = document.getElementById('bgImgSizeVal'); if (e) e.innerText = v; redraw(); saveState(); }
function setBgImageZoom(v) { currentBgImageZoom = parseInt(v); const e = document.getElementById('bgImgZoomVal'); if (e) e.innerText = v; redraw(); saveState(); }
function setBgImageX(v) { currentBgImageX = parseInt(v); const e = document.getElementById('bgImgXVal'); if (e) e.innerText = v; redraw(); saveState(); }
function setBgImageY(v) { currentBgImageY = parseInt(v); const e = document.getElementById('bgImgYVal'); if (e) e.innerText = v; redraw(); saveState(); }

function resetBgPosition() {
  currentBgImageZoom = 100; currentBgImageX = 0; currentBgImageY = 0;
  const z = document.getElementById('bgImgZoomInput'); if (z) z.value = 100;
  const zv = document.getElementById('bgImgZoomVal'); if (zv) zv.innerText = '100';
  const x = document.getElementById('bgImgXInput'); if (x) x.value = 0;
  const xv = document.getElementById('bgImgXVal'); if (xv) xv.innerText = '0';
  const y = document.getElementById('bgImgYInput'); if (y) y.value = 0;
  const yv = document.getElementById('bgImgYVal'); if (yv) yv.innerText = '0';
  redraw(); saveState();
}

function clearBgImage() {
  currentBgImage = null;
  document.querySelectorAll('.bg-item').forEach(x => x.classList.remove('selected'));
  redraw(); saveState();
}

function switchBgDrag(mode, el) {
  bgDragMode = mode;
  gestureTarget = mode;
  if (el && el.parentElement) {
    el.parentElement.querySelectorAll('.h-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
  }
}

function clearAllBg() {
  currentBgColor = null;
  currentBgImage = null;
  customBgImage = null;
  currentBgImageZoom = 100;
  currentBgImageX = 0;
  currentBgImageY = 0;
  document.querySelectorAll('.bgcolor-swatch').forEach(s => s.classList.remove('selected'));
  document.querySelectorAll('.bg-item').forEach(x => x.classList.remove('selected'));
  const noneSwatch = document.querySelector('.bgcolor-swatch');
  if (noneSwatch) noneSwatch.classList.add('selected');
  redraw(); saveState();
  showToast('Background cleared');
}

function resetSubjectTransform() {
  subjectX = 0.5; subjectY = 0.5; subjectScale = 1;
  redraw(); saveState();
}function setUnshowOpacity(v) {
  v = parseInt(v);
  overlayOpacity = v;
  const e = document.getElementById('unshowOpacityVal'); if (e) e.innerText = v;
  redraw(); saveState();
}

function setCut(edge, v) {
  v = parseInt(v);
  if (edge === 'top') { cutTop = v; const e = document.getElementById('cutTopVal'); if (e) e.innerText = v; }
  else if (edge === 'bottom') { cutBottom = v; const e = document.getElementById('cutBottomVal'); if (e) e.innerText = v; }
  else if (edge === 'left') { cutLeft = v; const e = document.getElementById('cutLeftVal'); if (e) e.innerText = v; }
  else if (edge === 'right') { cutRight = v; const e = document.getElementById('cutRightVal'); if (e) e.innerText = v; }
  redraw(); saveState();
}
function setCutFeather(v) { cutFeather = parseInt(v); const e = document.getElementById('cutFeatherVal'); if (e) e.innerText = v; redraw(); saveState(); }
function setCornerRound(v) { cornerRound = parseInt(v); const e = document.getElementById('cornerRoundVal'); if (e) e.innerText = v; redraw(); saveState(); }
function resetUnshow() {
  unshowOpacity = 100; cutTop = 0; cutBottom = 0; cutLeft = 0; cutRight = 0; cutFeather = 0; cornerRound = 0;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  const label = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
  set('unshowOpacityInput', 100); label('unshowOpacityVal', '100');
  set('cutTopInput', 0); label('cutTopVal', '0');
  set('cutBottomInput', 0); label('cutBottomVal', '0');
  set('cutLeftInput', 0); label('cutLeftVal', '0');
  set('cutRightInput', 0); label('cutRightVal', '0');
  set('cutFeatherInput', 0); label('cutFeatherVal', '0');
  set('cornerRoundInput', 0); label('cornerRoundVal', '0');
  redraw(); saveState();
}

function handleCleanPick(input) {
  const file = (input.files || [])[0];
  if (!file) return;
  input.value = '';
  pickAndClean(file);
}

function setOverlayTint(color, el) {
  if (color === null) {
    if (overlayImg && overlayImg._isColorFill) overlayImg = null;
    overlayTint = null;
    overlayOpacity = 0;
    const op = document.getElementById('unshowOpacityInput'); if (op) op.value = 0;
    const opv = document.getElementById('unshowOpacityVal'); if (opv) opv.innerText = '0';
  } else {
    const c = document.createElement('canvas');
    c.width = 400; c.height = 400;
    const cx = c.getContext('2d');
    cx.fillStyle = color;
    cx.fillRect(0, 0, 400, 400);
    const im = new Image();
    im.onload = function() {
      im._isColorFill = true;
      overlayImg = im;
      overlayTint = null;
      overlayX = 0.5; overlayY = 0.5;
      overlayScale = 0.7; overlayRotation = 0;
      overlayOpacity = 100;
      const op = document.getElementById('unshowOpacityInput'); if (op) op.value = 100;
      const opv = document.getElementById('unshowOpacityVal'); if (opv) opv.innerText = '100';
      const s = document.getElementById('overlayScaleSlider'); if (s) s.value = 70;
      const sv = document.getElementById('overlayScaleVal'); if (sv) sv.innerText = '70';
      redraw(); saveState();
    };
    im.src = c.toDataURL();
  }
  const row = document.querySelector('#subtab-overlaycolor .color-row');
  if (row) row.querySelectorAll('.color-circle').forEach(cc => cc.classList.remove('selected'));
  if (el) el.classList.add('selected');
  redraw(); saveState();
}

function setOverlayTintAmt(v) { overlayTintAmount = parseInt(v); const e = document.getElementById('overlayTintAmtVal'); if (e) e.innerText = v; redraw(); saveState(); }
function setOverlayBrightness(v) {
  v = parseInt(v);
  const e = document.getElementById('ocBrVal'); if (e) e.innerText = v;
  if (!overlayTint) overlayTint = '#ffffff';
  const hsl = hexToHsl(overlayTint);
  overlayTint = hslToHex(hsl.h, hsl.s, v);
  const prev = document.getElementById('overlayColorPreview');
  if (prev) prev.style.background = overlayTint;
  redraw(); saveState();
}
function setOverlayHue(v) {
  v = parseInt(v);
  const e = document.getElementById('ocHueVal'); if (e) e.innerText = v + '°';
  if (!overlayTint) overlayTint = '#ffffff';
  const hsl = hexToHsl(overlayTint);
  overlayTint = hslToHex(v, Math.max(hsl.s, 70), hsl.l);
  const prev = document.getElementById('overlayColorPreview');
  if (prev) prev.style.background = overlayTint;
  redraw(); saveState();
}
function resetOverlayTint() {
  overlayTint = null; overlayTintAmount = 60;
  const row = document.querySelector('#subtab-overlaycolor .color-row');
  if (row) {
    row.querySelectorAll('.color-circle').forEach(c => c.classList.remove('selected'));
    const first = row.querySelector('.color-circle');
    if (first) first.classList.add('selected');
  }
  const amt = document.getElementById('overlayTintAmt'); if (amt) amt.value = 60;
  const amtV = document.getElementById('overlayTintAmtVal'); if (amtV) amtV.innerText = '60';
  redraw(); saveState();
}
function setOverlayCrop(ratio, el) {
  overlayCropRatio = ratio;
  if (el && el.parentElement) {
    el.parentElement.querySelectorAll('.h-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
  }
  redraw(); saveState();
}
function setOverlayRound(v) { overlayRound = parseInt(v); const e = document.getElementById('overlayRoundVal'); if (e) e.innerText = v; redraw(); saveState(); }
function setOverlayScale(v) { v = parseInt(v); overlayScale = v / 100; const e = document.getElementById('overlayScaleVal'); if (e) e.innerText = v; redraw(); saveState(); }
function setOverlayRot(v) { v = parseInt(v); overlayRotation = v * Math.PI / 180; const e = document.getElementById('overlayRotVal'); if (e) e.innerText = v; redraw(); saveState(); }
function resetOverlayTransform() {
  overlayCropRatio = 'free'; overlayRound = 0; overlayScale = 0.7; overlayRotation = 0;
  const s = document.getElementById('overlayScaleSlider'); if (s) s.value = 70;
  const sv = document.getElementById('overlayScaleVal'); if (sv) sv.innerText = '70';
  const r = document.getElementById('overlayRotSlider'); if (r) r.value = 0;
  const rv = document.getElementById('overlayRotVal'); if (rv) rv.innerText = '0';
  const rd = document.getElementById('overlayRound'); if (rd) rd.value = 0;
  const rdv = document.getElementById('overlayRoundVal'); if (rdv) rdv.innerText = '0';
  const cropRow = document.querySelector('#subtab-overlaycrop .h-scroll');
  if (cropRow) {
    cropRow.querySelectorAll('.h-card').forEach(c => c.classList.remove('selected'));
    const first = cropRow.querySelector('.h-card');
    if (first) first.classList.add('selected');
  }
  redraw(); saveState();
}

function setCartoonStyle(name, el) {
  cartoonStyle = name;
  if (el && el.parentElement) {
    el.parentElement.querySelectorAll('.h-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
  }
  cartoonCanvas = null;
  redraw(); saveState();
}
function setCartoonAmount(v) { cartoonAmount = parseInt(v); const e = document.getElementById('cartoonAmtVal'); if (e) e.innerText = v; cartoonCanvas = null; redraw(); saveState(); }
function setCartoonLevels(v) { cartoonLevels = parseInt(v); const e = document.getElementById('cartoonLevelsVal'); if (e) e.innerText = v; cartoonCanvas = null; redraw(); saveState(); }
function setCartoonEdge(v) { cartoonEdge = parseFloat(v); const e = document.getElementById('cartoonEdgeVal'); if (e) e.innerText = v; cartoonCanvas = null; redraw(); saveState(); }
function resetCartoon() {
  cartoonStyle = 'none'; cartoonAmount = 70; cartoonLevels = 6; cartoonEdge = 1.2; cartoonCanvas = null;
  const a = document.getElementById('cartoonAmt'); if (a) a.value = 70;
  const av = document.getElementById('cartoonAmtVal'); if (av) av.innerText = '70';
  const l = document.getElementById('cartoonLevels'); if (l) l.value = 6;
  const lv = document.getElementById('cartoonLevelsVal'); if (lv) lv.innerText = '6';
  const e = document.getElementById('cartoonEdge'); if (e) e.value = 1.2;
  const ev = document.getElementById('cartoonEdgeVal'); if (ev) ev.innerText = '1.2';
  const row = document.querySelector('#adjust-cartoon .h-scroll');
  if (row) {
    row.querySelectorAll('.h-card').forEach(c => c.classList.remove('selected'));
    const first = row.querySelector('.h-card');
    if (first) first.classList.add('selected');
  }
  redraw(); saveState();
}

function generateCartoon(srcCanvas) {
  const w = srcCanvas.width, h = srcCanvas.height;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const octx = out.getContext('2d');
  octx.drawImage(srcCanvas, 0, 0);
  const levels = cartoonLevels;
  const step = 255 / (levels - 1);
  const edgeAmt = cartoonEdge;
  const style = cartoonStyle;
  const src = octx.getImageData(0, 0, w, h);
  const d = src.data;
  if (style === 'anime' || style === 'cell' || style === 'oil') {
    const blur = document.createElement('canvas');
    blur.width = w; blur.height = h;
    const bctx = blur.getContext('2d');
    bctx.filter = 'blur(1.2px)';
    bctx.drawImage(srcCanvas, 0, 0);
    const bd = bctx.getImageData(0, 0, w, h).data;
    for (let i = 0; i < d.length; i++) d[i] = bd[i];
  }
  for (let i = 0; i < d.length; i += 4) {
    d[i]   = Math.round(d[i]   / step) * step;
    d[i+1] = Math.round(d[i+1] / step) * step;
    d[i+2] = Math.round(d[i+2] / step) * step;
  }
  if (edgeAmt > 0 && style !== 'oil') {
    const lum = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) lum[j] = (d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114);
    const edge = new Uint8ClampedArray(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx = -lum[i-w-1] - 2*lum[i-1] - lum[i+w-1] + lum[i-w+1] + 2*lum[i+1] + lum[i+w+1];
        const gy = -lum[i-w-1] - 2*lum[i-w] - lum[i-w+1] + lum[i+w-1] + 2*lum[i+w] + lum[i+w+1];
        edge[i] = Math.min(255, Math.sqrt(gx*gx + gy*gy) * edgeAmt);
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x; const p = i * 4; const e = edge[i];
        if (e > 60) {
          const k = Math.min(1, (e - 60) / 80);
          d[p] *= (1 - k); d[p+1] *= (1 - k); d[p+2] *= (1 - k);
        }
      }
    }
    octx.putImageData(src, 0, 0);
    return out;
  }
  octx.putImageData(src, 0, 0);
  if (style === 'sketch') {
    const g = document.createElement('canvas'); g.width = w; g.height = h;
    const gctx = g.getContext('2d');
    gctx.filter = 'grayscale(100%) contrast(140%)';
    gctx.drawImage(srcCanvas, 0, 0);
    const inv = document.createElement('canvas'); inv.width = w; inv.height = h;
    const ictx = inv.getContext('2d');
    ictx.filter = 'invert(100%) blur(2px)';
    ictx.drawImage(g, 0, 0);
    const sctx = out.getContext('2d');
    sctx.globalCompositeOperation = 'color-dodge';
    sctx.drawImage(inv, 0, 0);
  }
  return out;
}

function openBackupSheet() {
  const sheet = document.getElementById('backupSheet');
  const card = document.getElementById('backupSheetCard');
  if (!sheet || !card) return;
  sheet.style.display = 'flex';
  requestAnimationFrame(() => { card.style.transform = 'translateY(0)'; });
}
function closeBackupSheet() {
  const sheet = document.getElementById('backupSheet');
  const card = document.getElementById('backupSheetCard');
  if (!sheet || !card) return;
  card.style.transform = 'translateY(-100%)';
  setTimeout(() => { sheet.style.display = 'none'; }, 300);
}
document.addEventListener('click', function(e) {
  if (e.target && e.target.id === 'backupSheet') closeBackupSheet();
});

function buildMxData() {
  const serializedLayers = textLayers.map(l => ({
    id: l.id, text: l.text, x: l.x, y: l.y, size: l.size,
    font: l.font, color: l.color, style: l.style,
    rotation: l.rotation, persp: l.persp || 0
  }));
  let bgFile = null;
  if (currentBgImage) {
    for (const f of BG_CONFIG.files) if (bgImages[f.fname] === currentBgImage) { bgFile = f.fname; break; }
  }
  return {
    version: 1, app: 'MxStudio', savedAt: new Date().toISOString(),
    name: currentProjectName || 'Untitled',
    photo: originalImageSrc, canvasW: canvas.width, canvasH: canvas.height,
    textLayers: serializedLayers,
    brightness: bInput.value, contrast: cInput.value, saturation: sInput.value, noise: nInput.value,
    filter: currentFilter, border: currentBorder, borderColor: currentBorderColor, borderSize: currentBorderSize,
    bgColor: currentBgColor, bgColorSize: currentBgColorSize,
    bgImageFile: bgFile, bgImageSize: currentBgImageSize,
    customBgData: (currentBgImage && customBgImage && currentBgImage === customBgImage) ? customBgImage.src : null,
    bgImageZoom: currentBgImageZoom, bgImageX: currentBgImageX, bgImageY: currentBgImageY,
    template: currentTemplate, fx: currentFx, fxAmount: currentFxAmount,
    fxX, fxY, fxScale, fxRotation,
    subjectX, subjectY, subjectScale, subjectMode, strokeColor,
    subjectAmount: subjAmt.value
  };
}

function importMxProject() {
  let inp = document.getElementById('mxImportInput');
  if (!inp) {
    inp = document.createElement('input');
    inp.type = 'file'; inp.id = 'mxImportInput';
    inp.accept = '.mx,.txt,application/json';
    inp.style.display = 'none';
    inp.addEventListener('change', handleMxImport);
    document.body.appendChild(inp);
  }
  inp.click();
}

function handleMxImport(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    try { const data = JSON.parse(ev.target.result); applyMxData(data); }
    catch (err) { showToast('Invalid .mx file'); }
  };
  reader.readAsText(file);
}

function applyMxData(data) {
  if (!data || data.app !== 'MxStudio') { showToast('Invalid .mx file'); return; }
  const newImg = new Image();
  newImg.onload = function() {
    img = newImg;
    imgLoaded = true;
    originalImageSrc = data.photo;
    window.__originalBeforeBgRemove = data.photo;
    canvas.width = data.canvasW || newImg.width;
    canvas.height = data.canvasH || newImg.height;
    currentProjectId = null;
    currentProjectName = data.name || 'Imported';
    textLayers = (data.textLayers || []).map(l => ({
      id: l.id || Date.now() + Math.random(),
      text: l.text || '', x: l.x, y: l.y,
      size: l.size || 40, font: l.font || 'Impact',
      color: l.color || '#ffffff', style: l.style || 'normal',
      rotation: l.rotation || 0, persp: l.persp || 0
    }));
    activeLayerId = null;
    if (data.brightness !== undefined) bInput.value = data.brightness;
    if (data.contrast !== undefined) cInput.value = data.contrast;
    if (data.saturation !== undefined) sInput.value = data.saturation;
    if (data.noise !== undefined) nInput.value = data.noise;
    currentFilter = data.filter || 'none';
    currentBorder = data.border || 'none';
    currentBorderColor = data.borderColor || '#ffffff';
    currentBorderSize = data.borderSize || 5;
    currentBgColor = data.bgColor || null;
    currentBgColorSize = data.bgColorSize || 8;
    currentBgImageSize = data.bgImageSize || 8;
    currentBgImageZoom = data.bgImageZoom || 100;
    currentBgImageX = data.bgImageX || 0;
    currentBgImageY = data.bgImageY || 0;
    currentTemplate = data.template || 'none';
    currentFx = data.fx || 'none';
    currentFxAmount = data.fxAmount || 70;
    fxX = data.fxX !== undefined ? data.fxX : 0.5;
    fxY = data.fxY !== undefined ? data.fxY : 0.5;
    fxScale = data.fxScale || 1;
    fxRotation = data.fxRotation || 0;
    subjectX = data.subjectX !== undefined ? data.subjectX : 0.5;
    subjectY = data.subjectY !== undefined ? data.subjectY : 0.5;
    subjectScale = data.subjectScale || 1;
    backgroundRemoved = !!data.backgroundRemoved;
    subjectMode = data.subjectMode || 'none';
    strokeColor = data.strokeColor || '#ffffff';
    if (data.bgImageFile && bgImages[data.bgImageFile]) {
      currentBgImage = bgImages[data.bgImageFile];
    } else if (data.customBgData) {
      const c = new Image();
      c.onload = () => { currentBgImage = c; customBgImage = c; redraw(); };
      c.src = data.customBgData;
    } else {
      currentBgImage = null;
    }
    if (data.customBgData) {
      const c = new Image();
      c.onload = () => { customBgImage = c; redraw(); };
      c.src = data.customBgData;
    }
    personMask = null; subjectReady = false;
    buildFilterThumbs(); buildTemplates(); buildBorders(); buildBgColors();
    buildBgImageGrid();
    redraw();
    undoStack = []; redoStack = []; updateHistoryButtons();
    closeBackupSheet();
    showToast('Imported: ' + currentProjectName);
    setTimeout(function() {
      document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
      var sv = document.getElementById('view-studio');
      if (sv) sv.classList.add('active');
      redraw();
    }, 400);
  };
  newImg.onerror = function() { showToast('Image data failed to load'); };
  newImg.src = data.photo;
}

function deleteCurrentProject() {
  if (!currentProjectId) { showToast('Nothing to delete'); return; }
  localStorage.removeItem('music_' + currentProjectId);
  currentProjectId = null;
  currentProjectName = '';
  closeBackupSheet();
  showToast('Deleted from Studio');
  setTimeout(() => { goHome(); }, 800);
}

document.addEventListener('change', function(e) {
  if (e.target && e.target.id === 'mxImportInput') {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
      try { const data = JSON.parse(ev.target.result); applyMxData(data); }
      catch (err) { showToast('Invalid .mx file'); }
    };
    reader.readAsText(file);
  }
});

function exportMxProject() {
  if (!imgLoaded) { showToast('Load a photo first'); return; }
  const data = buildMxData();
  const json = JSON.stringify(data);
  const filename = (currentProjectName || 'MxProject').replace(/[^a-z0-9\-_ ]/gi, '_').replace(/\s+/g, '-') + '.mx';
  const blob = new Blob([json], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  closeBackupSheet();
  showToast('Exported ' + filename);
}

function startCutBody() {
  const status = document.getElementById('cutBodyStatus');
  if (!imgLoaded) { if (status) status.textContent = 'Load a photo first.'; return; }
  if (!backgroundRemoved) {
    if (status) status.textContent = '⚠ Remove background first. Go to BG RMV tab, tap REMOVE BACKGROUND, then come back.';
    return;
  }
  cutBodyActive = true;
  cutBox = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
  document.getElementById('cutBodyActions').style.display = 'block';
  if (status) status.textContent = 'Drag corners to resize. Drag inside to move. Tap APPLY when done.';
  switchPanel('cutbody', document.querySelector('.nav-btn[data-panel="cutbody"]'));
  redraw();
}
function cancelCutBody() {
  cutBodyActive = false; isDraggingCutBox = false; cutBoxDragStart = null;
  document.getElementById('cutBodyActions').style.display = 'none';
  document.getElementById('cutBodyStatus').textContent = 'Tap START CUT to place a crop box over the canvas.';
  redraw();
}
function resetCutBoxFull() { cutBox = { x: 0, y: 0, w: 1, h: 1 }; redraw(); }
function resetCutBoxCenter() { cutBox = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }; redraw(); }
function applyCutBody() {
  if (!cutBodyActive || !imgLoaded) return;
  const px = Math.round(cutBox.x * canvas.width);
  const py = Math.round(cutBox.y * canvas.height);
  const pw = Math.max(8, Math.round(cutBox.w * canvas.width));
  const ph = Math.max(8, Math.round(cutBox.h * canvas.height));
  const tmp = document.createElement('canvas');
  tmp.width = pw; tmp.height = ph;
  tmp.getContext('2d').drawImage(img, px, py, pw, ph, 0, 0, pw, ph);
  const url = tmp.toDataURL('image/png');
  const newImg = new Image();
  newImg.onload = function() {
    img = newImg; imgLoaded = true; originalImageSrc = url;
    canvas.width = pw; canvas.height = ph;
    personMask = null; subjectReady = false;
    cutBodyActive = false; isDraggingCutBox = false; cutBoxDragStart = null;
    document.getElementById('cutBodyActions').style.display = 'none';
    document.getElementById('cutBodyStatus').textContent = 'Cut applied! Tap START CUT again to trim more.';
    buildFilterThumbs(); buildTemplates(); buildBorders();
    redraw(); saveState();
  };
  newImg.onerror = function() { document.getElementById('cutBodyStatus').textContent = 'Cut failed. Try again.'; };
  newImg.src = url;
}
function drawCutBox() {
  if (!cutBodyActive) return;
  const w = canvas.width, h = canvas.height;
  const bx = cutBox.x * w, by = cutBox.y * h;
  const bw = cutBox.w * w, bh = cutBox.h * h;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, w, by);
  ctx.fillRect(0, by + bh, w, h - by - bh);
  ctx.fillRect(0, by, bx, bh);
  ctx.fillRect(bx + bw, by, w - bx - bw, bh);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = '#00d4ff';
  ctx.lineWidth = 3;
  ctx.strokeRect(bx, by, bw, bh);
  const r = 12;
  ctx.fillStyle = '#00d4ff';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(bx+bw, by, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(bx, by+bh, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(bx+bw, by+bh, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function pickAndClean(file) {
  const status = document.getElementById('cleanStatus');
  if (status) status.textContent = 'Loading photo...';
  const reader = new FileReader();
  reader.onload = (ev) => {
    const newImg = new Image();
    newImg.onload = () => {
      overlayImg = newImg;
      overlayX = 0.5; overlayY = 0.5; overlayScale = 0.7; overlayRotation = 0;
      overlayOpacity = 0;
      const op = document.getElementById('unshowOpacityInput'); if (op) op.value = 0;
      const opv = document.getElementById('unshowOpacityVal'); if (opv) opv.innerText = '0';
      if (!imgLoaded) {
        img = newImg; originalImageSrc = ev.target.result; imgLoaded = true;
        window.__originalBeforeBgRemove = ev.target.result;
        currentBgColor = null; currentBgImage = null;
        setupCanvasFromImage(newImg);
        buildFilterThumbs(); buildTemplates(); buildBorders();
      }
      redraw(); saveState();
      if (status) status.textContent = 'Photo added as layer. Drag to move, pinch to resize.';
      showToast('Photo added as layer');
    };
    newImg.onerror = () => { if (status) status.textContent = 'Failed to load image.'; };
    newImg.src = ev.target.result;
  };
  reader.onerror = () => { if (status) status.textContent = 'Failed to read file.'; };
  reader.readAsDataURL(file);
}

function buildFontGrid() {
  const c = document.getElementById('fontGridContainer');
  if (!c) return;
  const fontList = ["Impact","Bebas Neue","Oswald","Montserrat","Anton","Pacifico","Permanent Marker","Russo One","Press Start 2P","Righteous","Orbitron","Bungee","Bungee Inline","Creepster","Monoton","Luckiest Guy","Rye","Satisfy","Yellowtail","Chewy","Alfa Slab One","Cinzel","Audiowide","Black Ops One","Chango","Coiny","Damion","Diplomata SC","Frijole","Gloria Hallelujah","Gugi","Knewave","Lobster","Parisienne","Poppins","Playfair Display","Special Elite","Great Vibes","Merriweather","Dancing Script","Caveat","Cormorant Garamond","Crimson Text","Exo 2","Fjalla One","Indie Flower","Josefin Sans","Lora","Lobster Two","Merienda","Nanum Pen Script","Neucha","Nunito","Oleo Script","Pattaya","Peralta","Rajdhani","Rock Salt","Sacramento","Shadows Into Light","Share Tech Mono","Sigmar One","Spectral","Teko","Titan One","Ubuntu","Unica One","Varela Round","Vollkorn","Yanone Kaffeesatz","Zilla Slab","Abril Fatface","Alegreya","Archivo Black","Barlow Condensed","Bitter","Bree Serif","Cabin","Catamaran","Comfortaa","DM Serif Display","EB Garamond","Fira Sans","Frank Ruhl Libre","Fugaz One","Gothic A1","Heebo","IBM Plex Sans","Inconsolata","Jost","Karla","Kaushan Script","Libre Baskerville","Lilita One","M PLUS Rounded 1c","Manrope","Marcellus","Maven Pro"];
  const activeFont = (textLayers.find(l => l.id === activeLayerId) || {}).font;
  let html = '';
  fontList.forEach(f => {
    const sel = (f === (activeFont || 'Impact')) ? 'selected' : '';
    html += `<div class="font-pill ${sel}" style="font-family:'${f}',sans-serif" onclick="setActiveFont('${f}', this)">${f}</div>`;
  });
  c.innerHTML = html;
}

function buildBgColors() {
  const c = document.getElementById('bgColorRow');
  if (!c) return;
  let html = '';
  const noneSel = (!currentBgColor && !currentBgImage) ? 'selected' : '';
  html += `<div class="bgcolor-swatch ${noneSel}" style="background:linear-gradient(135deg,#2a2a2a 45%,#111 45%,#111 55%,#2a2a2a 55%);display:flex;align-items:center;justify-content:center;" onclick="setBgColor(null, this)"><span style="color:#888;font-size:11px;font-weight:700;">NONE</span></div>`;
  BG_COLORS.forEach(col => {
    const sel = (currentBgColor === col) ? 'selected' : '';
    html += `<div class="bgcolor-swatch ${sel}" style="background:${col};" onclick="setBgColor('${col}', this)"></div>`;
  });
  c.innerHTML = html;
}

function setBgColor(color, el) {
  currentBgColor = color; currentBgImage = null;
  document.querySelectorAll('.bgcolor-swatch').forEach(s => s.classList.remove('selected'));
  document.querySelectorAll('.bg-item').forEach(x => x.classList.remove('selected'));
  if (el) el.classList.add('selected');
  redraw(); saveState();
}
function setBgColorSize(v) { currentBgColorSize = parseInt(v); const e = document.getElementById('bgColorSizeVal'); if (e) e.innerText = v; redraw(); saveState(); }

function buildTemplates() {
  const c = document.getElementById('templateContainer');
  if (!c) return;
  if (!imgLoaded || !img.src) { c.innerHTML = '<div class="filter-empty">Load a photo</div>'; return; }
  const src = img.src;
  let html = '';
  TEMPLATES.forEach((t, i) => {
    const sel = (currentTemplate === t.name) ? 'selected' : '';
    const filterStyle = `brightness(${t.b}%) contrast(${t.c}%) saturate(${t.s}%) ${t.f !== 'none' ? t.f : ''}`;
    html += `<div class="template-thumb ${sel}" onclick="applyTemplate(${i}, this)"><div class="template-thumb-img" style="background-image:url('${src}'); filter:${filterStyle};"></div><span class="template-thumb-label">${t.name}</span></div>`;
  });
  c.innerHTML = html;
}

function applyTemplate(i, el) {
  const t = TEMPLATES[i]; if (!t) return;
  bInput.value=t.b; cInput.value=t.c; sInput.value=t.s; nInput.value=t.n;
  currentFilter = t.f; currentTemplate = t.name;
  el.parentElement.querySelectorAll('.template-thumb').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  buildFilterThumbs(); buildPresetThumbs(); redraw(); saveState();
}

function buildBorders() {
  const c = document.getElementById('borderContainer');
  if (!c) return;
  let html = '';
  BORDERS.forEach(b => {
    const sel = (currentBorder === b.code) ? 'selected' : '';
    html += `<div class="border-thumb ${sel}" onclick="setBorder('${b.code}', this)"><div class="border-thumb-img">${borderPreviewHTML(b.code)}</div><span class="border-thumb-label">${b.name}</span></div>`;
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
  if (el) { el.parentElement.querySelectorAll('.bcolor-circle').forEach(c => c.classList.remove('selected')); el.classList.add('selected'); }
  buildBorders(); redraw(); saveState();
}
function setBorderSize(v) { currentBorderSize = parseInt(v); const e = document.getElementById('borderSizeVal'); if (e) e.innerText = v; redraw(); saveState(); }

function buildFilterThumbs() {
  const el = document.getElementById('filterThumbsContainer');
  if (!el) return;
  if (!imgLoaded || !img.src) { el.innerHTML = '<div class="filter-empty">Load a photo</div>'; return; }
  const src = img.src;
  let html = '';
  FILTERS.forEach((f, i) => {
    const sel = (currentFilter === f.code) ? 'selected' : '';
    const filterStyle = f.code === 'none' ? 'none' : f.code;
    html += `<div class="filter-thumb ${sel}" onclick="applyFilterByIndex(${i}, this)"><div class="filter-thumb-img" style="background-image:url('${src}'); filter:${filterStyle};"></div><span class="filter-thumb-label">${f.name}</span></div>`;
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
  if (!container) return;
  const keys = Object.keys(localStorage).filter(k => k.startsWith('music_proj_'));
  const items = [];
  keys.forEach(key => {
    try {
      const p = JSON.parse(localStorage.getItem(key));
      items.push({ key, image: p.image, name: p.name || 'Untitled', date: p.date || null, timestamp: p.savedAt || new Date(p.date || 0).getTime() || 0 });
    } catch(e) {}
  });
  items.sort((a, b) => b.timestamp - a.timestamp);
  let html = `<div class="home-top-bar"><button class="home-new-btn" onclick="document.getElementById('homeImageUpload').click()"><div class="plus-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div><span>New Project</span></button></div>`;
  html += `<button onclick="importMxProject()" style="width:100%;background:transparent;color:#fff;border:1.5px dashed #555;padding:18px 16px;border-radius:12px;font-size:12px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;letter-spacing:.3px;margin-bottom:16px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>IMPORT .mx PROJECT</button>`;
  if (items.length === 0) {
    html += `<div class="home-empty"><div class="home-empty-icon"> </div><div class="home-empty-title">START YOUR FIRST COVER</div><div class="home-empty-sub">Upload a photo and make something real.</div></div>`;
  } else {
    html += `<div class="section-title">Drafts</div><div class="projects-grid">`;
    items.forEach(it => {
      html += `<div class="project-card" onclick="openProjectWithCount('${it.key}')"><div class="project-card-img"><img src="${it.image}"></div><div class="project-card-info"><div class="project-card-name">${it.name}</div><div class="project-card-date">${timeAgo(it.date)}</div></div><button class="project-card-del" onclick="event.stopPropagation();deleteProject('${it.key}')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>`;
    });
    html += `</div>`;
  }
  container.innerHTML = html;
}

function openProjectWithCount(key) {
  if (counterLocked) return;
  playCount(() => { loadProject(key); });
}
let pendingDeleteKey = null;
function deleteProject(key) {
  pendingDeleteKey = key;
  const modal = document.getElementById('confirmModal');
  const btn = document.getElementById('confirmDeleteBtn');
  btn.onclick = function() {
    if (pendingDeleteKey) { localStorage.removeItem(pendingDeleteKey); pendingDeleteKey = null; }
    closeConfirm();
    renderProjectsList();
  };
  modal.classList.add('active');
}
function closeConfirm() {
  const modal = document.getElementById('confirmModal');
  if (modal) modal.classList.remove('active');
  pendingDeleteKey = null;
}function setupCanvasFromImage(newImg) {
  img = newImg;
  const MAX = 1080;
  let w = newImg.width, h = newImg.height;
  if (w > MAX || h > MAX) { const s = MAX / Math.max(w, h); w = Math.round(w*s); h = Math.round(h*s); }
  canvas.width = w; canvas.height = h;
  backgroundRemoved = false;
  textLayers = []; activeLayerId = null;
  currentProjectId = null; currentProjectName = '';
  currentFilter = 'none'; currentTemplate = 'none';
  currentBorder = 'none'; currentBorderColor = '#ffffff'; currentBorderSize = 5;
  currentBgColor = null; currentBgColorSize = 8;
  currentBgImage = null; currentBgImageSize = 8;
  currentBgImageZoom = 100; currentBgImageX = 0; currentBgImageY = 0;
  currentFx = 'none'; currentFxAmount = 70;
  fxX = 0.5; fxY = 0.5; fxScale = 1; fxRotation = 0;
  subjectMode = 'none'; subjectX = 0.5; subjectY = 0.5; subjectScale = 1;
  personMask = null; subjectReady = false;
  overlayImg = null; overlayOpacity = 0;
  overlayX = 0.5; overlayY = 0.5; overlayScale = 0.7; overlayRotation = 0;
  overlayTint = null; overlayTintAmount = 60;
  overlayCropRatio = 'free'; overlayRound = 0;
  cutTop = 0; cutBottom = 0; cutLeft = 0; cutRight = 0;
  cutFeather = 0; cornerRound = 0; unshowOpacity = 100;
  customBgImage = null;
  undoStack = []; redoStack = [];
  updateHistoryButtons();
  const bi = document.getElementById('brightness'); if (bi) bi.value = 100;
  const ci = document.getElementById('contrast'); if (ci) ci.value = 100;
  const si = document.getElementById('saturation'); if (si) si.value = 100;
  const ni = document.getElementById('noise'); if (ni) ni.value = 0;
  const sa = document.getElementById('subjectAmount'); if (sa) sa.value = 12;
}

function resetStudioState() {
  img = new Image(); imgLoaded = false; originalImageSrc = null;
  preCropImageSrc = null; preCropCanvasW = 0; preCropCanvasH = 0;
  textLayers = []; activeLayerId = null;
  currentFilter = 'none'; currentBorder = 'none'; currentBorderColor = '#ffffff'; currentBorderSize = 5;
  currentTemplate = 'none'; currentBgColor = null; currentBgImage = null;
  currentBgImageZoom = 100; currentBgImageX = 0; currentBgImageY = 0;
  currentFx = 'none'; currentFxAmount = 70;
  subjectMode = 'none'; personMask = null; subjectReady = false;
  undoStack = []; redoStack = []; updateHistoryButtons();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function captureState() {
  return {
    textLayers: JSON.parse(JSON.stringify(textLayers)),
    currentFilter, currentBorder, currentBorderColor, currentBorderSize, currentTemplate,
    currentBgColor, currentBgColorSize, currentBgImage, currentBgImageSize,
    currentBgImageZoom, currentBgImageX, currentBgImageY,
    currentFx, currentFxAmount, fxX, fxY, fxScale, fxRotation,
    subjectMode, subjectX, subjectY, subjectScale,
    personMask, subjectReady,
    brightness: bInput.value, contrast: cInput.value, saturation: sInput.value, noise: nInput.value,
    imgRef: img, originalImageSrc,
    canvasW: canvas.width, canvasH: canvas.height
  };
}

function applyState(s) {
  if (!s) return;
  textLayers = JSON.parse(JSON.stringify(s.textLayers));
  activeLayerId = null;
  currentFilter = s.currentFilter;
  currentBorder = s.currentBorder;
  currentBorderColor = s.currentBorderColor;
  currentBorderSize = s.currentBorderSize;
  currentTemplate = s.currentTemplate;
  currentBgColor = s.currentBgColor;
  currentBgColorSize = s.currentBgColorSize;
  currentBgImage = s.currentBgImage;
  currentBgImageSize = s.currentBgImageSize;
  currentBgImageZoom = s.currentBgImageZoom;
  currentBgImageX = s.currentBgImageX;
  currentBgImageY = s.currentBgImageY;
  currentFx = s.currentFx;
  currentFxAmount = s.currentFxAmount;
  fxX = s.fxX; fxY = s.fxY; fxScale = s.fxScale; fxRotation = s.fxRotation;
  subjectMode = s.subjectMode;
  subjectX = s.subjectX; subjectY = s.subjectY; subjectScale = s.subjectScale;
  personMask = s.personMask;
  subjectReady = s.subjectReady;
  bInput.value = s.brightness; cInput.value = s.contrast;
  sInput.value = s.saturation; nInput.value = s.noise;
  img = s.imgRef; originalImageSrc = s.originalImageSrc;
  canvas.width = s.canvasW; canvas.height = s.canvasH;
  const fa = document.getElementById('fxAmount'); if (fa) fa.value = s.currentFxAmount;
  const fv = document.getElementById('fxVal'); if (fv) fv.innerText = s.currentFxAmount;
  redraw(); updateTextLayersUI();
}
function saveState() {
  if (!imgLoaded) return;
  undoStack.push(captureState());
  if (undoStack.length > 25) undoStack.shift();
  redoStack = [];
  updateHistoryButtons();
}
function undo() {
  if (undoStack.length > 1) {
    redoStack.push(undoStack.pop());
    applyState(undoStack[undoStack.length - 1]);
    updateHistoryButtons();
  }
}
function redo() {
  if (redoStack.length) {
    const nxt = redoStack.pop();
    undoStack.push(nxt); applyState(nxt);
    updateHistoryButtons();
  }
}
function updateHistoryButtons() {
  const u = document.getElementById('undoBtn'); const r = document.getElementById('redoBtn');
  if (u) u.disabled = undoStack.length <= 1;
  if (r) r.disabled = redoStack.length === 0;
}

function getCanvasCoordinates(e, touch) {
  const rect = canvas.getBoundingClientRect();
  const cx = touch ? touch.clientX : (e.touches ? e.touches[0].clientX : e.clientX);
  const cy = touch ? touch.clientY : (e.touches ? e.touches[0].clientY : e.clientY);
  return { x:(cx-rect.left)*(canvas.width/rect.width), y:(cy-rect.top)*(canvas.height/rect.height) };
}
function touchDist(a,b) { return Math.hypot(a.x-b.x, a.y-b.y); }
function touchAngle(a,b) { return Math.atan2(b.y-a.y, b.x-a.x); }

const canvasHost = canvas.parentElement;
canvasHost.addEventListener('mousedown', startTouch);
canvasHost.addEventListener('touchstart', startTouch, {passive:false});
canvasHost.addEventListener('mousemove', onTouchMove);
canvasHost.addEventListener('touchmove', onTouchMove, {passive:false});
canvasHost.addEventListener('mouseup', endTouch);
canvasHost.addEventListener('touchend', endTouch);
canvasHost.addEventListener('touchcancel', endTouch);

function startTouch(e) {
  if (e.target && e.target.closest && e.target.closest('#textFloatingMenu')) return;
  if (!imgLoaded) return;
  if (e.preventDefault) e.preventDefault();
  if (e.touches) { touches.clear(); for (const t of e.touches) touches.set(t.identifier, { x:t.clientX, y:t.clientY }); }
  else { touches.clear(); touches.set('mouse', { x:e.clientX, y:e.clientY }); }
  const fxActive = currentFx && currentFx !== 'none' && !currentFx.endsWith(':none');

  if (gestureTarget === 'fx' && fxActive) {
    if (touches.size === 2) {
      const arr = Array.from(touches.values());
      gesture = { type:'fx', startDist: touchDist(arr[0], arr[1]), startAngle: touchAngle(arr[0], arr[1]), startScale: fxScale, startRot: fxRotation };
      return;
    }
    if (touches.size === 1) {
      const pos = getCanvasCoordinates(e, e.touches ? e.touches[0] : null);
      isDraggingFx = true;
      fxDragStart = { x: pos.x, y: pos.y, fxX: fxX, fxY: fxY };
      return;
    }
    return;
  }

  if (gestureTarget === 'bg' && imgLoaded && currentBgImage) {
    if (touches.size === 2) {
      const arr = Array.from(touches.values());
      gesture = { type:'bg', startDist: touchDist(arr[0], arr[1]), startZoom: currentBgImageZoom };
      return;
    }
    if (touches.size === 1) {
      const pos = getCanvasCoordinates(e, e.touches ? e.touches[0] : null);
      isDraggingBg = true;
      bgDragStart = { x: pos.x, y: pos.y, bgX: currentBgImageX, bgY: currentBgImageY };
      return;
    }
    return;
  }

  if (gestureTarget === 'overlay' && overlayImg) {
    if (touches.size === 2) {
      const arr = Array.from(touches.values());
      gesture = { type:'overlay', startDist: touchDist(arr[0], arr[1]), startAngle: touchAngle(arr[0], arr[1]), startScale: overlayScale, startRot: overlayRotation };
      return;
    }
    if (touches.size === 1) {
      const pos = getCanvasCoordinates(e, e.touches ? e.touches[0] : null);
      isDraggingOverlay = true;
      overlayDragStart = { x: pos.x, y: pos.y, ox: overlayX, oy: overlayY };
      return;
    }
    return;
  }

  if (gestureTarget === 'subject' && imgLoaded) {
    if (touches.size === 2) {
      const arr = Array.from(touches.values());
      gesture = { type:'subject', startDist: touchDist(arr[0], arr[1]), startScale: subjectScale };
      return;
    }
    if (touches.size === 1) {
      const pos = getCanvasCoordinates(e, e.touches ? e.touches[0] : null);
      isDraggingSubject = true;
      subjectDragStart = { x: pos.x, y: pos.y, sx: subjectX, sy: subjectY };
      return;
    }
    return;
  }

  if (touches.size === 2) {
    const arr = Array.from(touches.values());
    if (activeLayerId !== null) {
      const l = textLayers.find(x => x.id === activeLayerId);
      if (l) { gesture = { type:'text', id:l.id, startDist:touchDist(arr[0],arr[1]), startAngle:touchAngle(arr[0],arr[1]), startSize:l.size||100, startRot:l.rotation||0 }; return; }
    }
    return;
  }
  if (touches.size !== 1) return;
  const pos = getCanvasCoordinates(e, e.touches ? e.touches[0] : null);

  // Cut box drag detection (moved OUT of fx branch)
  if (cutBodyActive) {
    const w = canvas.width, h = canvas.height;
    const bx = cutBox.x * w, by = cutBox.y * h;
    const bw = cutBox.w * w, bh = cutBox.h * h;
    const R = 40;
    let corner = null;
    if (Math.hypot(pos.x - bx, pos.y - by) < R) corner = 'tl';
    else if (Math.hypot(pos.x - (bx+bw), pos.y - by) < R) corner = 'tr';
    else if (Math.hypot(pos.x - bx, pos.y - (by+bh)) < R) corner = 'bl';
    else if (Math.hypot(pos.x - (bx+bw), pos.y - (by+bh)) < R) corner = 'br';
    else if (pos.x > bx && pos.x < bx + bw && pos.y > by && pos.y < by + bh) corner = 'move';
    if (corner) {
      isDraggingCutBox = true;
      cutBoxDragStart = { corner: corner, sx: pos.x, sy: pos.y, start: { ...cutBox } };
      return;
    }
  }

  let clickedLayer = null;
  if (activeLayerId !== null) {
    const activeLayer = textLayers.find(x => x.id === activeLayerId);
    if (activeLayer) {
      const hit = hitHandle(pos, activeLayer);
      if (hit) {
        gesture = {
          type: 'handle', handle: hit, id: activeLayer.id,
          startX: pos.x, startY: pos.y,
          startSize: activeLayer.size, startRot: activeLayer.rotation || 0,
          centerX: activeLayer.x, centerY: activeLayer.y,
          startAngle: Math.atan2(pos.y - activeLayer.y, pos.x - activeLayer.x)
        };
        return;
      }
    }
  }

  for (let i = textLayers.length - 1; i >= 0; i--) {
    const layer = textLayers[i];
    ctx.font = `bold ${layer.size}px '${layer.font}', sans-serif`;
    const m = ctx.measureText(layer.text);
    const w = m.width, h = parseInt(layer.size);
    if (pos.x >= layer.x - w/2 - 20 && pos.x <= layer.x + w/2 + 20 && pos.y >= layer.y - h && pos.y <= layer.y + 15) { clickedLayer = layer; break; }
  }
  if (clickedLayer) {
    activeLayerId = clickedLayer.id;
    dragOffsetX = pos.x - clickedLayer.x;
    dragOffsetY = pos.y - clickedLayer.y;
    syncActiveInputs(); updateTextLayersUI(); buildFontGrid();
    isDraggingText = true;
    showFloatingMenu(clickedLayer.x, clickedLayer.y);
    redraw();
  } else {
    activeLayerId = null; textMenu.style.display = 'none'; updateTextLayersUI(); redraw();
  }
}

function onTouchMove(e) {
  if (!imgLoaded) return;
  if (e.preventDefault) e.preventDefault();
  if (e.touches) { for (const t of e.touches) touches.set(t.identifier, { x:t.clientX, y:t.clientY }); }
  else if (touches.has('mouse')) { touches.set('mouse', { x:e.clientX, y:e.clientY }); }
  const fxActive = currentFx && currentFx !== 'none' && !currentFx.endsWith(':none');

  // Cut box dragging (moved OUT of fx branch)
  if (isDraggingCutBox && cutBoxDragStart) {
    const pos = getCanvasCoordinates(e, e.touches ? e.touches[0] : null);
    const w = canvas.width, h = canvas.height;
    const dx = (pos.x - cutBoxDragStart.sx) / w;
    const dy = (pos.y - cutBoxDragStart.sy) / h;
    const s = cutBoxDragStart.start;
    const MIN = 0.08;
    let nx = s.x, ny = s.y, nw = s.w, nh = s.h;
    const c = cutBoxDragStart.corner;
    if (c === 'move') {
      nx = Math.max(0, Math.min(1 - s.w, s.x + dx));
      ny = Math.max(0, Math.min(1 - s.h, s.y + dy));
    } else if (c === 'tl') {
      nx = Math.max(0, Math.min(s.x + s.w - MIN, s.x + dx));
      ny = Math.max(0, Math.min(s.y + s.h - MIN, s.y + dy));
      nw = s.x + s.w - nx; nh = s.y + s.h - ny;
    } else if (c === 'tr') {
      ny = Math.max(0, Math.min(s.y + s.h - MIN, s.y + dy));
      nh = s.y + s.h - ny;
      nw = Math.max(MIN, Math.min(1 - s.x, s.w + dx));
    } else if (c === 'bl') {
      nx = Math.max(0, Math.min(s.x + s.w - MIN, s.x + dx));
      nw = s.x + s.w - nx;
      nh = Math.max(MIN, Math.min(1 - s.y, s.h + dy));
    } else if (c === 'br') {
      nw = Math.max(MIN, Math.min(1 - s.x, s.w + dx));
      nh = Math.max(MIN, Math.min(1 - s.y, s.h + dy));
    }
    cutBox = { x: nx, y: ny, w: nw, h: nh };
    redraw();
    return;
  }

  if (gestureTarget === 'fx' && fxActive) {
    if (touches.size === 2 && gesture && gesture.type === 'fx') {
      const arr = Array.from(touches.values());
      const scale = touchDist(arr[0], arr[1]) / gesture.startDist;
      const rotDelta = touchAngle(arr[0], arr[1]) - gesture.startAngle;
      fxScale = Math.max(0.2, Math.min(5, gesture.startScale * scale));
      fxRotation = gesture.startRot + rotDelta;
      redraw(); return;
    }
    if (isDraggingFx && fxDragStart) {
      const pos = getCanvasCoordinates(e, e.touches ? e.touches[0] : null);
      fxX = fxDragStart.fxX + (pos.x - fxDragStart.x) / canvas.width;
      fxY = fxDragStart.fxY + (pos.y - fxDragStart.y) / canvas.height;
      redraw(); return;
    }
    return;
  }
  if (gestureTarget === 'overlay' && overlayImg) {
    if (touches.size === 2 && gesture && gesture.type === 'overlay') {
      const arr = Array.from(touches.values());
      const scale = touchDist(arr[0], arr[1]) / gesture.startDist;
      const rotDelta = touchAngle(arr[0], arr[1]) - gesture.startAngle;
      overlayScale = Math.max(0.1, Math.min(5, gesture.startScale * scale));
      overlayRotation = gesture.startRot + rotDelta;
      redraw(); return;
    }
    if (isDraggingOverlay && overlayDragStart) {
      const pos = getCanvasCoordinates(e, e.touches ? e.touches[0] : null);
      overlayX = overlayDragStart.ox + (pos.x - overlayDragStart.x) / canvas.width;
      overlayY = overlayDragStart.oy + (pos.y - overlayDragStart.y) / canvas.height;
      redraw(); return;
    }
    return;
  }
  if (gestureTarget === 'bg' && imgLoaded && currentBgImage) {
    if (touches.size === 2 && gesture && gesture.type === 'bg') {
      const arr = Array.from(touches.values());
      const scale = touchDist(arr[0], arr[1]) / gesture.startDist;
      currentBgImageZoom = Math.max(50, Math.min(300, Math.round(gesture.startZoom * scale)));
      const zIn = document.getElementById('bgImgZoomInput'); if (zIn) zIn.value = currentBgImageZoom;
      const zV = document.getElementById('bgImgZoomVal'); if (zV) zV.innerText = currentBgImageZoom;
      redraw(); return;
    }
    if (isDraggingBg && bgDragStart) {
      const pos = getCanvasCoordinates(e, e.touches ? e.touches[0] : null);
      const dx = (pos.x - bgDragStart.x) / canvas.width * 200;
      const dy = (pos.y - bgDragStart.y) / canvas.height * 200;
      currentBgImageX = Math.max(-100, Math.min(100, Math.round(bgDragStart.bgX + dx)));
      currentBgImageY = Math.max(-100, Math.min(100, Math.round(bgDragStart.bgY + dy)));
      const xIn = document.getElementById('bgImgXInput'); if (xIn) xIn.value = currentBgImageX;
      const xV = document.getElementById('bgImgXVal'); if (xV) xV.innerText = currentBgImageX;
      const yIn = document.getElementById('bgImgYInput'); if (yIn) yIn.value = currentBgImageY;
      const yV = document.getElementById('bgImgYVal'); if (yV) yV.innerText = currentBgImageY;
      redraw(); return;
    }
    return;
  }
  if (gestureTarget === 'subject' && imgLoaded) {
    if (touches.size === 2 && gesture && gesture.type === 'subject') {
      const arr = Array.from(touches.values());
      const scale = touchDist(arr[0], arr[1]) / gesture.startDist;
      subjectScale = Math.max(0.2, Math.min(5, gesture.startScale * scale));
      redraw(); return;
    }
    if (isDraggingSubject && subjectDragStart) {
      const pos = getCanvasCoordinates(e, e.touches ? e.touches[0] : null);
      subjectX = subjectDragStart.sx + (pos.x - subjectDragStart.x) / canvas.width;
      subjectY = subjectDragStart.sy + (pos.y - subjectDragStart.y) / canvas.height;
      redraw(); return;
    }
    return;
  }
  if (touches.size === 2 && gesture) {
    const arr = Array.from(touches.values());
    const scale = touchDist(arr[0], arr[1]) / gesture.startDist;
    const rotDelta = touchAngle(arr[0], arr[1]) - gesture.startAngle;
    if (gesture.type === 'text') {
      const l = textLayers.find(x => x.id === gesture.id);
      if (l) {
        l.size = Math.max(8, Math.min(400, Math.round(gesture.startSize * scale)));
        l.rotation = gesture.startRot + rotDelta;
      }
    } else if (gesture.type === 'handle') {
      const l = textLayers.find(x => x.id === gesture.id);
      if (l) {
        if (gesture.handle === 'rot') {
          const angle = Math.atan2(pos.y - gesture.centerY, pos.x - gesture.centerX);
          l.rotation = gesture.startRot + (angle - gesture.startAngle);
        } else {
          const dist = Math.hypot(pos.x - gesture.centerX, pos.y - gesture.centerY);
          const startDist = Math.hypot(gesture.startX - gesture.centerX, gesture.startY - gesture.centerY);
          const ratio = dist / Math.max(startDist, 1);
          l.size = Math.max(8, Math.min(400, Math.round(gesture.startSize * ratio)));
          syncActiveInputs();
        }
      }
    }
    redraw(); return;
  }
  const pos = getCanvasCoordinates(e, e.touches ? e.touches[0] : null);
  if (isDraggingText) {
    const l = textLayers.find(x => x.id === activeLayerId);
    if (l) { l.x = pos.x - dragOffsetX; l.y = pos.y - dragOffsetY; showFloatingMenu(l.x, l.y); redraw(); }
  }
}

function endTouch(e) {
  if (e && e.changedTouches) { for (const t of e.changedTouches) touches.delete(t.identifier); }
  else { touches.delete('mouse'); }
  if (gesture && gesture.type === 'handle') { gesture = null; saveState(); }
  if (isDraggingCutBox) { isDraggingCutBox = false; cutBoxDragStart = null; }
  if (touches.size < 2) gesture = null;
  if (isDraggingText) { isDraggingText = false; saveState(); syncActiveInputs(); }
  if (isDraggingFx) { isDraggingFx = false; fxDragStart = null; saveState(); }
  if (isDraggingSubject) { isDraggingSubject = false; subjectDragStart = null; saveState(); }
  if (isDraggingBg) { isDraggingBg = false; bgDragStart = null; saveState(); }
  if (isDraggingOverlay) { isDraggingOverlay = false; overlayDragStart = null; saveState(); }
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

function copyActiveText() {
  const l = textLayers.find(x => x.id === activeLayerId);
  if (!l) return;
  const newLayer = JSON.parse(JSON.stringify(l));
  newLayer.id = Date.now();
  newLayer.x = l.x + 20; newLayer.y = l.y + 20;
  textLayers.push(newLayer);
  activeLayerId = newLayer.id;
  showFloatingMenu(newLayer.x, newLayer.y);
  updateTextLayersUI();
  redraw(); saveState();
}
function stretchActiveText() {
  const l = textLayers.find(x => x.id === activeLayerId);
  if (!l) return;
  l.size = Math.min(400, Math.round(l.size * 1.15));
  redraw(); saveState();
  syncActiveInputs();
}
function hitHandle(pos, layer) {
  if (!layer) return null;
  const handles = getSelectionHandles(layer);
  for (const h of handles) {
    if (Math.hypot(pos.x - h.x, pos.y - h.y) < 26) return h.id;
  }
  return null;
}
function getSelectionHandles(layer) {
  ctx.font = `bold ${layer.size}px '${layer.font}', sans-serif`;
  const m = ctx.measureText(layer.text);
  const bw = m.width + 16, bh = layer.size + 8;
  const rot = layer.rotation || 0;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const corners = [
    { id: 'tl', dx: -bw/2, dy: -bh/2 },
    { id: 'tr', dx:  bw/2, dy: -bh/2 },
    { id: 'bl', dx: -bw/2, dy:  bh/2 },
    { id: 'br', dx:  bw/2, dy:  bh/2 },
    { id: 'rot', dx: 0, dy: -bh/2 - 38 }
  ];
  return corners.map(c => ({
    id: c.id,
    x: layer.x + c.dx * cos - c.dy * sin,
    y: layer.y + c.dx * sin + c.dy * cos
  }));
}

let textCardMode = 'add';
let textCardLayerId = null;
function openTextCard(mode, layerId) {
  textCardMode = mode || 'add';
  textCardLayerId = layerId || null;
  const modal = document.getElementById('textCardModal');
  const title = document.getElementById('textCardTitle');
  const inp = document.getElementById('textCardInput');
  if (textCardMode === 'edit' && textCardLayerId) {
    const l = textLayers.find(x => x.id === textCardLayerId);
    title.textContent = 'Edit Text';
    inp.value = l ? (l.text || '') : '';
  } else { title.textContent = 'Add Text'; inp.value = ''; }
  modal.classList.add('active');
  setTimeout(() => { inp.focus(); inp.select(); }, 100);
}
function closeTextCard() {
  const m = document.getElementById('textCardModal');
  if (m) m.classList.remove('active');
  textCardLayerId = null;
}
function confirmTextCard() {
  const val = (document.getElementById('textCardInput').value || '').trim();
  if (!val) { closeTextCard(); return; }
  if (textCardMode === 'edit' && textCardLayerId) {
    const l = textLayers.find(x => x.id === textCardLayerId);
    if (l) l.text = val;
  } else {
    const id = Date.now();
    const newLayer = { id, text: val, x: canvas.width/2, y: canvas.height/2, font:"Impact", size: Math.round(canvas.width*0.1), color:"#ffffff", style:"normal", rotation:0, stretchX:1, stretchY:1 };
    textLayers.push(newLayer);
    activeLayerId = id;
    showFloatingMenu(newLayer.x, newLayer.y);
  }
  closeTextCard();
  syncActiveInputs(); updateTextLayersUI(); buildFontGrid(); redraw(); saveState();
}
function deleteActiveTextLayer() {
  if (textLayers.length === 0) { textMenu.style.display = 'none'; return; }
  textLayers = textLayers.filter(x => x.id !== activeLayerId);
  activeLayerId = textLayers.length ? textLayers[0].id : null;
  textMenu.style.display = 'none';
  syncActiveInputs(); updateTextLayersUI(); redraw(); saveState();
}
function editActiveText() {
  if (activeLayerId === null) return;
  const l = textLayers.find(x => x.id === activeLayerId);
  if (!l) return;
  openTextCard('edit', activeLayerId);
}
function selectLayer(id) {
  activeLayerId = id;
  syncActiveInputs(); updateTextLayersUI(); buildFontGrid();
  const l = textLayers.find(x => x.id === id);
  if (l) showFloatingMenu(l.x, l.y);
  redraw();
}
function updateTextLayersUI() {
  const el = document.getElementById('textLayersList');
  if (!el) return;
  el.style.display = 'none';
  el.innerHTML = '';
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
  const e = document.getElementById('brVal'); if (e) e.innerText = v;
  const l = textLayers.find(x => x.id === activeLayerId);
  if (!l) return;
  const hsl = hexToHsl(l.color || '#ffffff');
  l.color = hslToHex(hsl.h, hsl.s, v);
  updateColorPreview(); redraw(); saveState();
}
function setActiveTextHue(v) {
  v = parseInt(v);
  const e = document.getElementById('hueVal'); if (e) e.innerText = v + '°';
  const l = textLayers.find(x => x.id === activeLayerId);
  if (!l) return;
  const hsl = hexToHsl(l.color || '#ffffff');
  l.color = hslToHex(v, Math.max(hsl.s, 70), hsl.l);
  updateColorPreview(); redraw(); saveState();
}
function updateColorPreview() {
  const l = textLayers.find(x => x.id === activeLayerId);
  const prev = document.getElementById('colorPreview');
  if (prev && l) prev.style.background = l.color;
}
function syncActiveInputs() {
  const l = textLayers.find(x => x.id === activeLayerId);
  if (!l) {
    if (sizeInput) sizeInput.value = 36;
    const fs = document.getElementById('fSizeVal'); if (fs) fs.innerText = '36';
    const fr = document.getElementById('fontRotation'); if (fr) fr.value = 0;
    const frv = document.getElementById('fRotVal'); if (frv) frv.innerText = '0°';
    const tp = document.getElementById('textPersp'); if (tp) tp.value = 0;
    const pv = document.getElementById('perspVal'); if (pv) pv.innerText = '0';
    return;
  }
  if (sizeInput) sizeInput.value = l.size;
  const fs = document.getElementById('fSizeVal'); if (fs) fs.innerText = l.size;
  const cb = document.getElementById('colorBrightness');
  if (cb) {
    const hsl = hexToHsl(l.color || '#ffffff');
    cb.value = hsl.l; document.getElementById('brVal').innerText = hsl.l;
    document.getElementById('colorHue').value = hsl.h; document.getElementById('hueVal').innerText = hsl.h + '°';
    updateColorPreview();
  }
  const fr = document.getElementById('fontRotation');
  if (fr) { const deg = Math.round((l.rotation || 0) * 180 / Math.PI); fr.value = deg; document.getElementById('fRotVal').innerText = deg + '°'; }
  const tp = document.getElementById('textPersp');
  if (tp) { tp.value = l.persp || 0; document.getElementById('perspVal').innerText = (l.persp || 0); }
}
function updateActiveTextContent(v) {
  let l = textLayers.find(x => x.id === activeLayerId);
  if (!l) {
    if (!v) return;
    const id = Date.now();
    l = { id, text:v, x:canvas.width/2, y:canvas.height/2, font:"Impact", size:Math.round(canvas.width*0.1), color:"#ffffff", style:"normal", rotation:0 };
    textLayers.push(l); activeLayerId = id; showFloatingMenu(l.x, l.y);
    buildFontGrid();
  } else { l.text = v; }
  updateTextLayersUI(); redraw(); saveState();
}
function setActiveFontSize(v) {
  const l = textLayers.find(x => x.id === activeLayerId);
  if (!l) { const fs = document.getElementById('fSizeVal'); if (fs) fs.innerText = v; return; }
  l.size = parseInt(v);
  const fs = document.getElementById('fSizeVal'); if (fs) fs.innerText = v;
  redraw(); saveState();
}
function setActiveTextPersp(v) {
  const l = textLayers.find(x => x.id === activeLayerId);
  const pv = document.getElementById('perspVal');
  if (pv) pv.innerText = v;
  if (!l) return;
  l.persp = parseInt(v);
  redraw(); saveState();
}
function setActiveFontRotation(v) {
  const frv = document.getElementById('fRotVal'); if (frv) frv.innerText = v + '°';
  const l = textLayers.find(x => x.id === activeLayerId);
  if (!l) return;
  l.rotation = parseInt(v) * Math.PI / 180;
  redraw(); saveState();
}
function setActiveFont(f, el) { const l = textLayers.find(x => x.id === activeLayerId); updateSelection(el); if (!l) return; l.font = f; redraw(); saveState(); }
function setActiveTextColor(c, el) { const l = textLayers.find(x => x.id === activeLayerId); updateSelection(el); if (!l) return; l.color = c; syncActiveInputs(); redraw(); saveState(); }
function setActiveTextStyle(s, el) { const l = textLayers.find(x => x.id === activeLayerId); updateSelection(el); if (!l) return; l.style = s; redraw(); saveState(); }
function updateSelection(el) {
  el.parentElement.querySelectorAll('.h-card, .font-pill, .color-circle').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

function switchPanel(name, btn) {
  if (name === 'fx') gestureTarget = 'fx';
  else if (name === 'bgremover') gestureTarget = 'subject';
  else if (name === 'bgimage') gestureTarget = bgDragMode;
  else if (name === 'clean') gestureTarget = 'overlay';
  else gestureTarget = 'text';
  if (name === 'crop') {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    openCropMode(); return;
  }
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');
  if (!btn) btn = document.querySelector('.nav-btn[data-panel="' + name + '"]');
  if (btn) btn.classList.add('active');
  if (name === 'filters') buildFilterThumbs();
  if (name === 'border') buildBorders();
  if (name === 'adjust') { buildTemplates(); buildPresetThumbs(); }
  if (name === 'color') buildBgColors();
  if (name === 'bgimage') buildBgImageGrid();
  if (name === 'fx') { buildFxTabs(); buildFxGrids(); }
  syncActiveInputs();
}
function switchSubTab(name, el) {
  const panel = el.closest('.panel');
  panel.querySelectorAll('.sub-view').forEach(v => v.classList.remove('active'));
  panel.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
  const sv = panel.querySelector('#subtab-' + name);
  if (sv) sv.classList.add('active');
  el.classList.add('active');
  if (name === 'basic' || name === 'layers') syncActiveInputs();
  if (name === 'font') buildFontGrid();
}
function setSubjectMode(mode, el) { subjectMode = mode; updateSelection(el); redraw(); saveState(); }

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

function drawSelectionBox(bx, by, bw, bh) {
  ctx.strokeStyle = 'rgba(255,255,255,.95)';
  ctx.lineWidth = 3;
  ctx.setLineDash([]);
  ctx.strokeRect(bx, by, bw, bh);
  const r = 9;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(bx+bw, by, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(bx, by+bh, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(bx+bw, by+bh, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(bx + bw/2, by); ctx.lineTo(bx + bw/2, by - 32); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(bx + bw/2, by - 38, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
}

function drawBorder() {
  if (!imgLoaded || currentBorder === 'none') return;
  const w = canvas.width, h = canvas.height;
  const base = Math.min(w, h);
  const col = currentBorderColor;
  const pct = currentBorderSize / 100;
  if (currentBorder === 'white') { const t = Math.round(base * pct); ctx.fillStyle = col; ctx.fillRect(0,0,w,t); ctx.fillRect(0,h-t,w,t); ctx.fillRect(0,0,t,h); ctx.fillRect(w-t,0,t,h); }
  else if (currentBorder === 'black') { const t = Math.round(base * pct * 1.6); ctx.fillStyle = col; ctx.fillRect(0,0,w,t); ctx.fillRect(0,h-t,w,t); ctx.fillRect(0,0,t,h); ctx.fillRect(w-t,0,t,h); }
  else if (currentBorder === 'rounded') { const t = Math.round(base * pct); const r = Math.round(base * pct * 1.6); ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.rect(0,0,w,h); ctx.moveTo(t+r, t); ctx.lineTo(w-t-r, t); ctx.quadraticCurveTo(w-t, t, w-t, t+r); ctx.lineTo(w-t, h-t-r); ctx.quadraticCurveTo(w-t, h-t, w-t-r, h-t); ctx.lineTo(t+r, h-t); ctx.quadraticCurveTo(t, h-t, t, h-t-r); ctx.lineTo(t, t+r); ctx.quadraticCurveTo(t, t, t+r, t); ctx.closePath(); ctx.fill('evenodd'); ctx.restore(); }
  else if (currentBorder === 'polaroid') { const side = Math.round(base * pct); const bottom = Math.round(base * pct * 3.4); ctx.fillStyle = col; ctx.fillRect(0,0,w,side); ctx.fillRect(0,0,side,h); ctx.fillRect(w-side,0,side,h); ctx.fillRect(0,h-bottom,w,bottom); }
  else if (currentBorder === 'shadow') { const grad = ctx.createRadialGradient(w/2, h/2, base*0.25, w/2, h/2, Math.max(w,h)*0.75); grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, `rgba(0,0,0,${0.4 + pct * 3})`); ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h); }
}

function drawCover(x, y, w, h, im) {
  const sr = im.naturalWidth / im.naturalHeight;
  const dr = w / h;
  let sx = 0, sy = 0, sw = im.naturalWidth, sh = im.naturalHeight;
  if (sr > dr) { sw = sh * dr; sx = (im.naturalWidth - sw) / 2; }
  else { sh = sw / dr; sy = (im.naturalHeight - sh) / 2; }
  ctx.drawImage(im, sx, sy, sw, sh, x, y, w, h);
}

function redraw() {
  if (!imgLoaded) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  let filterString = `brightness(${bInput.value}%) contrast(${cInput.value}%) saturate(${sInput.value}%) `;
  if (currentFilter !== 'none') filterString += currentFilter;
  const OVER = 6;
  const photoLayer = document.createElement('canvas');
  photoLayer.width = canvas.width; photoLayer.height = canvas.height;
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

  if (unshowOpacity < 100 || cornerRound > 0) {
    const mask = document.createElement('canvas');
    mask.width = canvas.width; mask.height = canvas.height;
    const mctx = mask.getContext('2d');
    const topPx = canvas.height * (cutTop / 100);
    const botPx = canvas.height * (cutBottom / 100);
    const leftPx = canvas.width * (cutLeft / 100);
    const rightPx = canvas.width * (cutRight / 100);
    const x = leftPx, y = topPx;
    const w = canvas.width - leftPx - rightPx;
    const h = canvas.height - topPx - botPx;
    const rr = Math.min(w, h) * (cornerRound / 100);
    mctx.fillStyle = '#fff';
    mctx.beginPath();
    if (rr > 0) {
      mctx.moveTo(x + rr, y); mctx.lineTo(x + w - rr, y);
      mctx.quadraticCurveTo(x + w, y, x + w, y + rr);
      mctx.lineTo(x + w, y + h - rr);
      mctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
      mctx.lineTo(x + rr, y + h);
      mctx.quadraticCurveTo(x, y + h, x, y + h - rr);
      mctx.lineTo(x, y + rr);
      mctx.quadraticCurveTo(x, y, x + rr, y);
      mctx.closePath();
    } else { mctx.rect(x, y, w, h); }
    mctx.fill();
    const masked = document.createElement('canvas');
    masked.width = canvas.width; masked.height = canvas.height;
    const mm = masked.getContext('2d');
    mm.drawImage(photoLayer, 0, 0);
    mm.globalCompositeOperation = 'destination-in';
    mm.drawImage(mask, 0, 0);
    plctx.clearRect(0, 0, photoLayer.width, photoLayer.height);
    plctx.globalAlpha = unshowOpacity / 100;
    plctx.drawImage(masked, 0, 0);
    plctx.globalAlpha = 1;
  }

  const hasBg = !!(currentBgColor || currentBgImage);
  if (currentBgImage) {
    const w = canvas.width, h = canvas.height;
    const zoom = currentBgImageZoom / 100;
    const offsetX = (currentBgImageX / 100) * w * 0.5;
    const offsetY = (currentBgImageY / 100) * h * 0.5;
    const scaledW = w * zoom;
    const scaledH = h * zoom;
    const dx = (w - scaledW) / 2 + offsetX;
    const dy = (h - scaledH) / 2 + offsetY;
    drawCover(dx, dy, scaledW, scaledH, currentBgImage);
  } else if (currentBgColor) {
    ctx.fillStyle = currentBgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (hasBg) {
    const pad = Math.round(Math.min(canvas.width, canvas.height) * (((currentBgImageSize || currentBgColorSize) || 0) / 100));
    const baseW = canvas.width - pad * 2;
    const baseH = canvas.height - pad * 2;
    const w2 = baseW * subjectScale;
    const h2 = baseH * subjectScale;
    const cx = canvas.width / 2 + (subjectX - 0.5) * canvas.width;
    const cy = canvas.height / 2 + (subjectY - 0.5) * canvas.height;
    ctx.globalAlpha = cutOpacity / 100;
    ctx.drawImage(photoLayer, cx - w2 / 2, cy - h2 / 2, w2, h2);
    ctx.globalAlpha = 1;
  } else {
    ctx.globalAlpha = cutOpacity / 100;
    ctx.drawImage(photoLayer, 0, 0);
    ctx.globalAlpha = 1;
  }
  const fade = parseInt(nInput.value);
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${(fade/100)*0.4})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  if (!currentBgColor && !currentBgImage) drawBorder();
  drawFxLayer();
  if (overlayImg) {
    ctx.save();
    const cw = canvas.width, ch = canvas.height;
    const imAspect = overlayImg.naturalWidth / overlayImg.naturalHeight;
    const baseW = cw * overlayScale;
    const baseH = baseW / imAspect;
    let displayW = baseW, displayH = baseH;
    if (overlayCropRatio !== 'free') {
      const p = overlayCropRatio.split(':');
      const targetAspect = parseFloat(p[0]) / parseFloat(p[1]);
      if (targetAspect > imAspect) { displayW = baseW; displayH = baseW / targetAspect; }
      else { displayH = baseH; displayW = baseH * targetAspect; }
    }
    const off = document.createElement('canvas');
    off.width = Math.max(1, Math.round(displayW));
    off.height = Math.max(1, Math.round(displayH));
    const octx = off.getContext('2d');
    if (overlayRound > 0) {
      const r = Math.min(off.width, off.height) * (overlayRound / 100);
      octx.beginPath();
      octx.moveTo(r, 0); octx.lineTo(off.width - r, 0);
      octx.quadraticCurveTo(off.width, 0, off.width, r);
      octx.lineTo(off.width, off.height - r);
      octx.quadraticCurveTo(off.width, off.height, off.width - r, off.height);
      octx.lineTo(r, off.height);
      octx.quadraticCurveTo(0, off.height, 0, off.height - r);
      octx.lineTo(0, r);
      octx.quadraticCurveTo(0, 0, r, 0);
      octx.closePath();
      octx.clip();
    }
    const sr = overlayImg.naturalWidth / overlayImg.naturalHeight;
    const dr = off.width / off.height;
    let sx = 0, sy = 0, sw = overlayImg.naturalWidth, sh = overlayImg.naturalHeight;
    if (sr > dr) { sw = sh * dr; sx = (overlayImg.naturalWidth - sw) / 2; }
    else { sh = sw / dr; sy = (overlayImg.naturalHeight - sh) / 2; }
    octx.drawImage(overlayImg, sx, sy, sw, sh, 0, 0, off.width, off.height);
    if (overlayTint && overlayTintAmount > 0) {
      octx.globalCompositeOperation = 'source-atop';
      octx.globalAlpha = overlayTintAmount / 100;
      octx.fillStyle = overlayTint;
      octx.fillRect(0, 0, off.width, off.height);
      octx.globalAlpha = 1;
      octx.globalCompositeOperation = 'source-over';
    }
    if (cutTop > 0 || cutBottom > 0 || cutLeft > 0 || cutRight > 0 || cutFeather > 0) {
      const mask = document.createElement('canvas');
      mask.width = off.width; mask.height = off.height;
      const mctx = mask.getContext('2d');
      const topPx = off.height * (cutTop / 100);
      const botPx = off.height * (cutBottom / 100);
      const leftPx = off.width * (cutLeft / 100);
      const rightPx = off.width * (cutRight / 100);
      mctx.fillStyle = '#fff';
      mctx.fillRect(leftPx, topPx, off.width - leftPx - rightPx, off.height - topPx - botPx);
      if (cutFeather > 0) {
        const blurred = document.createElement('canvas');
        blurred.width = mask.width; blurred.height = mask.height;
        const bctx = blurred.getContext('2d');
        bctx.filter = `blur(${cutFeather}px)`;
        bctx.drawImage(mask, 0, 0);
        mctx.clearRect(0, 0, mask.width, mask.height);
        mctx.drawImage(blurred, 0, 0);
      }
      octx.globalCompositeOperation = 'destination-in';
      octx.drawImage(mask, 0, 0);
      octx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = overlayOpacity / 100;
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(overlayX * cw, overlayY * ch);
    if (overlayRotation) ctx.rotate(overlayRotation);
    ctx.drawImage(off, -off.width / 2, -off.height / 2);
    ctx.restore();
  }
  textLayers.forEach(layer => {
    if (layer.text && layer.text.trim() !== '') {
      ctx.save();
      ctx.translate(layer.x, layer.y);
      if (layer.rotation) ctx.rotate(layer.rotation);
      ctx.font = `bold ${layer.size}px '${layer.font}', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (layer.style === 'stroke') { ctx.lineWidth = Math.max(2, layer.size * 0.08); ctx.strokeStyle = '#000'; ctx.strokeText(layer.text, 0, 0); }
      else if (layer.style === 'shadow') { ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 12; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 4; }
      else if (layer.style === 'glow') { ctx.shadowColor = layer.color; ctx.shadowBlur = 20; }
      ctx.fillStyle = layer.color;
      const _sx = layer.stretchX || 1;
      if (_sx !== 1) ctx.scale(_sx, 1);
      ctx.fillText(layer.text, 0, 0);
      if (_sx !== 1) ctx.scale(1/_sx, 1);
      if (activeLayerId === layer.id) {
        const m = ctx.measureText(layer.text);
        const bw = m.width + 16, bh = layer.size + 8;
        drawSelectionBox(-bw/2, -bh/2, bw, bh);
      }
      ctx.restore();
    }
  });
  drawCutBox();
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
      await importOnePhoto(file); done++;
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
        backgroundRemoved = false;
        textLayers = []; activeLayerId = null;
        currentProjectId = null; currentProjectName = '';
        currentFilter = 'none'; currentTemplate = 'none';
        currentBorder = 'none'; currentBorderColor = '#ffffff'; currentBorderSize = 5;
        currentBgColor = null; currentBgColorSize = 8;
        currentBgImage = null; currentBgImageSize = 8;
        currentBgImageZoom = 100; currentBgImageX = 0; currentBgImageY = 0;
        currentFx = 'none'; currentFxAmount = 70;
        fxX = 0.5; fxY = 0.5; fxScale = 1; fxRotation = 0;
        subjectMode = 'none'; subjectX = 0.5; subjectY = 0.5; subjectScale = 1;
        personMask = null; subjectReady = false;
        overlayImg = null; overlayOpacity = 0;
        overlayX = 0.5; overlayY = 0.5; overlayScale = 0.7; overlayRotation = 0;
        overlayTint = null; overlayTintAmount = 60;
        overlayCropRatio = 'free'; overlayRound = 0;
        cutTop = 0; cutBottom = 0; cutLeft = 0; cutRight = 0;
        cutFeather = 0; cornerRound = 0; unshowOpacity = 100;
        customBgImage = null;
        undoStack = []; redoStack = [];
        updateHistoryButtons();
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
            textLayers: [], brightness: 100, contrast: 100, saturation: 100, noise: 0,
            filter: 'none', border: 'none', borderColor: '#ffffff', borderSize: 5,
            bgColor: null, bgColorSize: 8, bgImageFile: null, bgImageSize: 8,
            bgImageZoom: 100, bgImageX: 0, bgImageY: 0,
            template: 'none', fx: 'none', fxAmount: 70,
            fxX: 0.5, fxY: 0.5, fxScale: 1, fxRotation: 0,
            subjectX: 0.5, subjectY: 0.5, subjectScale: 1, subjectMode: 'none',
            subjectAmount: 12
          }));
        } catch(e) { alert('Storage full.'); }
        resolve();
      };
      newImg.onerror = () => resolve();
      newImg.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function loadProject(key) {
  try {
    const p = JSON.parse(localStorage.getItem(key));
    if (!p) return;
    const newImg = new Image();
    newImg.onload = function() {
      img = newImg; imgLoaded = true;
      originalImageSrc = p.originalImage || p.image;
      window.__originalBeforeBgRemove = p.originalImage || p.image;
      canvas.width = p.canvasW || newImg.width;
      canvas.height = p.canvasH || newImg.height;
      currentProjectId = key.replace('music_', '');
      currentProjectName = p.name || 'Untitled';
      textLayers = (p.textLayers || []).map(l => ({
        id: l.id || Date.now() + Math.random(),
        text: l.text || '', x: l.x, y: l.y,
        size: l.size || 40, font: l.font || 'Impact',
        color: l.color || '#ffffff', style: l.style || 'normal',
        rotation: l.rotation || 0, persp: l.persp || 0,
        stretchX: l.stretchX || 1, stretchY: l.stretchY || 1
      }));
      activeLayerId = null;
      if (p.brightness !== undefined) bInput.value = p.brightness;
      if (p.contrast !== undefined) cInput.value = p.contrast;
      if (p.saturation !== undefined) sInput.value = p.saturation;
      if (p.noise !== undefined) nInput.value = p.noise;
      currentFilter = p.filter || 'none';
      currentBorder = p.border || 'none';
      currentBorderColor = p.borderColor || '#ffffff';
      currentBorderSize = p.borderSize || 5;
      currentBgColor = p.bgColor || null;
      currentBgColorSize = p.bgColorSize || 8;
      currentBgImageSize = p.bgImageSize || 8;
      currentBgImageZoom = p.bgImageZoom || 100;
      currentBgImageX = p.bgImageX || 0;
      currentBgImageY = p.bgImageY || 0;
      currentTemplate = p.template || 'none';
      currentFx = p.fx || 'none';
      currentFxAmount = p.fxAmount || 70;
      fxX = p.fxX !== undefined ? p.fxX : 0.5;
      fxY = p.fxY !== undefined ? p.fxY : 0.5;
      fxScale = p.fxScale || 1;
      fxRotation = p.fxRotation || 0;
      subjectX = p.subjectX !== undefined ? p.subjectX : 0.5;
      subjectY = p.subjectY !== undefined ? p.subjectY : 0.5;
      subjectScale = p.subjectScale || 1;
      subjectMode = p.subjectMode || 'none';
      backgroundRemoved = !!p.backgroundRemoved;
      strokeColor = p.strokeColor || '#ffffff';
      if (p.bgImageFile && bgImages[p.bgImageFile]) currentBgImage = bgImages[p.bgImageFile];
      else if (p.customBgData) { const c = new Image(); c.onload = () => { currentBgImage = c; customBgImage = c; redraw(); }; c.src = p.customBgData; }
      else currentBgImage = null;
      personMask = null; subjectReady = false;
      buildFilterThumbs(); buildTemplates(); buildBorders(); buildBgColors(); buildBgImageGrid();
      redraw();
      undoStack = []; redoStack = []; updateHistoryButtons();
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      const sv = document.getElementById('view-studio');
      if (sv) sv.classList.add('active');
      switchPanel('adjust', document.querySelector('.nav-btn[data-panel="adjust"]'));
    };
    newImg.src = p.originalImage || p.image;
  } catch(e) { alert('Failed to load project.'); }
}

function goHome() {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const hv = document.getElementById('view-home');
  if (hv) hv.classList.add('active');
  renderProjectsList();
}

function saveProjectToHome() {
  if (!imgLoaded) return;
  if (!currentProjectId) currentProjectId = 'proj_' + Date.now();
  const serializedLayers = textLayers.map(l => ({ id:l.id, text:l.text, x:l.x, y:l.y, size:l.size, font:l.font, color:l.color, style:l.style, rotation:l.rotation, persp: l.persp || 0, stretchX: l.stretchX || 1, stretchY: l.stretchY || 1 }));
  let bgFile = null;
  if (currentBgImage) { for (const f of BG_CONFIG.files) if (bgImages[f.fname] === currentBgImage) { bgFile = f.fname; break; } }
  const now = new Date();
  let autoName = currentProjectName;
  if (!autoName || autoName.startsWith('Cover ')) {
    const firstText = textLayers.find(l => l.text && l.text.trim());
    autoName = firstText ? firstText.text.trim().slice(0, 24) : (currentProjectName || 'Cover');
  }
  try {
    localStorage.setItem('music_' + currentProjectId, JSON.stringify({
      name: autoName, date: now.toISOString(), savedAt: now.getTime(),
      image: originalImageSrc, originalImage: originalImageSrc,
      backgroundRemoved: backgroundRemoved,
      preBgRemoveImage: window.__originalBeforeBgRemove || null,
      canvasW: canvas.width, canvasH: canvas.height,
      textLayers: serializedLayers,
      brightness: bInput.value, contrast: cInput.value, saturation: sInput.value, noise: nInput.value,
      filter: currentFilter, border: currentBorder, borderColor: currentBorderColor, borderSize: currentBorderSize,
      bgColor: currentBgColor, bgColorSize: currentBgColorSize,
      bgImageFile: bgFile, bgImageSize: currentBgImageSize,
      customBgData: (currentBgImage && customBgImage && currentBgImage === customBgImage) ? customBgImage.src : null,
      bgImageZoom: currentBgImageZoom, bgImageX: currentBgImageX, bgImageY: currentBgImageY,
      template: currentTemplate, fx: currentFx, fxAmount: currentFxAmount,
      fxX, fxY, fxScale, fxRotation,
      subjectX, subjectY, subjectScale, subjectMode, strokeColor,
      subjectAmount: subjAmt.value
    }));
  } catch(e) { alert('Storage full.'); return; }
  undoStack = []; redoStack = []; updateHistoryButtons();
  showToast('Saved');
  playCount(() => { goHome(); });
}

function saveImage() {
  if (!imgLoaded) return;
  const projName = (currentProjectName || 'Mx-Studio').trim().replace(/[^a-z0-9\-_ ]/gi, '_').replace(/\s+/g, '-').slice(0, 24);
  const d = new Date();
  const stamp = d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0') + '-' + String(d.getHours()).padStart(2,'0') + String(d.getMinutes()).padStart(2,'0') + String(d.getSeconds()).padStart(2,'0');
  const filename = projName + '-' + stamp + '.png';
  canvas.toBlob(async function(blob) {
    if (!blob) { showToast('Save failed'); return; }
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); showToast('Saved'); return; }
      catch(err) { if (err && err.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
    showToast('Saved');
  }, 'image/png');
}

function resetEverything() {
  if (!imgLoaded) { showToast('Nothing to reset'); return; }
  if (!confirm('Reset all edits?')) return;
  if (window.__originalBeforeBgRemove) {
    const im = new Image();
    im.onload = function() { img = im; originalImageSrc = window.__originalBeforeBgRemove; canvas.width = im.width; canvas.height = im.height; backgroundRemoved = false; redraw(); };
    im.src = window.__originalBeforeBgRemove;
  }
  textLayers = []; activeLayerId = null;
  currentFilter = 'none'; currentBorder = 'none'; currentBorderColor = '#ffffff'; currentBorderSize = 5;
  currentTemplate = 'none'; currentBgColor = null; currentBgImage = null;
  currentFx = 'none'; currentFxAmount = 70;
  subjectMode = 'none'; personMask = null; subjectReady = false;
  overlayImg = null; overlayOpacity = 0;
  cutTop = 0; cutBottom = 0; cutLeft = 0; cutRight = 0; cutFeather = 0; cornerRound = 0;
  unshowOpacity = 100;
  undoStack = []; redoStack = [];
  redraw(); updateHistoryButtons();
  showToast('Reset');
}

// ---- Crop screen functions ----
let cropModeActive = false;
let cropPrevPanel = 'adjust';
let cropFrameDrag = null;

function openCropMode() {
  if (!imgLoaded) { alert('Load a photo first'); return; }
  const cur = document.querySelector('.panel.active');
  if (cur) cropPrevPanel = cur.id.replace('panel-','');
  cropModeActive = true;
  const cc = document.getElementById('cropCanvas');
  cc.width = canvas.width; cc.height = canvas.height;
  const cx = cc.getContext('2d');
  cx.clearRect(0, 0, cc.width, cc.height);
  cx.drawImage(img, 0, 0, cc.width, cc.height);
  crop = { x:0.05, y:0.05, w:0.9, h:0.9 };
  document.getElementById('cropScreen').classList.add('active');
  initCropFrameDrag();
  requestAnimationFrame(() => { updateCropFrameUI(); });
}
function closeCropMode() { cropModeActive = false; document.getElementById('cropScreen').classList.remove('active'); }
function cancelCropMode() { closeCropMode(); switchPanel(cropPrevPanel, document.querySelector('.nav-btn[data-panel="' + cropPrevPanel + '"]')); }
function applyCropMode() {
  if (!imgLoaded) return;
  if (preCropImageSrc === null) { preCropImageSrc = canvas.toDataURL('image/png'); preCropCanvasW = canvas.width; preCropCanvasH = canvas.height; }
  const cc = document.getElementById('cropCanvas');
  const px = Math.round(crop.x * cc.width);
  const py = Math.round(crop.y * cc.height);
  const pw = Math.max(8, Math.round(crop.w * cc.width));
  const ph = Math.max(8, Math.round(crop.h * cc.height));
  const tmp = document.createElement('canvas');
  tmp.width = pw; tmp.height = ph;
  tmp.getContext('2d').drawImage(cc, px, py, pw, ph, 0, 0, pw, ph);
  const url = tmp.toDataURL('image/png');
  const newImg = new Image();
  newImg.onload = function() {
    img = newImg; originalImageSrc = url;
    canvas.width = pw; canvas.height = ph;
    personMask = null; subjectReady = false;
    buildFilterThumbs(); buildTemplates();
    redraw(); saveState();
    closeCropMode();
    switchPanel('adjust', document.querySelector('.nav-btn[data-panel="adjust"]'));
  };
  newImg.src = url;
}
function restorePreCrop() {
  if (!preCropImageSrc) { alert('Nothing to restore — no crop applied yet'); return; }
  const newImg = new Image();
  newImg.onload = function() {
    img = newImg; originalImageSrc = preCropImageSrc;
    canvas.width = preCropCanvasW; canvas.height = preCropCanvasH;
    preCropImageSrc = null; preCropCanvasW = 0; preCropCanvasH = 0;
    personMask = null; subjectReady = false;
    buildFilterThumbs(); buildTemplates();
    redraw(); saveState();
    closeCropMode();
    switchPanel('adjust', document.querySelector('.nav-btn[data-panel="adjust"]'));
  };
  newImg.src = preCropImageSrc;
}
function updateCropFrameUI() {
  const cc = document.getElementById('cropCanvas');
  const frame = document.getElementById('cropFrame');
  if (!cc || !frame) return;
  const r = cc.getBoundingClientRect();
  const wr = cc.parentElement.getBoundingClientRect();
  const ox = r.left - wr.left; const oy = r.top - wr.top;
  frame.style.left = (ox + r.width * crop.x) + 'px';
  frame.style.top = (oy + r.height * crop.y) + 'px';
  frame.style.width = (r.width * crop.w) + 'px';
  frame.style.height = (r.height * crop.h) + 'px';
}
function initCropFrameDrag() {
  const frame = document.getElementById('cropFrame');
  if (!frame || frame.dataset.bound) return;
  frame.dataset.bound = '1';
  frame.addEventListener('pointerdown', e => {
    if (!cropModeActive) return;
    e.preventDefault(); e.stopPropagation();
    const corner = (e.target.dataset && e.target.dataset.c) ? e.target.dataset.c : null;
    const cc = document.getElementById('cropCanvas');
    const r = cc.getBoundingClientRect();
    cropFrameDrag = { type: corner || 'move', sx: e.clientX, sy: e.clientY, start: { ...crop }, cw: r.width, ch: r.height };
  });
  window.addEventListener('pointermove', e => {
    if (!cropFrameDrag) return;
    e.preventDefault();
    const dx = (e.clientX - cropFrameDrag.sx) / cropFrameDrag.cw;
    const dy = (e.clientY - cropFrameDrag.sy) / cropFrameDrag.ch;
    const s = cropFrameDrag.start; const MIN = 0.12;
    let { x, y, w, h } = s;
    const t = cropFrameDrag.type;
    if (t === 'move') { x = Math.max(0, Math.min(1-s.w, s.x+dx)); y = Math.max(0, Math.min(1-s.h, s.y+dy)); }
    else if (t === 'tl') { const nx = Math.max(0, Math.min(s.x+s.w-MIN, s.x+dx)); const ny = Math.max(0, Math.min(s.y+s.h-MIN, s.y+dy)); x=nx; y=ny; w=s.x+s.w-nx; h=s.y+s.h-ny; }
    else if (t === 'tr') { const ny = Math.max(0, Math.min(s.y+s.h-MIN, s.y+dy)); y=ny; h=s.y+s.h-ny; w=Math.max(MIN, Math.min(1-s.x, s.w+dx)); }
    else if (t === 'bl') { const nx = Math.max(0, Math.min(s.x+s.w-MIN, s.x+dx)); x=nx; w=s.x+s.w-nx; h=Math.max(MIN, Math.min(1-s.y, s.h+dy)); }
    else if (t === 'br') { w=Math.max(MIN, Math.min(1-s.x, s.w+dx)); h=Math.max(MIN, Math.min(1-s.y, s.h+dy)); }
    crop = { x, y, w, h };
    updateCropFrameUI();
  });
  window.addEventListener('pointerup', () => { cropFrameDrag = null; });
  window.addEventListener('pointercancel', () => { cropFrameDrag = null; });
  window.addEventListener('resize', () => { if (cropModeActive) updateCropFrameUI(); });
}
function setCropRatio(ratio, el) {
  document.querySelectorAll('.crop-ratio-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  if (ratio === 'free') return;
  if (ratio === 'original') { crop = { x:0, y:0, w:1, h:1 }; updateCropFrameUI(); return; }
  const cc = document.getElementById('cropCanvas');
  const ca = cc.width / cc.height;
  let tr;
  if (ratio === '1:1') tr = 1;
  else if (ratio === '4:5') tr = 4/5;
  else if (ratio === '9:16') tr = 9/16;
  else if (ratio === '4:3') tr = 4/3;
  else if (ratio === '3:4') tr = 3/4;
  if (!tr) return;
  const cr = tr / ca;
  let w, h;
  if (cr >= 1) { w = 1; h = 1/cr; } else { h = 1; w = cr; }
  crop = { x:(1-w)/2, y:(1-h)/2, w, h };
  updateCropFrameUI();
}
function cropRotate(deg) {
  const cc = document.getElementById('cropCanvas');
  const c = document.createElement('canvas');
  c.width = cc.height; c.height = cc.width;
  const cx = c.getContext('2d');
  cx.translate(c.width/2, c.height/2);
  cx.rotate(deg * Math.PI / 180);
  cx.drawImage(cc, -cc.width/2, -cc.height/2);
  cc.width = c.width; cc.height = c.height;
  const ccx = cc.getContext('2d');
  ccx.clearRect(0, 0, cc.width, cc.height);
  ccx.drawImage(c, 0, 0);
  crop = { x:0.05, y:0.05, w:0.9, h:0.9 };
  updateCropFrameUI();
}
function cropFlip(dir) {
  const cc = document.getElementById('cropCanvas');
  const c = document.createElement('canvas');
  c.width = cc.width; c.height = cc.height;
  const cx = c.getContext('2d');
  cx.translate(dir === 'h' ? cc.width : 0, dir === 'v' ? cc.height : 0);
  cx.scale(dir === 'h' ? -1 : 1, dir === 'v' ? -1 : 1);
  cx.drawImage(cc, 0, 0);
  const ccx = cc.getContext('2d');
  ccx.clearRect(0, 0, cc.width, cc.height);
  ccx.drawImage(c, 0, 0);
  updateCropFrameUI();
}
function resetCropAngle() {
  const a = document.getElementById('cropAngleInput');
  if (a) a.value = 0;
}

// ---- Subject detection ----
window.detectSubject = async function() {
  const status = document.getElementById('bgRmvStatus') || document.getElementById('subjectStatus');
  const btn = document.getElementById('detectBtn');
  if (!imgLoaded) { status.textContent = 'Upload an image first.'; return; }
  if (typeof SelfieSegmentation === 'undefined') { status.textContent = 'Model failed to load — tap again in a moment.'; return; }
  btn.disabled = true; status.textContent = 'Loading model...';
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
    status.textContent = 'Detected! Pick Blur or Stroke below.';
    btn.textContent = 'Redo'; btn.disabled = false;
    redraw(); saveState();
  } catch(err) { status.textContent = 'Failed: ' + err.message; btn.disabled = false; }
};

// ---- BG RMV via Vercel API ----
window.removeBackgroundCompletely = async function() {
  const status = document.getElementById('bgRmvStatus');
  if (!imgLoaded) { if (status) status.textContent = 'Load a photo first.'; return; }
  if (status) status.textContent = 'Removing background...';
  try {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const r = await fetch('https://mx-studio-editor.vercel.app/api/remove-bg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl })
    });
    if (!r.ok) { if (status) status.textContent = 'Server error: ' + r.status; return; }
    const json = await r.json();
    if (!json.image) { if (status) status.textContent = 'No image in response.'; return; }
    if (status) status.textContent = 'Almost done...';
    const newImg = new Image();
    newImg.onload = function() {
      img = newImg;
      originalImageSrc = json.image;
      window.__originalBeforeBgRemove = json.image;
      subjectReady = false;
      personMask = null;
      backgroundRemoved = true;
      if (!currentBgColor && !currentBgImage) currentBgColor = '#000000';
      if (status) status.textContent = 'Background removed ✓ Pick color or image from BG tab.';
      buildBgColors();
      redraw(); saveState();
    };
    newImg.src = json.image;
  } catch (err) {
    if (status) status.textContent = 'Failed: ' + (err.message || 'unknown');
  }
};

// ---- Init ----
function setupHomeUploadBinding() {
  const inp = document.getElementById('homeImageUpload');
  if (inp && !inp.dataset.bound) { inp.dataset.bound = '1'; }
}

window.addEventListener('focus', function() { if (imgLoaded) redraw(); });
document.addEventListener('visibilitychange', function() {
  if (!document.hidden && imgLoaded) redraw();
});

window.addEventListener('load', () => {
  playCount(() => {});
  setTimeout(() => { try { if (typeof preloadEffects === 'function') preloadEffects(); } catch(e){} }, 0);
  setTimeout(() => {
    const s = document.getElementById('splashScreen');
    if (s) s.classList.add('fade-out');
  }, 400);
});

// Bind home file upload + initial render
window.addEventListener('DOMContentLoaded', () => {
  initHomeUpload();
  renderProjectsList();
  buildFontGrid();
  buildBgColors();
  if ('serviceWorker' in navigator) {
    // optional: register('./service-worker.js');
  }
});
/* =====================================================
   MESIN KALKULATOR (tanpa eval) – Recursive Descent Parser
   Urutan prioritas (rendah -> tinggi):
   1. + -            (kiri ke kanan)
   2. × ÷ mod        (kiri ke kanan)
   3. unary - +      (contoh: -5)
   4. ^              (kanan ke kiri: 2^3^2 = 2^9)
   5. !              (faktorial, postfix)
   6. angka, π, e, fungsi(...), ( ... )
   ===================================================== */

// ---------- 1. TOKENIZER: ubah teks menjadi potongan (token) ----------
function tokenize(src) {
  const s = src.replace(/\s+/g, '');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    let m;
    if ((m = rest.match(/^(\d+\.?\d*|\.\d+)/))) {          // angka
      out.push({ t: 'num', v: parseFloat(m[1]) });
      i += m[1].length;
      continue;
    }
    if ((m = rest.match(/^(sin|cos|tan|log|ln)/))) {        // fungsi
      out.push({ t: 'fn', v: m[1] });
      i += m[1].length;
      continue;
    }
    const c = s[i];
    if (c === '√') out.push({ t: 'fn', v: 'sqrt' });
    else if (c === 'π') out.push({ t: 'num', v: Math.PI });
    else if (c === 'e') out.push({ t: 'num', v: Math.E });
    else if ('+-−×÷*/^%'.includes(c)) {
      const map = { '−': '-', '×': '*', '÷': '/' };
      out.push({ t: 'op', v: map[c] || c });
    }
    else if (c === '(') out.push({ t: 'lp' });
    else if (c === ')') out.push({ t: 'rp' });
    else if (c === '!') out.push({ t: 'fact' });
    else throw new Error('Input tidak valid: "' + c + '"');
    i++;
  }
  return out;
}

// ---------- 2. FUNGSI MATEMATIKA + VALIDASI ----------
function factorial(n) {
  if (!Number.isInteger(n) || n < 0) throw new Error('Faktorial hanya untuk bilangan bulat ≥ 0');
  if (n > 170) throw new Error('Hasil faktorial terlalu besar');
  let r = 1;
  for (let k = 2; k <= n; k++) r *= k;
  return r;
}
const clean = v => (Math.abs(v) < 1e-14 ? 0 : v);   // buang sisa error floating point

function applyFn(name, x, deg) {
  switch (name) {
    case 'sin': return clean(Math.sin(deg ? x * Math.PI / 180 : x));
    case 'cos': return clean(Math.cos(deg ? x * Math.PI / 180 : x));
    case 'tan': {
      const rad = deg ? x * Math.PI / 180 : x;
      if (Math.abs(Math.cos(rad)) < 1e-14) throw new Error('tan tidak terdefinisi untuk sudut ini');
      return clean(Math.tan(rad));
    }
    case 'log':
      if (x <= 0) throw new Error('log hanya untuk bilangan > 0');
      return Math.log10(x);
    case 'ln':
      if (x <= 0) throw new Error('ln hanya untuk bilangan > 0');
      return Math.log(x);
    case 'sqrt':
      if (x < 0) throw new Error('Akar bilangan negatif tidak valid');
      return Math.sqrt(x);
  }
}

// ---------- 3. EVALUATOR (parser) ----------
function evaluate(src, deg = true) {
  const tk = tokenize(src);
  if (tk.length === 0) throw new Error('Ekspresi kosong');
  let p = 0;
  const peek = () => tk[p];
  const next = () => tk[p++];
  const isOp = (...vals) => peek() && peek().t === 'op' && vals.includes(peek().v);
  const startsOperand = t => t && (t.t === 'num' || t.t === 'fn' || t.t === 'lp');

  function parseExpr() {                       // + -
    let v = parseTerm();
    while (isOp('+', '-')) {
      const o = next().v;
      const r = parseTerm();
      v = o === '+' ? v + r : v - r;
    }
    return v;
  }

  function parseTerm() {                       // × ÷ mod (+ perkalian implisit: 2π, 2(3))
    let v = parseUnary();
    for (;;) {
      const t = peek();
      if (!t) break;
      if (t.t === 'op' && ['*', '/', '%'].includes(t.v)) {
        next();
        const r = parseUnary();
        if (t.v === '*') v *= r;
        else if (t.v === '/') {
          if (r === 0) throw new Error('Tidak bisa membagi dengan nol');
          v /= r;
        } else {
          if (r === 0) throw new Error('Modulo dengan nol tidak valid');
          v %= r;
        }
      } else if (startsOperand(t)) {
        v *= parseUnary();
      } else break;
    }
    return v;
  }

  function parseUnary() {                      // -x  +x
    if (isOp('-')) { next(); return -parseUnary(); }
    if (isOp('+')) { next(); return parseUnary(); }
    return parsePower();
  }

  function parsePower() {                      // ^ (kanan ke kiri)
    const base = parsePostfix();
    if (isOp('^')) {
      next();
      const ex = parseUnary();
      const r = Math.pow(base, ex);
      if (Number.isNaN(r)) throw new Error('Hasil pangkat tidak valid');
      return r;
    }
    return base;
  }

  function parsePostfix() {                    // n!
    let v = parsePrimary();
    while (peek() && peek().t === 'fact') { next(); v = factorial(v); }
    return v;
  }

  function closeParen() {
    if (peek() && peek().t === 'rp') next();
    else if (peek()) throw new Error('Kurung tidak seimbang');
    // jika sudah habis, kurung tutup otomatis
  }

  function parsePrimary() {
    const t = next();
    if (!t) throw new Error('Ekspresi belum lengkap');
    if (t.t === 'num') return t.v;
    if (t.t === 'lp') { const v = parseExpr(); closeParen(); return v; }
    if (t.t === 'fn') {
      let arg;
      if (peek() && peek().t === 'lp') { next(); arg = parseExpr(); closeParen(); }
      else arg = parsePostfix();               // contoh: √25
      return applyFn(t.v, arg, deg);
    }
    if (t.t === 'rp') throw new Error('Kurung tutup tidak sesuai');
    throw new Error('Ekspresi tidak valid');
  }

  const result = parseExpr();
  if (p < tk.length) throw new Error('Ekspresi tidak valid');
  if (!Number.isFinite(result)) throw new Error('Hasil tidak terdefinisi');
  return result;
}

// Pembulatan 12 digit signifikan supaya 0.1+0.2 = 0.3
function fmt(n) {
  return String(parseFloat(n.toPrecision(12)));
}

/* ===== UI ===== */
if (typeof document !== 'undefined') {
  const $ = s => document.querySelector(s);

  // ---------- Navigasi mobile ----------
  $('#burger').addEventListener('click', () => $('#menu').classList.toggle('open'));
  document.querySelectorAll('#menu a').forEach(a =>
    a.addEventListener('click', () => $('#menu').classList.remove('open')));

  // ---------- Tab ----------
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $('#tab-basic').hidden = btn.dataset.tab !== 'basic';
      $('#tab-sci').hidden = btn.dataset.tab !== 'sci';
    });
  });

  // ---------- LEVEL 1: kalkulator dasar ----------
  $('#basicForm').addEventListener('submit', e => {
    e.preventDefault();
    const out = $('#basicResult');
    const show = (msg, ok) => { out.textContent = msg; out.className = 'basic-result ' + (ok ? 'ok' : 'err'); };

    const s1 = $('#num1').value.trim(), s2 = $('#num2').value.trim();
    if (s1 === '' || s2 === '') return show('Isi kedua angka terlebih dahulu.', false);
    const a = Number(s1), b = Number(s2), op = $('#op').value;
    if (Number.isNaN(a) || Number.isNaN(b)) return show('Input harus berupa angka.', false);

    let r;
    switch (op) {
      case '+': r = a + b; break;
      case '-': r = a - b; break;
      case '*': r = a * b; break;
      case '/':
        if (b === 0) return show('Error: tidak bisa membagi dengan nol.', false);
        r = a / b; break;
    }
    show('Hasil: ' + fmt(r), true);
  });

  // ---------- LEVEL 2-4: kalkulator saintifik ----------
  const exprEl = $('#expr'), resEl = $('#res');
  const BIN = '+−×÷^%';
  let expr = '';
  let deg = true;
  let done = false;       // true setelah tombol "="
  let lastResult = null;  // hasil terakhir (null jika error)
  const history = [];

  // hasil berbentuk 1e+21 diubah agar bisa dipakai lagi di ekspresi
  const plain = s => /e/.test(s)
    ? '(' + s.replace(/e\+?(-?\d+)/, '×10^($1)') + ')'
    : (s.startsWith('-') ? '(' + s + ')' : s);

  function render() {
    exprEl.textContent = expr || '0';
    exprEl.scrollLeft = exprEl.scrollWidth;
    if (done) return;
    resEl.className = 'res';
    resEl.innerHTML = '&nbsp;';
    if (!expr) return;
    try {
      const v = fmt(evaluate(expr, deg));
      if (v !== expr) resEl.textContent = '= ' + v;   // live preview
    } catch (_) { /* abaikan saat masih mengetik */ }
  }

  function input(v) {
    const isBin = BIN.includes(v);
    const continues = isBin || v === '!' || v === '^2' || v === ')';

    if (done) {
      if (continues && lastResult !== null) expr = plain(lastResult);
      else expr = '';
      done = false;
    }

    if (isBin) {
      if (!expr) { if (v !== '−') return; }
      else {
        const last = expr.slice(-1);
        if (last === '(') { if (v !== '−') return; }
        else if (BIN.includes(last)) {
          if (v === '−' && '×÷^%'.includes(last)) { /* angka negatif: 5×−3 */ }
          else expr = expr.slice(0, -1);
        }
      }
    } else if (v === '.') {
      const seg = (expr.match(/[\d.]*$/) || [''])[0];
      if (seg.includes('.')) return;
      if (seg === '') v = ('0123456789'.includes(expr.slice(-1)) || expr === '' || BIN.includes(expr.slice(-1)) || expr.slice(-1) === '(') ? '0.' : '×0.';
    } else if (v === ')') {
      const open = (expr.match(/\(/g) || []).length, close = (expr.match(/\)/g) || []).length;
      if (open <= close) return;
    } else if (v === '!' || v === '^2') {
      if (!expr || BIN.includes(expr.slice(-1)) || expr.slice(-1) === '(') return;
    }
    expr += v;
    render();
  }

  function clearAll() { expr = ''; done = false; lastResult = null; render(); }

  function backspace() {
    done = false;
    expr = /(sin\(|cos\(|tan\(|log\(|ln\(|√\()$/.test(expr)
      ? expr.replace(/(sin\(|cos\(|tan\(|log\(|ln\(|√\()$/, '')
      : expr.slice(0, -1);
    render();
  }

  function equals() {
    if (!expr || done) return;
    const open = (expr.match(/\(/g) || []).length, close = (expr.match(/\)/g) || []).length;
    if (open > close) expr += ')'.repeat(open - close);
    exprEl.textContent = expr;
    done = true;
    try {
      const r = fmt(evaluate(expr, deg));
      lastResult = r;
      resEl.className = 'res final';
      resEl.textContent = '= ' + r;
      history.unshift({ expr, r });
      if (history.length > 8) history.pop();
      renderHistory();
    } catch (err) {
      lastResult = null;
      resEl.className = 'res error';
      resEl.textContent = err.message;
    }
  }

  function renderHistory() {
    const ul = $('#history');
    ul.innerHTML = '';
    if (!history.length) { ul.innerHTML = '<li class="empty">Belum ada perhitungan.</li>'; return; }
    history.forEach(h => {
      const li = document.createElement('li');
      li.innerHTML = '<small></small><b></b>';
      li.firstChild.textContent = h.expr;
      li.lastChild.textContent = '= ' + h.r;
      li.addEventListener('click', () => { expr = h.expr; done = false; render(); });
      ul.appendChild(li);
    });
  }

  $('#keys').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.v) input(b.dataset.v);
    else if (b.dataset.act === 'ac') clearAll();
    else if (b.dataset.act === 'back') backspace();
    else if (b.dataset.act === 'eq') equals();
  });

  $('#angleSeg').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    deg = b.dataset.angle === 'deg';
    document.querySelectorAll('#angleSeg button').forEach(x => x.classList.toggle('on', x === b));
    done = false;
    render();
  });

  $('#clearHistory').addEventListener('click', () => { history.length = 0; renderHistory(); });

  // Dukungan keyboard
  document.addEventListener('keydown', e => {
    if ($('#tab-sci').hidden) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    const map = { '*': '×', '/': '÷', '-': '−', ',': '.' };
    if (/^[0-9]$/.test(k) || ['+', '^', '%', '(', ')', '!', '.'].includes(k)) input(k);
    else if (map[k]) input(map[k]);
    else if (k === 'Enter' || k === '=') equals();
    else if (k === 'Backspace') backspace();
    else if (k === 'Escape') clearAll();
    else return;
    e.preventDefault();
  });

  render();
}

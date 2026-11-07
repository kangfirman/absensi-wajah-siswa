// ===== Helper =====
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const nowT = () => new Date().toTimeString().slice(0, 8);
const badge = (s, c) => `<span class="badge b-${c || s}">${esc(s)}</span>`;
const REG = { 'Terverifikasi': 'Hadir', 'Menunggu Verifikasi': 'Terlambat', 'Belum Terdaftar': 'Alpa' };
function notif(m, t) {
  const n = $('#notif'); n.textContent = m; n.className = 'notif show' + (t === 'err' ? ' err' : '');
  clearTimeout(notif.t); notif.t = setTimeout(() => n.classList.remove('show'), 3000);
}

let G = Store.get('G'), timers = [], Q = Store.get('q') || [];
const A = { running: false };

function clearT() { timers.forEach(clearInterval); timers = []; A.running = false; if (A.video) Face.stop(A.video); }

// ===== Antrean kirim berkelompok (scan tidak pernah menunggu server) =====
let flushing = false;
const qtxt = () => { const e = $('#qn'); if (e) e.textContent = Q.length ? ' • ' + Q.length + ' menunggu sinkron' : ' • tersinkron'; };
async function flush() {
  if (flushing || !Q.length || !Store.get('token')) return;
  flushing = true;
  const items = Q.slice();
  try {
    const r = await Api.post('syncAbsensi', { items });
    if (r.success) { Q.splice(0, items.length); Store.set('q', Q); }
  } catch (_) {}
  flushing = false; qtxt();
}
setInterval(flush, 4000);
addEventListener('online', flush);

// ===== Router =====
function route() {
  clearT();
  const [h, arg] = location.hash.slice(1).split('/');
  if (h === 'daftar') return viewDaftar(arg || '');
  if (!Store.get('token') || !G) return viewLogin();
  ({ dashboard: viewDash, absen: viewAbsen, siswa: viewSiswa, rekap: viewRekap }[h] || viewDash)();
}
addEventListener('hashchange', route);

function layout(on, html) {
  const n = [['dashboard', 'Dashboard'], ['absen', 'Absen Wajah'], ['siswa', 'Data Siswa'], ['rekap', 'Rekap']];
  $('#app').innerHTML = `<nav class="side"><h1>Absensi Wajah</h1>${n.map(([k, t]) => `<a href="#${k}" class="${k === on ? 'on' : ''}">${t}</a>`).join('')}<a href="#" id="out" style="margin-top:auto;color:#DC2626">Keluar</a></nav><main>${html}</main>`;
  $('#out').onclick = e => { e.preventDefault(); Store.del('token'); Store.del('G'); G = null; location.hash = '#login'; route(); };
}
const kelasOpts = (all) => (all ? '<option value="">Semua kelas</option>' : '') + G.kelas.map(k => `<option value="${esc(k.id)}">${esc(k.nama)}</option>`).join('');

// ===== Login =====
function viewLogin() {
  $('#app').innerHTML = `<div class="center"><form class="card m-wrap" id="f" style="width:340px"><h2>Login Guru</h2><label>NIP</label><input id="nip" required><label>Sandi</label><input id="pw" type="password" required><button class="btn" style="width:100%;margin-top:16px">Masuk</button></form></div>`;
  $('#f').onsubmit = async e => {
    e.preventDefault();
    const b = e.submitter; b.disabled = true; b.textContent = 'Memeriksa...';
    const r = await Api.post('login', { nip: $('#nip').value.trim(), sandi: $('#pw').value }).catch(() => ({ message: 'Tidak bisa terhubung ke server.' }));
    if (r.success) {
      Store.set('token', r.token); Store.set('G', { guru: r.guru, kelas: r.kelas, config: r.config }); G = Store.get('G');
      Face.load(); location.hash = '#dashboard'; route();
    } else { notif(r.message, 'err'); b.disabled = false; b.textContent = 'Masuk'; }
  };
}

// ===== Dashboard =====
function viewDash() {
  layout('dashboard', `<h2>Ringkasan ${today()}</h2><div id="d"><div class="grid">${'<div class="card sk" style="height:96px"></div>'.repeat(4)}</div></div>`);
  const draw = d => {
    if (!d || !$('#d')) return;
    $('#d').innerHTML = `<div class="grid">${[['Terdaftar', d.total], ['Hadir', d.hadir], ['Terlambat', d.terlambat], ['Izin / Sakit', d.izin], ['Alpa / Belum', d.alpa + d.belum]].map(([t, v]) => `<div class="card m"><small>${t}</small><b>${v}</b></div>`).join('')}</div>
    <div class="card"><h3>Absensi terbaru</h3><table><tr><th>Jam</th><th>NIS</th><th>Nama</th><th>Metode</th><th>Status</th></tr>${d.feed.map(f => `<tr><td>${esc(f.waktu)}</td><td>${esc(f.nis)}</td><td>${esc(f.nama)}</td><td>${esc(f.metode)}</td><td>${badge(f.status)}</td></tr>`).join('') || '<tr><td colspan="5">Belum ada data hari ini.</td></tr>'}</table></div>`;
  };
  draw(Store.get('dash')); // tampil instan dari cache, lalu segarkan
  const load = async () => { const r = await Api.get('getDashboard', { tanggal: today() }).catch(() => null); if (r && r.success) { Store.set('dash', r); draw(r); } };
  load(); timers.push(setInterval(load, 10000));
}

// ===== Absen Wajah =====
function viewAbsen() {
  layout('absen', `<div class="card row"><div><label>Kelas</label><select id="kl">${kelasOpts()}</select></div><div><label>Mata pelajaran</label><input id="mp" value="Harian"></div><div><label>Batas tepat waktu</label><input id="bt" type="time" value="${esc(G.config.batas_tepat)}"></div><button class="btn" id="go">Mulai Sesi</button><button class="btn out" id="al" style="display:none">Tandai sisanya Alpa</button></div>
  <div class="two"><div class="cam"><video id="cam" playsinline muted></video><div class="hint" id="hint">Pilih kelas lalu klik Mulai Sesi</div></div>
  <div><div class="card"><b id="pg">0 / 0</b> sudah absen<small id="qn"></small><div class="bar"><i id="br"></i></div></div><div class="card" id="last">Belum ada deteksi.</div><div class="card"><h3>Belum absen</h3><div id="rest" class="list"></div></div></div></div>`);
  A.video = $('#cam');
  $('#go').onclick = startSesi;
  $('#al').onclick = () => {
    const sisa = A.roster.filter(s => !A.done[s.nis]);
    if (sisa.length && confirm('Tandai ' + sisa.length + ' siswa sebagai Alpa?')) sisa.forEach(s => mark(s, null, 'manual', 'Alpa'));
  };
}

async function startSesi() {
  const kelas = $('#kl').value, mapel = $('#mp').value.trim() || 'Harian';
  Object.assign(A, { kelas, mapel, batas: $('#bt').value || G.config.batas_tepat, cand: null, streak: 0, running: false });
  A.sesi = today() + '_' + kelas + '_' + mapel.replace(/\W+/g, '-');
  A.done = Store.get('dn_' + A.sesi) || {};
  const hint = t => { const h = $('#hint'); if (h) h.textContent = t; };
  hint('Memuat model & data wajah...'); $('#go').disabled = true;
  const cached = Store.get('d_' + kelas); A.list = cached || [];
  const dp = Api.get('getDescriptors', { kelas_id: kelas }).then(r => { if (r.success) { A.list = r.data; Store.set('d_' + kelas, r.data); } }).catch(() => {});
  if (!cached) await dp; // ada cache → langsung jalan, data disegarkan di latar belakang
  const [ro] = await Promise.all([Api.get('getRoster', { kelas_id: kelas }), Face.load()]);
  if (!ro.success) { notif(ro.message || 'Gagal memuat siswa', 'err'); $('#go').disabled = false; return; }
  A.roster = ro.data;
  if (!A.list.length) notif('Belum ada wajah terverifikasi di kelas ini.', 'err');
  try { await Face.start(A.video); } catch (_) { hint('Kamera tidak bisa dibuka. Izinkan akses kamera.'); $('#go').disabled = false; return; }
  A.running = true; $('#al').style.display = ''; $('#go').textContent = 'Sesi Berjalan';
  hint('Arahkan wajah ke tengah'); renderA(); loop();
}

async function loop() {
  if (!A.running) return;
  const hint = t => { const h = $('#hint'); if (h) h.textContent = t; };
  try {
    const r = await Face.detect(A.video);
    if (!A.running) return;
    if (!r) { A.cand = null; hint('Arahkan wajah ke tengah'); }
    else {
      const m = Face.match(r.desc, A.list);
      if (!m) { A.cand = null; hint('Wajah tidak dikenali, coba lagi'); }
      else {
        A.streak = A.cand === m.p.nis ? A.streak + 1 : 1; A.cand = m.p.nis; // 2x berturut-turut = lebih akurat
        if (A.done[m.p.nis]) hint(m.p.nama + ' sudah absen');
        else if (A.streak >= 2) { mark(m.p, m.acc, 'wajah'); hint('✓ ' + m.p.nama); }
        else hint('Mengenali...');
      }
    }
  } catch (_) {}
  setTimeout(loop, 120);
}

function mark(p, acc, metode, status) {
  if (A.done[p.nis]) return;
  const t = nowT();
  status = status || (t.slice(0, 5) > A.batas ? 'Terlambat' : 'Hadir');
  A.done[p.nis] = status; Store.set('dn_' + A.sesi, A.done);
  Q.push({ sesi_id: A.sesi, tanggal: today(), kelas_id: A.kelas, mapel: A.mapel, nis: p.nis, status, waktu: t, akurasi: acc || '', metode });
  Store.set('q', Q);
  if (metode === 'wajah') $('#last').innerHTML = `<small>BARU SAJA TERDETEKSI</small><h3>${esc(p.nama)}</h3><small>NIS ${esc(p.nis)} • ${t} • Akurasi ${acc}%</small><br>${badge(status)}`;
  renderA();
}

function renderA() {
  const n = A.roster.length, d = Object.keys(A.done).length;
  $('#pg').textContent = d + ' / ' + n; $('#br').style.width = (n ? d / n * 100 : 0) + '%'; qtxt();
  $('#rest').innerHTML = A.roster.filter(s => !A.done[s.nis]).map(s => `<div class="li"><span>${esc(s.nama)}</span><span>${['Izin', 'Sakit', 'Alpa'].map(t => `<button class="mini" title="${t}" data-n="${esc(s.nis)}" data-s="${t}">${t[0]}</button>`).join('')}</span></div>`).join('') || 'Semua siswa sudah absen.';
  $('#rest').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    mark(A.roster.find(x => x.nis === b.dataset.n), null, 'manual', b.dataset.s);
  };
}

// ===== Data Siswa =====
function viewSiswa() {
  layout('siswa', `<h2>Data Siswa</h2><div class="card row"><div><label>Kelas</label><select id="kl">${kelasOpts()}</select></div></div><div class="card" id="lnk"></div><div class="card" id="sw"><div class="sk" style="height:80px"></div></div>`);
  const load = async () => {
    const id = $('#kl').value, k = G.kelas.find(x => x.id === id);
    const link = location.origin + location.pathname + '#daftar/' + k.token_daftar;
    $('#lnk').innerHTML = `<b>Link pendaftaran wajah kelas ini</b><br><small>Bagikan ke siswa (jaga kerahasiaannya)</small><div class="row" style="margin-top:8px"><input id="lk" readonly value="${esc(link)}" style="flex:1;min-width:240px"><button class="btn out" id="cp">Salin</button></div>`;
    $('#cp').onclick = () => { $('#lk').select(); document.execCommand('copy'); notif('Link disalin'); };
    const r = await Api.get('getRoster', { kelas_id: id });
    if (!r.success) return notif(r.message, 'err');
    $('#sw').innerHTML = `<table><tr><th>NIS</th><th>Nama</th><th>Wajah</th><th></th></tr>${r.data.map(s => `<tr><td>${esc(s.nis)}</td><td>${esc(s.nama)}</td><td>${badge(s.status, REG[s.status])}</td><td>${s.status === 'Menunggu Verifikasi' ? `<button class="mini ok" data-v="1" data-n="${esc(s.nis)}">Verifikasi</button><button class="mini" data-v="0" data-n="${esc(s.nis)}">Tolak</button>` : ''}</td></tr>`).join('')}</table>`;
    $('#sw').onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      b.disabled = true;
      const x = await Api.post('verifyFace', { nis: b.dataset.n, ok: b.dataset.v === '1' });
      if (x.success) { Store.del('d_' + id); notif('Tersimpan'); load(); } else notif(x.message, 'err');
    };
  };
  $('#kl').onchange = load; load();
}

// ===== Rekap =====
function viewRekap() {
  let R = [];
  layout('rekap', `<h2>Rekap & Laporan</h2><div class="card row"><div><label>Dari</label><input id="d1" type="date" value="${today()}"></div><div><label>Sampai</label><input id="d2" type="date" value="${today()}"></div><div><label>Kelas</label><select id="kl">${kelasOpts(true)}</select></div><button class="btn" id="go">Tampilkan</button><button class="btn out" id="xl">Ekspor Excel</button><button class="btn out" id="pd">Cetak / PDF</button></div><div class="card" id="rk">Pilih rentang tanggal lalu klik Tampilkan.</div>`);
  $('#go').onclick = async () => {
    $('#rk').innerHTML = '<div class="sk" style="height:80px"></div>';
    const r = await Api.get('getRekap', { dari: $('#d1').value, sampai: $('#d2').value, kelas_id: $('#kl').value });
    if (!r.success) return notif(r.message, 'err');
    R = r.data;
    $('#rk').innerHTML = `<table><tr><th>Tanggal</th><th>Kelas</th><th>Mapel</th><th>NIS</th><th>Nama</th><th>Jam</th><th>Status</th></tr>${R.map(x => `<tr><td>${esc(x.Tanggal)}</td><td>${esc(x.Kelas)}</td><td>${esc(x.Mapel)}</td><td>${esc(x.NIS)}</td><td>${esc(x.Nama)}</td><td>${esc(x.Jam)}</td><td>${badge(x.Status)}</td></tr>`).join('') || '<tr><td colspan="7">Tidak ada data.</td></tr>'}</table>`;
  };
  $('#xl').onclick = () => {
    if (!R.length) return notif('Tampilkan data dulu', 'err');
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(R), 'Rekap');
    XLSX.writeFile(wb, 'rekap-absensi.xlsx');
  };
  $('#pd').onclick = () => print();
}

// ===== Pendaftaran Siswa (HP, tanpa login) =====
function viewDaftar(tk) {
  const D = { descs: [] }, P = ['Menghadap lurus', 'Tengok sedikit ke kiri', 'Tengok sedikit ke kanan', 'Dagu sedikit naik', 'Dagu sedikit turun'];
  const root = h => { $('#app').innerHTML = `<div class="m-wrap"><div class="card"><h2>Pendaftaran Biometrik</h2>${h}</div></div>`; };
  const s1 = () => {
    root(`<small>Langkah 1 dari 3: Identitas</small><label>NIS</label><input id="nis" inputmode="numeric" value="${esc(D.nis || '')}"><label>Token Kelas</label><input id="tk" value="${esc(D.tk || tk)}"><div id="inf" style="margin-top:12px"></div><button class="btn" id="nx" style="width:100%;margin-top:12px">Cek Data</button>`);
    $('#nx').onclick = async e => {
      if (D.info) return s2();
      e.target.disabled = true;
      D.nis = $('#nis').value.trim(); D.tk = $('#tk').value.trim();
      const r = await Api.get('getDaftarInfo', { nis: D.nis, tk: D.tk }).catch(() => ({ message: 'Tidak bisa terhubung.' }));
      e.target.disabled = false;
      if (!r.success) return notif(r.message, 'err');
      D.info = r; Face.load();
      $('#inf').innerHTML = `<b>${esc(r.nama)}</b><br><small>Kelas ${esc(r.kelas)} • ${esc(r.status)}</small>`; e.target.textContent = 'Lanjut ke Persetujuan';
    };
  };
  const s2 = () => {
    root(`<small>Langkah 2 dari 3: Persetujuan</small><p>Wajah Anda akan diambil dari 5 sudut dan disimpan sebagai <b>data angka</b> (bukan foto) untuk absensi sekolah. Data hanya dipakai guru untuk mencatat kehadiran.</p><label style="font-weight:400"><input type="checkbox" id="ok" style="width:auto"> Saya setuju</label><button class="btn" id="nx" style="width:100%;margin-top:12px" disabled>Lanjut ke Scan Wajah</button>`);
    $('#ok').onchange = e => { $('#nx').disabled = !e.target.checked; };
    $('#nx').onclick = s3;
  };
  const s3 = async () => {
    root(`<small>Langkah 3 dari 3: Scan wajah</small><div class="cam" style="margin:12px 0"><video id="cam" playsinline muted></video><div class="hint" id="hint">Menyiapkan kamera...</div></div><button class="btn" id="nx" style="width:100%" disabled>Memuat...</button>`);
    A.video = $('#cam');
    try { await Face.load(); await Face.start(A.video); } catch (_) { return notif('Kamera tidak bisa dibuka. Izinkan akses kamera.', 'err'); }
    const upd = () => { $('#hint').textContent = P[D.descs.length]; $('#nx').disabled = false; $('#nx').textContent = `Ambil sudut ${D.descs.length + 1}/5`; };
    upd();
    $('#nx').onclick = async e => {
      e.target.disabled = true;
      const r = await Face.detect(A.video);
      if (!r) { notif('Wajah belum terdeteksi, coba lagi', 'err'); e.target.disabled = false; return; }
      D.descs.push(r.desc);
      if (D.descs.length < 5) return upd();
      Face.stop(A.video); e.target.textContent = 'Mengirim...';
      const x = await Api.post('registerFace', { nis: D.nis, tk: D.tk, descs: D.descs });
      root(x.success ? `<h3>✅ Berhasil</h3><p>${esc(x.message)}</p>` : `<h3>Gagal</h3><p>${esc(x.message)}</p><button class="btn" onclick="location.reload()">Ulangi</button>`);
    };
  };
  s1();
}

Api.get('ping').catch(() => {}); // bangunkan backend lebih awal
if (G && Store.get('token')) Face.load();
route();

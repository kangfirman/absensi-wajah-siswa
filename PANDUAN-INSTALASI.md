# Panduan Instalasi — Absensi Wajah Siswa

## A. Backend (Google Apps Script)
1. Buka https://script.google.com → **Proyek baru**.
2. Ganti nama file `Code.gs` → `Kode`, hapus isinya, lalu tempel seluruh isi `Kode.gs`.
3. Pilih fungsi **setupAppEnvironment** → ▶ Run → izinkan akses Drive & Sheets. **Jalankan SEKALI saja.**
4. Buka **Execution log**: catat NIP dan sandi login contoh. Folder dan spreadsheet database ikut terbuat di Google Drive.
5. Pilih fungsi **pasangKeepWarm** → ▶ Run (sekali) agar backend tidak "tidur" dan tidak ada delay.
6. **Deploy → New deployment → Web app** → Execute as: **Me** • Who has access: **Anyone** → Deploy.
7. Salin URL yang berakhiran `/exec`.

## B. Isi data di Google Sheets (spreadsheet "Database — Absensi Wajah Siswa")
- Sheet `Kelas`: id, nama, token_daftar (token rahasia per kelas, mis. `KLS-X1`).
- Sheet `Siswa`: nis, nama, kelas_id (sama dengan `Kelas.id`), status_registrasi = `Belum Terdaftar`.
- Sheet `Guru`: tambah guru baru → ubah NIP di fungsi `setSandiGuru` → Run.
- Sheet `AppConfig`: `JAM_MASUK` dan `BATAS_TEPAT` (lewat jam ini = Terlambat).

## C. Frontend (GitHub Pages)
1. Ekstrak `absensi-wajah-siswa.zip`. **Folder `absensi-wajah-siswa` hasil ekstraksi itulah folder yang di-`git init`** (di dalamnya langsung terlihat `index.html`, `css/`, `js/`).
2. Buka `js/config.js`, ganti `GAS_URL` dengan URL `/exec` dari langkah A7.
3. Push ke GitHub dan aktifkan Pages (Settings → Pages → branch `main` / root → Enforce HTTPS ✅). Minta saya memandu langkah demi langkah di chat.

## D. Alur pemakaian
1. Guru login → **Data Siswa** → salin **link pendaftaran** kelas → bagikan ke siswa.
2. Siswa membuka link di HP → isi NIS → setuju → scan 5 sudut.
3. Guru membuka **Data Siswa** → **Verifikasi**.
4. Guru membuka **Absen Wajah** → pilih kelas & mapel → **Mulai Sesi**.
5. Di akhir sesi: tandai Izin/Sakit/Alpa manual → **Rekap** untuk ekspor Excel / Cetak PDF.

## Catatan
- Model pengenalan wajah dimuat dari CDN (jsDelivr) dan di-cache browser, jadi pemakaian pertama sedikit lebih lama.
- Setelah mengubah `Kode.gs`: **Deploy → Manage deployments → Edit → Version: New version**.

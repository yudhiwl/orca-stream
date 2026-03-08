# data-v1

Data source Android untuk mode encrypted via GitHub.

## Mode yang dipakai

- `data-v1/source/*` = lokal saja (workspace), tidak di-commit.
- `data-v1/source-encrypted/*` = di-commit ke GitHub.
- Android baca:
  - `data-v1/source-encrypted/manifest.json`
  - `data-v1/source-encrypted/*.enc`

## Alur kerja cepat

1. Update source lokal:

```bash
node scripts/sync-lite-data.mjs --all
node scripts/sync-lite-data.mjs --file EV.json
```

2. (Opsional) Konversi `image` base64 -> file gambar:

```bash
node data-v1/tools/extract-images.mjs
```

Khusus 1 file:

```bash
node data-v1/tools/extract-images.mjs --file EV.json

```

Default script akan otomatis coba ambil:

- `owner/repo` dari `git remote origin`
- `branch` dari branch aktif

Lalu membentuk URL:

`https://raw.githubusercontent.com/<owner>/<repo>/<branch>/data-v1/source-images/...`

Jika ingin paksa branch tertentu:

```bash
node data-v1/tools/extract-images.mjs --branch main
```

Jika ingin isi URL manual:

```bash
node data-v1/tools/extract-images.mjs --image-base-url https://raw.githubusercontent.com/<owner>/<repo>/main/data-v1/source-images

node data-v1/tools/extract-images.mjs --image-base-url https://raw.githubusercontent.com/yudhiwl/orca-stream/main/data-v1/source-images

```

3. Encrypt source lokal ke `source-encrypted`:

```bash
npm run sources:encrypt:folder
```

Satu file:

```bash
node scripts/encrypt-data-v1-source-folder.mjs --file EV.json
```

Beberapa file:

```bash
node scripts/encrypt-data-v1-source-folder.mjs --files EV.json,ID.json
```

4. Commit:

- `data-v1/source-encrypted/`
- `data-v1/source-images/` (jika dipakai)
- `data-v1/README.md` dan `data-v1/tools/*` (jika berubah)

5. Push ke GitHub.

## Catatan penting

- Set key di `.env`:

```bash
ORCA_ANDROID_SOURCE_KEY=isi_passphrase_kuat
```

- Proses encrypt tidak menghapus `data-v1/source`, tapi folder itu tetap lokal.

## Auto update EV di VPS (tanpa GitHub Actions)

Jika GitHub Actions tidak bisa dipakai, gunakan script lokal di VPS:

```bash
bash data-v1/tools/sync-encrypt-ev-vps.sh
```

Script akan:

- sync + decrypt `EV.json` dari upstream (`brodatv1/lite`),
- cek perubahan konten,
- encrypt hanya `EV.json`,
- commit `data-v1/source-encrypted/EV.enc` + `manifest.json`,
- push ke branch git.

Environment wajib:

```bash
export ORCA_ANDROID_SOURCE_KEY="PghikeeAfkLAAIncDEyNmE4MDRkYWM4NzY0YTc0YjQ3NzRlNDJlMTQ1OTA3ZHAxNj"
```

FORCE_ENCRYPT=1 ORCA_ANDROID_SOURCE_KEY='PghikeeAfkLAAIncDEyNmE4MDRkYWM4NzY0YTc0YjQ3NzRlNDJlMTQ1OTA3ZHAxNj' bash data-v1/tools/sync-encrypt-ev-vps.sh

node scripts/sync-lite-data.mjs --version v215 --file MI.json --no-prune --no-live-events-sync
Opsional:

- `LITE_VERSION` (default: `v215`)
- `GIT_REMOTE` (default: `origin`)
- `GIT_BRANCH` (default: `main`)

Contoh cron tiap 6 jam:

```bash
0 */6 * * * cd /opt/orcastream && ORCA_ANDROID_SOURCE_KEY='isi_passphrase_anda' bash data-v1/tools/sync-encrypt-ev-vps.sh >> /var/log/orca-ev-sync.log 2>&1
```
cd /www/wwwroot/api.orcatv.my.id/orcastream

# 1) sync semua source kategori dari upstream
node scripts/sync-lite-data.mjs --version v215 --all --no-live-events-sync

# 2) encrypt semua (jangan pakai --file)
ORCA_ANDROID_SOURCE_KEY='PghikeeAfkLAAIncDEyNmE4MDRkYWM4NzY0YTc0YjQ3NzRlNDJlMTQ1OTA3ZHAxNj' \
node scripts/encrypt-data-v1-source-folder.mjs

# 3) cek kode yang ada di manifest
node -e "const m=require('./data-v1/source-encrypted/manifest.json'); console.log(m.files.map(f=>f.sourceFile.replace(/\\\\/g,'/').split('/').pop().replace('.json','')).sort().join(', '))"

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

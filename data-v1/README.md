# data-v1

Folder ini dipakai untuk data source Android (tanpa server runtime).

## Struktur

- `source/*.json`  
  File source mentah per kategori/negara (contoh: `EV.json`, `ID.json`).
- `source-encrypted/*.enc`  
  Hasil enkripsi per file dari `source/*.json`.
- `source-encrypted/manifest.json`  
  Metadata enkripsi semua file di `source-encrypted`.
- `sources.json` / `sources.template.json`  
  Bundle gabungan (opsional).
- `sources.enc` / `sources.meta.json`  
  Bundle terenkripsi (opsional).

## Mode Sederhana (Disarankan)

Android baca langsung dari:

- `data-v1/source/EV.json` (live events)
- atau file lain di `data-v1/source/*.json` sesuai kebutuhan.

## Update Source

Jalankan dari root project:

```bash
node scripts/sync-lite-data.mjs --all
```

## Encrypt Semua File `source` (file asli tetap ada)

1. Set key di `.env`:

```bash
ORCA_ANDROID_SOURCE_KEY=isi_passphrase_kuat
```

2. Jalankan:

```bash
npm run sources:encrypt:folder
```

Encrypt satu file saja (contoh `EV.json`):

```bash
node scripts/encrypt-data-v1-source-folder.mjs --file EV.json
```

Encrypt beberapa file:

```bash
node scripts/encrypt-data-v1-source-folder.mjs --files EV.json,ID.json
```

Output terenkripsi ada di:

- `data-v1/source-encrypted/*.enc`
- `data-v1/source-encrypted/manifest.json`

Catatan: proses ini tidak mengubah/menghapus file asli di `data-v1/source`.

## Yang Di-commit

Jika pakai mode encrypted per file, commit juga folder berikut:

- `data-v1/source-encrypted/`

Minimal isi yang harus ikut:

- `data-v1/source-encrypted/*.enc`
- `data-v1/source-encrypted/manifest.json`

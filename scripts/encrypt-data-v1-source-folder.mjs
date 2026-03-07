import crypto from "crypto";
import fs from "fs";
import path from "path";

const DEFAULT_INPUT_DIR = path.join(process.cwd(), "data-v1", "source");
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), "data-v1", "source-encrypted");
const DEFAULT_MANIFEST = path.join(DEFAULT_OUTPUT_DIR, "manifest.json");
const PASS_ENV = "ORCA_ANDROID_SOURCE_KEY";
const ITERATIONS = 210_000;

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    inputDir: DEFAULT_INPUT_DIR,
    outputDir: DEFAULT_OUTPUT_DIR,
    manifest: DEFAULT_MANIFEST,
    onlyFiles: [],
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--input-dir" && args[i + 1]) {
      options.inputDir = path.resolve(process.cwd(), args[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--output-dir" && args[i + 1]) {
      options.outputDir = path.resolve(process.cwd(), args[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--manifest" && args[i + 1]) {
      options.manifest = path.resolve(process.cwd(), args[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--file" && args[i + 1]) {
      options.onlyFiles.push(args[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--files" && args[i + 1]) {
      const names = String(args[i + 1])
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      options.onlyFiles.push(...names);
      i += 1;
      continue;
    }
  }

  return options;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const raw = fs.readFileSync(filePath, "utf-8");
  const entries = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const normalized = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length).trim()
      : trimmed;
    const sep = normalized.indexOf("=");
    if (sep <= 0) continue;

    const key = normalized.slice(0, sep).trim();
    let value = normalized.slice(sep + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }
  return entries;
}

function loadLocalEnv() {
  const shellEnvKeys = new Set(Object.keys(process.env));
  const envPath = path.join(process.cwd(), ".env");
  const envLocalPath = path.join(process.cwd(), ".env.local");

  const fromEnv = parseEnvFile(envPath);
  for (const [key, value] of Object.entries(fromEnv)) {
    if (shellEnvKeys.has(key)) continue;
    process.env[key] = value;
  }

  const fromEnvLocal = parseEnvFile(envLocalPath);
  for (const [key, value] of Object.entries(fromEnvLocal)) {
    if (shellEnvKeys.has(key)) continue;
    process.env[key] = value;
  }
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function getJsonFiles(inputDir) {
  if (!fs.existsSync(inputDir)) return [];
  return fs
    .readdirSync(inputDir)
    .filter((name) => name.toLowerCase().endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));
}

function posixPath(filePath) {
  return filePath.split(path.sep).join(path.posix.sep);
}

function normalizeFileName(fileName) {
  const trimmed = String(fileName ?? "").trim();
  if (!trimmed) return "";
  return trimmed.toLowerCase().endsWith(".json") ? trimmed : `${trimmed}.json`;
}

function normalizeJsonText(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "").trim();
  if (!raw) {
    throw new Error(`File kosong: ${filePath}`);
  }
  const parsed = JSON.parse(raw);
  return JSON.stringify(parsed);
}

function loadExistingManifestEntries(manifestPath) {
  if (!fs.existsSync(manifestPath)) return [];
  try {
    const raw = fs.readFileSync(manifestPath, "utf-8").replace(/^\uFEFF/, "").trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.files)) return [];
    return parsed.files.filter(
      (entry) => {
        if (
          !entry ||
          typeof entry !== "object" ||
          typeof entry.sourceFile !== "string" ||
          typeof entry.encryptedFile !== "string"
        ) return false;

        entry.sourceFile = posixPath(entry.sourceFile);
        entry.encryptedFile = posixPath(entry.encryptedFile);
        return true;
      }
    );
  } catch {
    return [];
  }
}

function encryptPlaintext(plaintext, passphrase) {
  // Use deterministic salt and IV based on the plaintext hash.
  // This prevents generating different ciphertext for identical plaintext,
  // which avoids unnecessary git commits and CDN cache synchronization issues.
  const hash = crypto.createHash("sha256").update(plaintext).digest();
  const salt = hash.subarray(0, 16);
  const iv = hash.subarray(16, 28);

  const key = crypto.pbkdf2Sync(passphrase, salt, ITERATIONS, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([encrypted, tag]);
  return { payload, salt, iv, tagLength: tag.length };
}

function main() {
  loadLocalEnv();
  const options = parseArgs();

  const passphrase = String(process.env[PASS_ENV] ?? "").trim();
  if (!passphrase) {
    fail(`${PASS_ENV} wajib diisi di environment (.env atau shell).`);
  }

  const availableFiles = getJsonFiles(options.inputDir);
  if (availableFiles.length === 0) {
    fail(`Tidak ada file .json di: ${options.inputDir}`);
  }

  const selectedFiles =
    options.onlyFiles.length > 0
      ? Array.from(
        new Set(
          options.onlyFiles
            .map((name) => normalizeFileName(name))
            .filter(Boolean)
        )
      )
      : availableFiles;

  const availableSet = new Set(availableFiles.map((name) => name.toLowerCase()));
  const missingFiles = selectedFiles.filter(
    (name) => !availableSet.has(name.toLowerCase())
  );
  if (missingFiles.length > 0) {
    fail(
      `File tidak ditemukan di ${options.inputDir}: ${missingFiles.join(", ")}`
    );
  }

  ensureDir(options.outputDir);

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    algorithm: "aes-256-gcm",
    kdf: {
      name: "pbkdf2-sha256",
      iterations: ITERATIONS,
    },
    keyEnv: PASS_ENV,
    sourceDir: posixPath(path.relative(process.cwd(), options.inputDir)),
    outputDir: posixPath(path.relative(process.cwd(), options.outputDir)),
    files: [],
  };

  const manifestEntries = new Map();
  for (const entry of loadExistingManifestEntries(options.manifest)) {
    manifestEntries.set(entry.sourceFile, entry);
  }

  for (const fileName of selectedFiles) {
    const srcPath = path.join(options.inputDir, fileName);
    const normalizedJson = normalizeJsonText(srcPath);
    const plaintext = Buffer.from(normalizedJson, "utf-8");
    const encrypted = encryptPlaintext(plaintext, passphrase);
    const outName = `${path.basename(fileName, ".json")}.enc`;
    const outPath = path.join(options.outputDir, outName);

    fs.writeFileSync(outPath, encrypted.payload);

    const entry = {
      sourceFile: posixPath(path.relative(process.cwd(), srcPath)),
      encryptedFile: posixPath(path.relative(process.cwd(), outPath)),
      outputBytes: encrypted.payload.length,
      saltB64: encrypted.salt.toString("base64"),
      ivB64: encrypted.iv.toString("base64"),
      tagLength: encrypted.tagLength,
      inputSha256: sha256Hex(plaintext),
      payloadSha256: sha256Hex(encrypted.payload),
    };
    manifestEntries.set(entry.sourceFile, entry);

    console.log(
      `Encrypted: ${path.relative(process.cwd(), srcPath)} -> ${path.relative(process.cwd(), outPath)}`
    );
  }

  const singleFileMode = selectedFiles.length > 0;
  manifest.files = Array.from(manifestEntries.values())
    .filter((entry) => {
      if (singleFileMode) {
        // In single-file mode, keep existing manifest entries so updating EV
        // does not accidentally drop other categories (e.g. MI) on servers
        // that only have partial working trees.
        return true;
      }
      return fs.existsSync(path.resolve(process.cwd(), entry.encryptedFile));
    })
    .sort((a, b) => a.sourceFile.localeCompare(b.sourceFile));

  fs.writeFileSync(options.manifest, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
  console.log(`Manifest : ${path.relative(process.cwd(), options.manifest)}`);
  console.log(
    `Done. Processed: ${selectedFiles.length}. Manifest entries: ${manifest.files.length}`
  );
}

main();

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT_DIR = path.join(process.cwd(), "data-v1");
const DEFAULT_INPUT_DIR = path.join(ROOT_DIR, "source");
const DEFAULT_IMAGE_DIR = path.join(ROOT_DIR, "source-images");
const DATA_URI_RE = /^data:(image\/[a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=\r\n]+)$/;
const RAW_PLACEHOLDER_RE =
  /^https:\/\/raw\.githubusercontent\.com\/<owner>\/<repo>\/[^/]+\/data-v1\/source-images\/(.+)$/i;

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    inputDir: DEFAULT_INPUT_DIR,
    imageDir: DEFAULT_IMAGE_DIR,
    imageBaseUrl: "",
    branch: "",
    autoGithubBaseUrl: true,
    onlyFiles: [],
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--input-dir" && args[i + 1]) {
      options.inputDir = path.resolve(process.cwd(), args[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--image-dir" && args[i + 1]) {
      options.imageDir = path.resolve(process.cwd(), args[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--image-base-url" && args[i + 1]) {
      options.imageBaseUrl = String(args[i + 1]).trim();
      i += 1;
      continue;
    }
    if (arg === "--branch" && args[i + 1]) {
      options.branch = String(args[i + 1]).trim();
      i += 1;
      continue;
    }
    if (arg === "--no-auto-github") {
      options.autoGithubBaseUrl = false;
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

function fail(message) {
  console.error(message);
  process.exit(1);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getJsonFiles(inputDir) {
  if (!fs.existsSync(inputDir)) return [];
  return fs
    .readdirSync(inputDir)
    .filter((name) => name.toLowerCase().endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));
}

function normalizeFileName(fileName) {
  const trimmed = String(fileName ?? "").trim();
  if (!trimmed) return "";
  return trimmed.toLowerCase().endsWith(".json") ? trimmed : `${trimmed}.json`;
}

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function extensionFromMime(mime) {
  const normalized = mime.toLowerCase();
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";
  if (normalized === "image/svg+xml") return "svg";
  const fallback = normalized.split("/")[1] || "bin";
  return fallback.replace(/[^a-z0-9]/g, "") || "bin";
}

function parseDataUri(value) {
  const source = String(value ?? "").trim();
  if (!source) return null;
  const match = source.match(DATA_URI_RE);
  if (!match) return null;
  const mime = match[1];
  const b64 = match[2].replace(/\s+/g, "");
  const buffer = Buffer.from(b64, "base64");
  if (buffer.length === 0) return null;
  return { mime, buffer };
}

function joinUrl(baseUrl, fileName) {
  if (!baseUrl) return fileName;
  return `${baseUrl.replace(/\/+$/, "")}/${fileName}`;
}

function rewritePlaceholderImageUrl(imageValue, imageBaseUrl) {
  const value = String(imageValue ?? "").trim();
  if (!value) return value;
  if (!imageBaseUrl) return value;
  const match = value.match(RAW_PLACEHOLDER_RE);
  if (!match) return value;
  const tailPath = String(match[1]).replace(/^\/+/, "");
  return `${imageBaseUrl.replace(/\/+$/, "")}/${tailPath}`;
}

function normalizePosixPath(input) {
  return String(input ?? "").replace(/\\/g, "/").replace(/^\/+/, "").trim();
}

function parseGithubRemote(remoteUrl) {
  const raw = String(remoteUrl ?? "").trim();
  if (!raw) return null;

  // https://github.com/owner/repo(.git)
  const httpsMatch = raw.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  // git@github.com:owner/repo(.git)
  const sshMatch = raw.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  return null;
}

function runGit(command) {
  return execSync(command, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "ignore"],
    encoding: "utf8",
  }).trim();
}

function resolveImageBaseUrl(options) {
  if (options.imageBaseUrl) return options.imageBaseUrl;
  if (!options.autoGithubBaseUrl) return "";

  try {
    const remoteUrl = runGit("git config --get remote.origin.url");
    const parsed = parseGithubRemote(remoteUrl);
    if (!parsed) return "";

    let branch = options.branch;
    if (!branch) {
      branch = runGit("git rev-parse --abbrev-ref HEAD");
    }
    if (!branch || branch === "HEAD") {
      branch = "main";
    }

    const imageRepoPath = normalizePosixPath(path.relative(process.cwd(), options.imageDir));
    if (!imageRepoPath) return "";

    return `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${branch}/${imageRepoPath}`;
  } catch {
    return "";
  }
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function main() {
  const options = parseArgs();
  const resolvedImageBaseUrl = resolveImageBaseUrl(options);
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

  ensureDir(options.imageDir);

  let converted = 0;
  let updated = 0;
  let deduped = 0;
  let touchedFiles = 0;

  for (const fileName of selectedFiles) {
    const filePath = path.join(options.inputDir, fileName);
    const json = readJson(filePath);
    if (!json || typeof json !== "object" || !Array.isArray(json.info)) {
      console.warn(`Skip (format tidak valid): ${path.relative(process.cwd(), filePath)}`);
      continue;
    }

    let fileChanged = false;
    for (const item of json.info) {
      if (!item || typeof item !== "object") continue;
      const currentImage = String(item.image ?? "").trim();

      const placeholderRewritten = rewritePlaceholderImageUrl(
        currentImage,
        resolvedImageBaseUrl
      );
      if (placeholderRewritten !== currentImage) {
        item.image = placeholderRewritten;
        updated += 1;
        fileChanged = true;
      }

      const parsed = parseDataUri(item.image);
      if (!parsed) continue;

      const hash = sha256Hex(parsed.buffer);
      const ext = extensionFromMime(parsed.mime);
      const outputName = `${hash}.${ext}`;
      const outputPath = path.join(options.imageDir, outputName);
      if (fs.existsSync(outputPath)) {
        deduped += 1;
      } else {
        fs.writeFileSync(outputPath, parsed.buffer);
        converted += 1;
      }

      const nextImage = joinUrl(resolvedImageBaseUrl, outputName);
      if (item.image !== nextImage) {
        item.image = nextImage;
        updated += 1;
        fileChanged = true;
      }
    }

    if (fileChanged) {
      writeJson(filePath, json);
      touchedFiles += 1;
      console.log(`Updated: ${path.relative(process.cwd(), filePath)}`);
    }
  }

  console.log(`Done.`);
  console.log(`- Processed files : ${selectedFiles.length}`);
  console.log(`- Changed files   : ${touchedFiles}`);
  console.log(`- New images      : ${converted}`);
  console.log(`- Deduped images  : ${deduped}`);
  console.log(`- Updated entries : ${updated}`);
  console.log(`- Image dir       : ${path.relative(process.cwd(), options.imageDir)}`);
  if (resolvedImageBaseUrl) {
    console.log(`- Image base URL  : ${resolvedImageBaseUrl}`);
  } else {
    console.log(`- Image base URL  : (kosong, image disimpan sebagai nama file relatif)`);
  }
}

main();

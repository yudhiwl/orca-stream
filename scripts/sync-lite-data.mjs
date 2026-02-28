import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const OWNER = "brodatv1";
const REPO = "lite";
const BRANCH = "main";
const LITE_HEADER_MARKER = "jhmfgfdgdvcgcghf";
const execFileAsync = promisify(execFile);
const DEFAULT_SELECTED_FILE = "EV.json";
const DEFAULT_OUTPUT_DIR = path.join("src", "data", "tmp_sync_output");
const DEFAULT_LIVE_EVENTS_OUT = path.join("src", "data", "live-events.json");
const LIVE_FALLBACK_WINDOW_SECONDS = 3 * 60 * 60;

function parseArgs(argv) {
  const args = {
    version: "v215",
    out: "",
    prune: true,
    preserveImages: true,
    files: [],
    onlyEv: true,
    syncLiveEvents: true,
    liveEventsOut: DEFAULT_LIVE_EVENTS_OUT,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--version" && argv[i + 1]) {
      args.version = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--out" && argv[i + 1]) {
      args.out = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--no-prune") {
      args.prune = false;
      continue;
    }
    if (arg === "--preserve-images") {
      args.preserveImages = true;
      continue;
    }
    if (arg === "--no-preserve-images") {
      args.preserveImages = false;
      continue;
    }
    if (arg === "--file" && argv[i + 1]) {
      args.files.push(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--files" && argv[i + 1]) {
      const raw = argv[i + 1]
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      args.files.push(...raw);
      i += 1;
      continue;
    }
    if (arg === "--all") {
      args.onlyEv = false;
      continue;
    }
    if (arg === "--only-ev") {
      args.onlyEv = true;
      continue;
    }
    if (arg === "--no-live-events-sync") {
      args.syncLiveEvents = false;
      continue;
    }
    if (arg === "--live-events-out" && argv[i + 1]) {
      args.liveEventsOut = argv[i + 1];
      i += 1;
      continue;
    }
  }

  return args;
}

function normalizeSelectedFileName(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed) return "";
  const base = path.basename(trimmed);
  if (!base) return "";
  return base.toLowerCase().endsWith(".json")
    ? base.toLowerCase()
    : `${base}.json`.toLowerCase();
}

async function fetchWithRetry(url, options, retries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status} for ${url}\n${body}`);
      }
      return res;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }
  throw lastError;
}

async function runGit(args, cwd) {
  const { stdout, stderr } = await execFileAsync("git", args, { cwd });
  return { stdout, stderr };
}

function reverseText(text) {
  return [...text].reverse().join("");
}

function decryptLiteJson(content) {
  try {
    const headerEnd = content.indexOf(LITE_HEADER_MARKER);
    if (headerEnd === -1) return content;

    const encryptedStart = headerEnd + LITE_HEADER_MARKER.length + 112;
    if (encryptedStart >= content.length) return content;

    const encryptedData = content.substring(encryptedStart);
    const reversed1 = reverseText(encryptedData);
    const decoded1 = Buffer.from(reversed1, "base64").toString("latin1");
    const reversed2 = reverseText(decoded1);
    const decoded2 = Buffer.from(reversed2, "base64").toString("utf8");
    return reverseText(decoded2);
  } catch {
    return content;
  }
}

function normalizeAndValidateJson(rawContent, fileName) {
  const decrypted = decryptLiteJson(rawContent);
  try {
    const parsed = JSON.parse(decrypted);

    // Apply category mapping if country_name is "Events" or if it is EV.json
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.info)) {
      const isEv = parsed.country_name === "Events" || fileName.toLowerCase() === "ev.json";
      parsed.info.forEach(item => {
        if (isEv && (!item.category || item.category === "General")) {
          item.category = "Events";
        }

        // Infer category based on name - prioritizing specific keywords
        const name = (item.name || "").toLowerCase();
        if (name.includes("documentary")) {
          item.category = "Documentary";
        } else if (name.includes("movie") || name.includes("cinema")) {
          item.category = "Movie";
        } else if (!item.category) {
          item.category = "General";
        }

        if (parsed.country_name && !item.country_name) {
          item.country_name = parsed.country_name;
        }
      });
    }

    return `${JSON.stringify(parsed, null, 2)}\n`;
  } catch {
    throw new Error(`Invalid JSON after decrypt for file: ${fileName}`);
  }
}

function isChannelInfoObject(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Array.isArray(value.info)
  );
}

async function applyImagePreservationIfNeeded(
  normalizedContent,
  outputFilePath,
  preserveImages
) {
  if (!preserveImages) return normalizedContent;

  let incoming;
  try {
    incoming = JSON.parse(normalizedContent);
  } catch {
    return normalizedContent;
  }
  if (!isChannelInfoObject(incoming)) return normalizedContent;

  let localRaw;
  try {
    localRaw = await fs.readFile(outputFilePath, "utf8");
  } catch {
    return normalizedContent;
  }

  let local;
  try {
    local = JSON.parse(localRaw);
  } catch {
    return normalizedContent;
  }
  if (!isChannelInfoObject(local)) return normalizedContent;

  const localImageById = new Map();
  for (const item of local.info) {
    if (!item || typeof item !== "object") continue;
    if (typeof item.id !== "string") continue;
    if (typeof item.image !== "string") continue;
    const image = item.image.trim();
    if (!image) continue;
    localImageById.set(item.id, image);
  }

  if (localImageById.size === 0) return normalizedContent;

  let changed = false;
  const mergedInfo = incoming.info.map((item) => {
    if (!item || typeof item !== "object") return item;
    if (typeof item.id !== "string") return item;
    const localImage = localImageById.get(item.id);
    if (!localImage) return item;
    if (item.image === localImage) return item;
    changed = true;
    return { ...item, image: localImage };
  });

  if (!changed) return normalizedContent;
  return `${JSON.stringify({ ...incoming, info: mergedInfo }, null, 2)}\n`;
}

async function copyJsonFiles(
  sourceDir,
  outputDir,
  prune,
  preserveImages,
  selectedFiles
) {
  await fs.mkdir(outputDir, { recursive: true });

  const sourceAllNames = await fs
    .readdir(sourceDir)
    .then((names) => names.filter((name) => name.endsWith(".json")));
  const sourceNames = selectedFiles
    ? sourceAllNames.filter((name) => selectedFiles.has(name.toLowerCase()))
    : sourceAllNames;

  if (sourceNames.length === 0) {
    if (selectedFiles) {
      throw new Error(
        `Selected file(s) not found in source ${sourceDir}: ${[
          ...selectedFiles,
        ].join(", ")}`
      );
    }
    throw new Error(`No JSON files found in ${sourceDir}`);
  }

  const existingNames = await fs
    .readdir(outputDir)
    .then((files) => files.filter((name) => name.endsWith(".json")))
    .catch(() => []);

  for (const name of sourceNames) {
    const from = path.join(sourceDir, name);
    const to = path.join(outputDir, name);
    const raw = await fs.readFile(from, "utf8");
    const normalized = normalizeAndValidateJson(raw, name);
    const finalJson = await applyImagePreservationIfNeeded(
      normalized,
      to,
      preserveImages
    );
    await fs.writeFile(to, finalJson, "utf8");
    console.log(`Updated: ${name}`);
  }

  if (prune && !selectedFiles) {
    const sourceSet = new Set(sourceNames);
    for (const localName of existingNames) {
      if (!sourceSet.has(localName)) {
        await fs.rm(path.join(outputDir, localName), { force: true });
        console.log(`Removed: ${localName}`);
      }
    }
  }

  return sourceNames.length;
}

async function syncFromApi(
  version,
  outputDir,
  apiHeaders,
  prune,
  preserveImages,
  selectedFiles
) {
  const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${version}?ref=${BRANCH}`;
  const listRes = await fetchWithRetry(apiUrl, { headers: apiHeaders });
  const entries = await listRes.json();

  if (!Array.isArray(entries)) {
    throw new Error("Unexpected GitHub API response format.");
  }

  const remoteAllFiles = entries
    .filter((item) => item?.type === "file" && item?.name?.endsWith(".json"))
    .map((item) => ({
      name: item.name,
      downloadUrl: item.download_url,
    }))
    .filter((item) => Boolean(item.downloadUrl));
  const remoteFiles = selectedFiles
    ? remoteAllFiles.filter((item) => selectedFiles.has(item.name.toLowerCase()))
    : remoteAllFiles;

  if (remoteFiles.length === 0) {
    if (selectedFiles) {
      throw new Error(
        `Selected file(s) not found in remote ${version}: ${[
          ...selectedFiles,
        ].join(", ")}`
      );
    }
    throw new Error(`No JSON files found in ${version}.`);
  }

  await fs.mkdir(outputDir, { recursive: true });

  const existingNames = await fs
    .readdir(outputDir)
    .then((files) => files.filter((name) => name.endsWith(".json")))
    .catch(() => []);

  for (const file of remoteFiles) {
    const fileRes = await fetchWithRetry(file.downloadUrl, {
      headers: { "User-Agent": "orcatv-sync-script" },
    });
    const content = await fileRes.text();
    const normalized = normalizeAndValidateJson(content, file.name);
    const outFile = path.join(outputDir, file.name);
    const finalJson = await applyImagePreservationIfNeeded(
      normalized,
      outFile,
      preserveImages
    );
    await fs.writeFile(outFile, finalJson, "utf8");
    console.log(`Updated: ${file.name}`);
  }

  if (prune && !selectedFiles) {
    const remoteSet = new Set(remoteFiles.map((f) => f.name));
    for (const localFile of existingNames) {
      if (!remoteSet.has(localFile)) {
        await fs.rm(path.join(outputDir, localFile), { force: true });
        console.log(`Removed: ${localFile}`);
      }
    }
  }

  return remoteFiles.length;
}

async function syncFromGitSparse(
  version,
  outputDir,
  prune,
  preserveImages,
  selectedFiles
) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "orcatv-sync-lite-"));
  try {
    await runGit(
      [
        "clone",
        "--depth",
        "1",
        "--filter=blob:none",
        "--sparse",
        `https://github.com/${OWNER}/${REPO}.git`,
        tmpDir,
      ],
      process.cwd()
    );
    await runGit(["sparse-checkout", "set", version], tmpDir);
    const sourceDir = path.join(tmpDir, version);
    return await copyJsonFiles(
      sourceDir,
      outputDir,
      prune,
      preserveImages,
      selectedFiles
    );
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

function readJsonText(content) {
  return JSON.parse(String(content).replace(/^\uFEFF/, ""));
}

function toSafeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeStamp(value) {
  const raw = toSafeString(value);
  if (!raw || raw.toLowerCase() === "none") return "none";
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return String(Math.floor(n));
  return "none";
}

function toHeaderString(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
}

function inferSportType(title, competition) {
  const text = `${title} ${competition}`.toLowerCase();
  if (text.includes("futsal")) return "Futsal";
  if (text.includes("badminton") || text.includes("bulu tangkis")) {
    return "Bulu Tangkis";
  }
  if (text.includes("formula 1") || text.includes("f1")) return "Formula 1";
  if (text.includes("basket") || text.includes("nba")) return "Basket";
  if (text.includes("tenis") || text.includes("tennis")) return "Tenis";
  if (text.includes("voli") || text.includes("volley")) return "Voli";
  if (text.includes("mma") || text.includes("ufc")) return "MMA";
  return "Sepak Bola";
}

const WIB_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const DATE_FIRST_EVENT_TITLE =
  /^(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{1,2}:\d{2}\s*WIB)\s*-\s*(.+)$/i;

const TITLE_FIRST_EVENT_TITLE =
  /^(.+?)\s*-\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{1,2}:\d{2}\s*WIB)$/i;

function formatWibLabelFromStamp(tStamp) {
  const n = Number(tStamp);
  if (!Number.isFinite(n) || n <= 0) return "";

  // Build WIB label deterministically, independent of host timezone.
  const wibDate = new Date(Math.floor(n) * 1000 + 7 * 60 * 60 * 1000);
  const day = String(wibDate.getUTCDate());
  const month = WIB_MONTHS[wibDate.getUTCMonth()] || "";
  const hours = String(wibDate.getUTCHours()).padStart(2, "0");
  const minutes = String(wibDate.getUTCMinutes()).padStart(2, "0");
  if (!month) return "";
  return `${day} ${month} ${hours}:${minutes} WIB`;
}

function pickEventMatchTitle(rawTitle, fallbackTitle) {
  const source = toSafeString(rawTitle);
  if (!source) return toSafeString(fallbackTitle);

  const dateFirst = source.match(DATE_FIRST_EVENT_TITLE);
  if (dateFirst) return toSafeString(dateFirst[2]);

  const titleFirst = source.match(TITLE_FIRST_EVENT_TITLE);
  if (titleFirst) return toSafeString(titleFirst[1]);

  return source;
}

function normalizeEventTitle(rawTitle, tStamp, fallbackTitle) {
  const source = toSafeString(rawTitle);
  const matchTitle = pickEventMatchTitle(source, fallbackTitle) || "Live Event";
  const wibLabel = formatWibLabelFromStamp(tStamp);

  if (matchTitle && wibLabel) {
    return `${matchTitle} - ${wibLabel}`;
  }

  const dateFirst = source.match(DATE_FIRST_EVENT_TITLE);
  if (dateFirst) {
    return `${toSafeString(dateFirst[2])} - ${toSafeString(dateFirst[1]).replace(/\s+/g, " ")}`;
  }

  const titleFirst = source.match(TITLE_FIRST_EVENT_TITLE);
  if (titleFirst) {
    return `${toSafeString(titleFirst[1])} - ${toSafeString(titleFirst[2]).replace(/\s+/g, " ")}`;
  }

  return matchTitle;
}

function resolveLiveFlag(sourceLive, tStamp, sStamp, nowSeconds) {
  const start = Number(tStamp);
  const end = Number(sStamp);
  if (Number.isFinite(start) && start > 0) {
    if (Number.isFinite(end) && end >= start) {
      return nowSeconds >= start && nowSeconds <= end ? "t" : "f";
    }
    return nowSeconds >= start && nowSeconds <= start + LIVE_FALLBACK_WINDOW_SECONDS
      ? "t"
      : "f";
  }
  return sourceLive === "t" ? "t" : "f";
}

function mapEvItemToLiveEvent(item, nowSeconds) {
  if (!item || typeof item !== "object") return null;

  const id = toSafeString(item.id);
  if (!id) return null;

  const tStamp = normalizeStamp(item.t_stamp);
  const sStamp = normalizeStamp(item.s_stamp);
  const rawTitle = toSafeString(item.tagline || item.title || item.name || "Live Event");
  const competition = toSafeString(item.name || item.namespace || item.competition);
  const title = normalizeEventTitle(rawTitle, tStamp, item.title || item.name);

  const sportRaw = toSafeString(item.sport);
  const sport = sportRaw || inferSportType(title, competition);

  return {
    id,
    title,
    sport,
    competition,
    hls: toSafeString(item.hls),
    jenis: toSafeString(item.jenis) || "hls",
    header_iptv: toHeaderString(item.header_iptv),
    header_license: toHeaderString(item.header_license),
    url_license: toSafeString(item.url_license),
    thumbnail: toSafeString(item.image || item.thumbnail),
    category: toSafeString(item.category) || "Events",
    is_live: resolveLiveFlag(item.is_live, tStamp, sStamp, nowSeconds),
    t_stamp: tStamp,
    s_stamp: sStamp,
  };
}

function sortByStartStamp(a, b) {
  const at = Number(a.t_stamp);
  const bt = Number(b.t_stamp);
  const aOk = Number.isFinite(at) && at > 0;
  const bOk = Number.isFinite(bt) && bt > 0;
  if (!aOk && !bOk) return 0;
  if (!aOk) return 1;
  if (!bOk) return -1;
  return at - bt;
}

async function syncLiveEventsFromEv(evPath, liveEventsOutPath) {
  const raw = await fs.readFile(evPath, "utf8");
  const parsed = readJsonText(raw);

  if (!isChannelInfoObject(parsed)) {
    throw new Error(`Invalid EV schema: ${evPath}`);
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const seen = new Map();
  for (const item of parsed.info) {
    const mapped = mapEvItemToLiveEvent(item, nowSeconds);
    if (!mapped) continue;
    const existing = seen.get(mapped.id);
    if (!existing || (existing.is_live !== "t" && mapped.is_live === "t")) {
      seen.set(mapped.id, mapped);
    }
  }

  const liveEvents = [...seen.values()].sort(sortByStartStamp);

  await fs.mkdir(path.dirname(liveEventsOutPath), { recursive: true });
  await fs.writeFile(
    liveEventsOutPath,
    `${JSON.stringify(liveEvents, null, 2)}\n`,
    "utf8"
  );
  console.log(`Updated: ${liveEventsOutPath} (${liveEvents.length} events)`);
}

async function main() {
  const {
    version,
    out,
    prune,
    preserveImages,
    files,
    onlyEv,
    syncLiveEvents,
    liveEventsOut,
  } = parseArgs(
    process.argv.slice(2)
  );
  const outputDir = out || DEFAULT_OUTPUT_DIR;
  const selectedFileNames =
    files.length > 0
      ? files
      : onlyEv
        ? [DEFAULT_SELECTED_FILE]
        : [];
  const selectedFiles =
    selectedFileNames.length > 0
      ? new Set(selectedFileNames.map(normalizeSelectedFileName).filter(Boolean))
      : null;
  const effectivePrune = selectedFiles ? false : prune;

  const apiHeaders = {
    "User-Agent": "orcatv-sync-script",
    Accept: "application/vnd.github+json",
  };

  if (process.env.GITHUB_TOKEN) {
    apiHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  console.log(`Sync source : ${OWNER}/${REPO}/${BRANCH}/${version}`);
  console.log(`Output dir  : ${outputDir}`);
  console.log(`Preserve image: ${preserveImages ? "yes" : "no"}`);
  console.log(`Sync live-events: ${syncLiveEvents ? "yes" : "no"}`);
  if (selectedFiles) {
    console.log(`Selected file(s): ${[...selectedFiles].join(", ")}`);
    console.log("Prune mode  : disabled (single-file sync)");
  }

  let syncedCount = 0;
  try {
    syncedCount = await syncFromApi(
      version,
      outputDir,
      apiHeaders,
      effectivePrune,
      preserveImages,
      selectedFiles
    );
    console.log("Method      : GitHub API");
  } catch (apiError) {
    console.warn(`API failed   : ${apiError?.message || apiError}`);
    console.warn("Fallback to  : git sparse-checkout");
    syncedCount = await syncFromGitSparse(
      version,
      outputDir,
      effectivePrune,
      preserveImages,
      selectedFiles
    );
    console.log("Method      : git sparse-checkout");
  }

  if (syncLiveEvents) {
    const needEv =
      !selectedFiles || selectedFiles.has(normalizeSelectedFileName(DEFAULT_SELECTED_FILE));
    if (needEv) {
      const evPath = path.join(outputDir, DEFAULT_SELECTED_FILE);
      await syncLiveEventsFromEv(evPath, liveEventsOut);
    } else {
      console.log("Skip live-events sync (EV.json tidak termasuk selection).");
    }
  }

  console.log(`Done. Synced ${syncedCount} files.`);
}

main().catch((error) => {
  console.error("\nSync failed:");
  console.error(error?.message || error);
  process.exit(1);
});

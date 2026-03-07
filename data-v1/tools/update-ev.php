<?php
declare(strict_types=1);

/**
 * Auto update EV.json flow (PHP endpoint or CLI):
 * 1) Download EV.json from upstream URL
 * 2) Save to data-v1/source/EV.json (if changed)
 * 3) Run extract-images for EV.json
 * 4) Run encrypt-data-v1-source-folder for EV.json
 * 5) Commit + push encrypted outputs if there are git changes
 *
 * Required env:
 * - ORCA_ANDROID_SOURCE_KEY
 * - EV_UPDATE_TOKEN (for web requests; CLI skips token check)
 */

function envStr(string $key, string $default = ''): string
{
    $value = getenv($key);
    if ($value === false) {
        return $default;
    }
    $trimmed = trim((string)$value);
    return $trimmed === '' ? $default : $trimmed;
}

function boolStr(string $value): bool
{
    $v = strtolower(trim($value));
    return in_array($v, ['1', 'true', 'yes', 'on'], true);
}

function jsonExit(int $status, array $payload): void
{
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), PHP_EOL;
    exit;
}

function requestValue(string $key, string $default = ''): string
{
    if (PHP_SAPI === 'cli') {
        global $argv;
        if (!is_array($argv)) {
            return $default;
        }
        foreach ($argv as $arg) {
            if (!str_starts_with($arg, "--{$key}=")) {
                continue;
            }
            return trim(substr($arg, strlen($key) + 3));
        }
        return $default;
    }

    $post = $_POST[$key] ?? null;
    if (is_string($post) && trim($post) !== '') {
        return trim($post);
    }
    $get = $_GET[$key] ?? null;
    if (is_string($get) && trim($get) !== '') {
        return trim($get);
    }
    return $default;
}

function requireTokenIfWeb(): void
{
    if (PHP_SAPI === 'cli') {
        return;
    }

    $expected = envStr('EV_UPDATE_TOKEN');
    if ($expected === '') {
        jsonExit(500, [
            'ok' => false,
            'error' => 'EV_UPDATE_TOKEN is not set on server.',
        ]);
    }

    $provided = '';
    if (isset($_SERVER['HTTP_X_UPDATE_TOKEN']) && is_string($_SERVER['HTTP_X_UPDATE_TOKEN'])) {
        $provided = trim($_SERVER['HTTP_X_UPDATE_TOKEN']);
    }
    if ($provided === '') {
        $provided = requestValue('token');
    }

    if ($provided === '' || !hash_equals($expected, $provided)) {
        jsonExit(403, [
            'ok' => false,
            'error' => 'Invalid token.',
        ]);
    }
}

function fetchText(string $url, int $timeoutSeconds = 30): string
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => $timeoutSeconds,
            CURLOPT_TIMEOUT => $timeoutSeconds,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);
        $response = curl_exec($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if (!is_string($response)) {
            throw new RuntimeException('Failed to fetch upstream URL: ' . ($error !== '' ? $error : 'unknown curl error'));
        }
        if ($httpCode < 200 || $httpCode >= 300) {
            throw new RuntimeException("Upstream responded with HTTP {$httpCode}");
        }
        return $response;
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => $timeoutSeconds,
            'header' => "Accept: application/json\r\n",
        ],
    ]);
    $response = @file_get_contents($url, false, $context);
    if (!is_string($response)) {
        throw new RuntimeException('Failed to fetch upstream URL (file_get_contents).');
    }
    if (isset($http_response_header) && is_array($http_response_header) && isset($http_response_header[0])) {
        if (preg_match('/\s(\d{3})\s/', (string)$http_response_header[0], $m)) {
            $code = (int)$m[1];
            if ($code < 200 || $code >= 300) {
                throw new RuntimeException("Upstream responded with HTTP {$code}");
            }
        }
    }
    return $response;
}

function reverseText(string $text): string
{
    return strrev($text);
}

function decryptLitePayloadIfNeeded(string $raw): string
{
    $marker = 'jhmfgfdgdvcgcghf';
    $content = $raw;
    $headerEnd = strpos($content, $marker);
    if ($headerEnd === false) {
        return $content;
    }

    $encryptedStart = $headerEnd + strlen($marker) + 112;
    if ($encryptedStart >= strlen($content)) {
        return $content;
    }

    $encryptedData = substr($content, $encryptedStart);
    if ($encryptedData === false || $encryptedData === '') {
        return $content;
    }

    $decoded1 = base64_decode(reverseText($encryptedData), true);
    if ($decoded1 === false || $decoded1 === '') {
        return $content;
    }

    $decoded2 = base64_decode(reverseText($decoded1), true);
    if ($decoded2 === false || $decoded2 === '') {
        return $content;
    }

    return reverseText($decoded2);
}

function canonicalizeJson(string $raw): array
{
    $clean = preg_replace('/^\xEF\xBB\xBF/', '', $raw);
    if (!is_string($clean)) {
        $clean = $raw;
    }
    $clean = decryptLitePayloadIfNeeded($clean);
    $decoded = json_decode($clean, true);
    if (!is_array($decoded) && !is_object($decoded)) {
        throw new RuntimeException('Invalid JSON payload.');
    }
    $canonical = json_encode($decoded, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($canonical)) {
        throw new RuntimeException('Failed to canonicalize JSON.');
    }
    $pretty = json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($pretty)) {
        throw new RuntimeException('Failed to format JSON.');
    }
    return [
        'hash' => hash('sha256', $canonical),
        'pretty' => $pretty . PHP_EOL,
    ];
}

function runCommand(string $command, string $cwd): array
{
    $descriptorSpec = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];
    $process = proc_open($command, $descriptorSpec, $pipes, $cwd);
    if (!is_resource($process)) {
        throw new RuntimeException("Failed to run command: {$command}");
    }

    fclose($pipes[0]);
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exitCode = proc_close($process);

    return [
        'command' => $command,
        'exitCode' => $exitCode,
        'stdout' => is_string($stdout) ? trim($stdout) : '',
        'stderr' => is_string($stderr) ? trim($stderr) : '',
    ];
}

function assertCommandOk(array $result): void
{
    if (($result['exitCode'] ?? 1) === 0) {
        return;
    }
    $stderr = (string)($result['stderr'] ?? '');
    $stdout = (string)($result['stdout'] ?? '');
    $message = "Command failed: {$result['command']}";
    if ($stderr !== '') {
        $message .= " | stderr: {$stderr}";
    } elseif ($stdout !== '') {
        $message .= " | stdout: {$stdout}";
    }
    throw new RuntimeException($message);
}

requireTokenIfWeb();

$projectRoot = realpath(__DIR__ . '/../../');
if (!is_string($projectRoot) || $projectRoot === '') {
    jsonExit(500, ['ok' => false, 'error' => 'Invalid project root.']);
}

$sourceUrl = requestValue('source_url', envStr('EV_SOURCE_URL', 'https://raw.githubusercontent.com/brodatv1/lite/refs/heads/main/v215/EV.json'));
$force = boolStr(requestValue('force', envStr('EV_FORCE_UPDATE', '0')));
$pushChanges = boolStr(requestValue('push', envStr('EV_AUTO_PUSH', '1')));
$commitMsg = requestValue('commit_msg', envStr('EV_COMMIT_MSG', 'chore(data-v1): auto-update EV from upstream'));
$gitRemote = envStr('EV_GIT_REMOTE', 'origin');
$gitBranch = envStr('EV_GIT_BRANCH', '');
$sourceFile = $projectRoot . DIRECTORY_SEPARATOR . 'data-v1' . DIRECTORY_SEPARATOR . 'source' . DIRECTORY_SEPARATOR . 'EV.json';

if (envStr('ORCA_ANDROID_SOURCE_KEY') === '') {
    jsonExit(500, [
        'ok' => false,
        'error' => 'ORCA_ANDROID_SOURCE_KEY is required.',
    ]);
}

if ($gitBranch === '') {
    $branchResult = runCommand('git rev-parse --abbrev-ref HEAD', $projectRoot);
    if (($branchResult['exitCode'] ?? 1) === 0) {
        $detected = trim((string)($branchResult['stdout'] ?? ''));
        $gitBranch = ($detected === '' || $detected === 'HEAD') ? 'main' : $detected;
    } else {
        $gitBranch = 'main';
    }
}

try {
    $raw = fetchText($sourceUrl, 40);
    $upstream = canonicalizeJson($raw);
    $beforeHash = '';

    if (is_file($sourceFile)) {
        $existing = file_get_contents($sourceFile);
        if (is_string($existing) && trim($existing) !== '') {
            $beforeHash = canonicalizeJson($existing)['hash'];
        }
    }

    $changed = $force || $beforeHash === '' || $beforeHash !== $upstream['hash'];

    if ($changed) {
        $sourceDir = dirname($sourceFile);
        if (!is_dir($sourceDir) && !mkdir($sourceDir, 0775, true) && !is_dir($sourceDir)) {
            throw new RuntimeException("Failed to create directory: {$sourceDir}");
        }
        file_put_contents($sourceFile, $upstream['pretty']);
    }

    if (!$changed) {
        jsonExit(200, [
            'ok' => true,
            'changed' => false,
            'message' => 'EV.json unchanged. Skip extract/encrypt/push.',
            'sourceUrl' => $sourceUrl,
            'hash' => $upstream['hash'],
        ]);
    }

    $results = [];

    $results[] = runCommand('node data-v1/tools/extract-images.mjs --file EV.json', $projectRoot);
    assertCommandOk($results[array_key_last($results)]);

    $results[] = runCommand('node scripts/encrypt-data-v1-source-folder.mjs --file EV.json', $projectRoot);
    assertCommandOk($results[array_key_last($results)]);

    $results[] = runCommand('git add data-v1/source-encrypted/EV.enc data-v1/source-encrypted/manifest.json data-v1/source-images', $projectRoot);
    assertCommandOk($results[array_key_last($results)]);

    $diffCheck = runCommand('git diff --cached --quiet', $projectRoot);
    $hasGitChange = (($diffCheck['exitCode'] ?? 1) !== 0);

    if (!$hasGitChange) {
        jsonExit(200, [
            'ok' => true,
            'changed' => true,
            'gitChanged' => false,
            'message' => 'EV updated, but encrypted/image output has no git diff.',
            'sourceUrl' => $sourceUrl,
            'hash' => $upstream['hash'],
            'steps' => $results,
        ]);
    }

    $results[] = runCommand('git commit -m ' . escapeshellarg($commitMsg), $projectRoot);
    assertCommandOk($results[array_key_last($results)]);

    if ($pushChanges) {
        $results[] = runCommand(
            'git push ' . escapeshellarg($gitRemote) . ' ' . escapeshellarg($gitBranch),
            $projectRoot
        );
        assertCommandOk($results[array_key_last($results)]);
    }

    jsonExit(200, [
        'ok' => true,
        'changed' => true,
        'gitChanged' => true,
        'pushed' => $pushChanges,
        'sourceUrl' => $sourceUrl,
        'hash' => $upstream['hash'],
        'branch' => $gitBranch,
        'remote' => $gitRemote,
        'steps' => $results,
    ]);
} catch (Throwable $e) {
    jsonExit(500, [
        'ok' => false,
        'error' => $e->getMessage(),
        'sourceUrl' => $sourceUrl,
    ]);
}

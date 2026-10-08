import * as core from "@actions/core";
import { execFileSync } from "child_process";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  ContractsConfig,
  ContractEntry,
  ContractScanResult,
  HealthBand,
  ScanReport,
  SentinelScanOutput,
} from "./types";

/** Sentinel CLI binary name, pinned. */
const SENTINEL_BINARY = "soroban-state-sentinel";

/** GitHub org that publishes the sentinel release binaries. */
const SENTINEL_OWNER = "stellar-archival-labs";

/** GitHub repository that publishes the sentinel release binaries. */
const SENTINEL_REPO = "soroban-state-sentinel";

/**
 * Release tag installed by default. This is the version this action is
 * developed and tested against; override it with the `sentinel-version` input.
 */
export const DEFAULT_SENTINEL_VERSION = "v0.1.0";

/**
 * Map a runner platform/arch onto a published release target triple.
 * Returns `null` when no prebuilt asset exists for that platform, which
 * triggers the `cargo install` fallback.
 */
export function platformTarget(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch
): string | null {
  if (platform === "linux" && arch === "x64") return "x86_64-unknown-linux-gnu";
  if (platform === "darwin" && arch === "arm64") return "aarch64-apple-darwin";
  if (platform === "darwin" && arch === "x64") return "x86_64-apple-darwin";
  return null;
}

/**
 * Locate `soroban-state-sentinel` on PATH without invoking a shell.
 * Returns the absolute path to the first match, or `null`.
 */
export function findOnPath(binary: string = SENTINEL_BINARY): string | null {
  const exts =
    process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  const dirs = (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter((d) => d.length > 0);

  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, binary + ext);
      try {
        if (fs.existsSync(candidate)) return candidate;
      } catch {
        // Ignore unreadable PATH entries.
      }
    }
  }
  return null;
}

/**
 * Verify a downloaded file against its published `.sha256` sidecar.
 * The sidecar is the standard `<hex>  <filename>` format; only the leading
 * hex digest is compared.
 */
export function verifyChecksum(filePath: string, shaFilePath: string): boolean {
  const expected = fs
    .readFileSync(shaFilePath, "utf8")
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase();
  if (!expected) return false;

  const actual = crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");

  return actual === expected;
}

/** Download `url` to `dest` using curl with an argument array (no shell). */
function download(url: string, dest: string): void {
  execFileSync("curl", ["-fsSL", "-o", dest, url], { stdio: "inherit" });
}

/**
 * Fallback: build and install the CLI straight from the released git tag.
 * Used only when there is no prebuilt asset for this platform.
 */
export function installViaCargo(version: string): string {
  core.info(
    `No prebuilt asset for ${process.platform}/${process.arch}; ` +
      `falling back to: cargo install --git https://github.com/${SENTINEL_OWNER}/${SENTINEL_REPO} --tag ${version} sentinel-cli --locked`
  );

  execFileSync(
    "cargo",
    [
      "install",
      "--git", `https://github.com/${SENTINEL_OWNER}/${SENTINEL_REPO}`,
      "--tag", version,
      "sentinel-cli",
      "--locked",
    ],
    { stdio: "inherit" }
  );

  const cargoBin = path.join(os.homedir(), ".cargo", "bin", SENTINEL_BINARY);
  if (fs.existsSync(cargoBin)) return cargoBin;

  const onPath = findOnPath();
  if (onPath) return onPath;

  throw new Error(
    `cargo install completed but ${SENTINEL_BINARY} could not be located.`
  );
}

/**
 * Install the sentinel CLI from its GitHub release.
 *
 * Order: an existing binary on PATH wins; otherwise the matching release asset
 * is downloaded and its sha256 verified against the published `.sha256` sidecar
 * before it is extracted and added to PATH. Platforms without a prebuilt asset
 * fall back to `cargo install --git ... --tag <version>`.
 */
export async function installSentinelCli(
  version: string = DEFAULT_SENTINEL_VERSION
): Promise<string> {
  const onPath = findOnPath();
  if (onPath) {
    core.info(`Found sentinel CLI on PATH: ${onPath}`);
    return onPath;
  }

  const target = platformTarget();
  if (!target) {
    return installViaCargo(version);
  }

  const asset = `${SENTINEL_BINARY}-${version}-${target}.tar.gz`;
  const base = `https://github.com/${SENTINEL_OWNER}/${SENTINEL_REPO}/releases/download/${version}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-"));
  const tarPath = path.join(tmp, asset);
  const shaPath = `${tarPath}.sha256`;

  core.info(`Downloading ${SENTINEL_BINARY} ${version} (${target}) from ${base}`);
  download(`${base}/${asset}`, tarPath);
  download(`${base}/${asset}.sha256`, shaPath);

  if (!verifyChecksum(tarPath, shaPath)) {
    throw new Error(
      `Checksum verification failed for ${asset}; refusing to run an unverified binary.`
    );
  }

  const stageDir = path.join(tmp, `${SENTINEL_BINARY}-${version}-${target}`);
  execFileSync("tar", ["-xzf", tarPath, "-C", tmp], { stdio: "inherit" });

  const bin = path.join(stageDir, SENTINEL_BINARY);
  if (!fs.existsSync(bin)) {
    throw new Error(`Expected ${bin} after extracting ${asset}, but it is missing.`);
  }
  fs.chmodSync(bin, 0o755);
  core.addPath(stageDir);
  core.info(`Installed sentinel CLI ${version} (${target}) at ${bin}`);
  return bin;
}

/**
 * Locate or install the sentinel CLI.
 * If sentinelCliPath is "install", download + verify the release binary.
 * Otherwise treats it as a filesystem path to the binary.
 */
export async function resolveSentinelCli(
  sentinelCliPath: string,
  sentinelVersion: string = DEFAULT_SENTINEL_VERSION
): Promise<string> {
  if (sentinelCliPath === "install") {
    return installSentinelCli(sentinelVersion);
  }

  // Validate the provided path exists
  if (!fs.existsSync(sentinelCliPath)) {
    throw new Error(`Sentinel CLI not found at: ${sentinelCliPath}`);
  }

  // Check it's executable
  try {
    fs.accessSync(sentinelCliPath, fs.constants.X_OK);
  } catch {
    throw new Error(`Sentinel CLI at ${sentinelCliPath} is not executable`);
  }

  core.info(`Using sentinel CLI at: ${sentinelCliPath}`);
  return sentinelCliPath;
}

/**
 * Simple concurrency limiter. Returns a function that runs async work
 * with at most `limit` concurrent executions.
 */
function createConcurrencyLimit(limit: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  function next() {
    while (active < limit && queue.length > 0) {
      active++;
      queue.shift()!();
    }
  }

  function release() {
    active--;
    next();
  }

  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn().then(resolve, reject).finally(release);
      });
      next();
    });
  };
}

/** Default concurrency for parallel contract scans. */
const DEFAULT_SCAN_CONCURRENCY = 5;

/**
 * Run a scan for all contracts in the config and return aggregated results.
 * Contracts are scanned in parallel with a concurrency limit.
 */
export async function runScan(
  sentinelPath: string,
  config: ContractsConfig,
  rpcUrl: string
): Promise<ScanReport> {
  const limit = createConcurrencyLimit(DEFAULT_SCAN_CONCURRENCY);

  const resultPromises = config.contracts.map((contract) =>
    limit(async () => {
      try {
        return await scanContract(sentinelPath, contract, rpcUrl);
      } catch (e) {
        core.warning(`Scan failed for ${contract.address}: ${e instanceof Error ? e.message : String(e)}`);
        return {
          address: contract.address,
          label: contract.label,
          band: "archived" as const,
          live_until_ledger_seq: 0,
          ledgers_remaining: 0,
          days_remaining: 0,
          healthy_days_threshold: 0,
          critical_days_threshold: 0,
          scanned_at: new Date().toISOString(),
          error: e instanceof Error ? e.message : String(e),
        };
      }
    })
  );

  const results = await Promise.all(resultPromises);

  const summary = {
    total: results.length,
    healthy: results.filter((r) => r.band === "healthy").length,
    expiring_soon: results.filter((r) => r.band === "expiring_soon").length,
    critical: results.filter((r) => r.band === "critical").length,
    archived: results.filter((r) => r.band === "archived").length,
  };

  return {
    rpc_url: rpcUrl,
    results,
    summary,
  };
}

/** Map a sentinel band string to our HealthBand type. */
function parseHealthBand(raw: string): HealthBand {
  switch (raw) {
    case "healthy":
    case "expiring_soon":
    case "critical":
    case "archived":
      return raw;
    default:
      core.warning(`Unknown health band from sentinel: "${raw}" — defaulting to archived`);
      return "archived";
  }
}

/**
 * Determine the overall health band for a contract from its scanned entries.
 * The worst entry wins: archived > critical > expiring_soon > healthy.
 */
function worstBand(entries: SentinelScanOutput["entries"]): HealthBand {
  const order: HealthBand[] = ["archived", "critical", "expiring_soon", "healthy"];
  let worst: HealthBand = "healthy";
  for (const entry of entries) {
    const band = parseHealthBand(entry.band);
    if (order.indexOf(band) < order.indexOf(worst)) {
      worst = band;
    }
  }
  return worst;
}

/**
 * Scan a single contract via the sentinel CLI.
 *
 * The sentinel outputs a top-level ScanJson with an `entries[]` array
 * (one per ledger entry of the contract).  We derive a single
 * ContractScanResult by taking the worst health band and minimum
 * remaining values across all entries.
 */
async function scanContract(
  sentinelPath: string,
  contract: ContractEntry,
  rpcUrl: string
): Promise<ContractScanResult> {
  const args: string[] = [
    "scan",
    "--rpc-url", rpcUrl,
    "--json",
    contract.address,
  ];

  // Pass through keys if specified
  if (contract.keys && contract.keys.length > 0) {
    for (const key of contract.keys) {
      args.push("--keys", key);
    }
  }

  // Pass through threshold overrides if specified
  if (contract.healthy_days !== undefined) {
    args.push("--healthy-days", String(contract.healthy_days));
  }
  if (contract.critical_days !== undefined) {
    args.push("--critical-days", String(contract.critical_days));
  }

  // NOTE: --safety-margin-ledgers does NOT exist in the real sentinel CLI.
  // Verified against sentinel args.rs: the sentinel uses health_config fields
  // (healthy_min_ledgers, critical_max_ledgers) internally instead.

  core.info(`Scanning ${contract.address} (${contract.label || "unlabeled"})...`);

  core.debug(`Running: ${sentinelPath} ${args.join(" ")}`);

  const output = execFileSync(sentinelPath, args, {
    encoding: "utf8",
    timeout: 120_000, // 2 minute timeout per contract
    maxBuffer: 1024 * 1024, // 1MB buffer
  });

  // Parse the full ScanJson from the sentinel
  const scanJson: SentinelScanOutput = JSON.parse(output);

  if (!scanJson.entries || scanJson.entries.length === 0) {
    // Sentinel returned no entries — treat as healthy with a warning
    core.warning(`Sentinel returned 0 entries for ${contract.address}`);
    return {
      address: contract.address,
      label: contract.label,
      band: "healthy",
      live_until_ledger_seq: 0,
      ledgers_remaining: 0,
      days_remaining: 0,
      healthy_days_threshold: scanJson.health_config?.healthy_min_days ?? contract.healthy_days ?? 30,
      critical_days_threshold: scanJson.health_config?.critical_max_days ?? contract.critical_days ?? 7,
      scanned_at: new Date(scanJson.generated_at_unix * 1000).toISOString(),
    };
  }

  // Derive per-contract result from entries (worst band wins)
  const band = worstBand(scanJson.entries);

  // Minimum across all entries for remaining fields
  let minLiveUntil = Infinity;
  let minLedgersRemaining = Infinity;
  let minDaysRemaining = Infinity;

  for (const entry of scanJson.entries) {
    if (entry.live_until_ledger_seq != null && entry.live_until_ledger_seq < minLiveUntil) {
      minLiveUntil = entry.live_until_ledger_seq;
    }
    if (entry.ledgers_remaining != null && entry.ledgers_remaining < minLedgersRemaining) {
      minLedgersRemaining = entry.ledgers_remaining;
    }
    if (entry.days_remaining != null && entry.days_remaining < minDaysRemaining) {
      minDaysRemaining = entry.days_remaining;
    }
  }

  return {
    address: contract.address,
    label: contract.label,
    band,
    live_until_ledger_seq: minLiveUntil === Infinity ? 0 : minLiveUntil,
    ledgers_remaining: minLedgersRemaining === Infinity ? 0 : minLedgersRemaining,
    days_remaining: minDaysRemaining === Infinity ? 0 : minDaysRemaining,
    healthy_days_threshold: scanJson.health_config?.healthy_min_days ?? contract.healthy_days ?? 30,
    critical_days_threshold: scanJson.health_config?.critical_max_days ?? contract.critical_days ?? 7,
    scanned_at: new Date(scanJson.generated_at_unix * 1000).toISOString(),
  };
}

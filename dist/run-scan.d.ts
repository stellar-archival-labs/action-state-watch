import { ContractsConfig, ScanReport } from "./types";
/**
 * Release tag installed by default. This is the version this action is
 * developed and tested against; override it with the `sentinel-version` input.
 */
export declare const DEFAULT_SENTINEL_VERSION = "v0.1.0";
/**
 * Map a runner platform/arch onto a published release target triple.
 * Returns `null` when no prebuilt asset exists for that platform, which
 * triggers the `cargo install` fallback.
 */
export declare function platformTarget(platform?: NodeJS.Platform, arch?: string): string | null;
/**
 * Locate `soroban-state-sentinel` on PATH without invoking a shell.
 * Returns the absolute path to the first match, or `null`.
 */
export declare function findOnPath(binary?: string): string | null;
/**
 * Verify a downloaded file against its published `.sha256` sidecar.
 * The sidecar is the standard `<hex>  <filename>` format; only the leading
 * hex digest is compared.
 */
export declare function verifyChecksum(filePath: string, shaFilePath: string): boolean;
/**
 * Fallback: build and install the CLI straight from the released git tag.
 * Used only when there is no prebuilt asset for this platform.
 */
export declare function installViaCargo(version: string): string;
/**
 * Install the sentinel CLI from its GitHub release.
 *
 * Order: an existing binary on PATH wins; otherwise the matching release asset
 * is downloaded and its sha256 verified against the published `.sha256` sidecar
 * before it is extracted and added to PATH. Platforms without a prebuilt asset
 * fall back to `cargo install --git ... --tag <version>`.
 */
export declare function installSentinelCli(version?: string): Promise<string>;
/**
 * Locate or install the sentinel CLI.
 * If sentinelCliPath is "install", download + verify the release binary.
 * Otherwise treats it as a filesystem path to the binary.
 */
export declare function resolveSentinelCli(sentinelCliPath: string, sentinelVersion?: string): Promise<string>;
/**
 * Run a scan for all contracts in the config and return aggregated results.
 * Contracts are scanned in parallel with a concurrency limit.
 */
export declare function runScan(sentinelPath: string, config: ContractsConfig, rpcUrl: string): Promise<ScanReport>;

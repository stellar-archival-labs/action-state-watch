import { execFileSync } from "child_process";
import * as crypto from "crypto";
import * as path from "path";

// ── Mocks ────────────────────────────────────────────────────────────────

jest.mock("@actions/core", () => ({
  info: jest.fn(),
  warning: jest.fn(),
  debug: jest.fn(),
  getInput: jest.fn(),
  setFailed: jest.fn(),
  setOutput: jest.fn(),
  addPath: jest.fn(),
}));

jest.mock("child_process", () => ({
  execFileSync: jest.fn(),
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  accessSync: jest.fn(),
  chmodSync: jest.fn(),
  mkdtempSync: jest.fn(),
  readFileSync: jest.fn(),
  constants: { X_OK: 1 },
}));

jest.mock("os", () => ({
  tmpdir: jest.fn(() => "/tmp"),
  homedir: jest.fn(() => "/home/runner"),
}));

import * as core from "@actions/core";
import { installSentinelCli, platformTarget, findOnPath } from "../src/run-scan";

const mockExecFileSync = execFileSync as jest.MockedFunction<typeof execFileSync>;
const mockCore = core as jest.Mocked<typeof core>;
const fsMock = require("fs");

const TARBALL = Buffer.from("fake tarball bytes");
const SHA = crypto.createHash("sha256").update(TARBALL).digest("hex");
const VERSION = "v0.1.0";
const TARGET = "x86_64-unknown-linux-gnu";
const TMP = "/tmp/sentinel-abc";
const STAGE = path.join(TMP, `soroban-state-sentinel-${VERSION}-${TARGET}`);
const STAGE_BIN = path.join(STAGE, "soroban-state-sentinel");

const ORIGINAL_PLATFORM = process.platform;
const ORIGINAL_ARCH = process.arch;

/** Force a platform/arch so these tests behave identically on every OS. */
function setPlatform(platform: NodeJS.Platform, arch: string) {
  Object.defineProperty(process, "platform", {
    value: platform,
    configurable: true,
  });
  Object.defineProperty(process, "arch", { value: arch, configurable: true });
}

describe("install", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setPlatform("linux", "x64");
    fsMock.mkdtempSync.mockReturnValue(TMP);
  });

  afterAll(() => {
    setPlatform(ORIGINAL_PLATFORM, ORIGINAL_ARCH);
  });

  describe("platformTarget", () => {
    test("maps the three published targets", () => {
      expect(platformTarget("linux", "x64")).toBe("x86_64-unknown-linux-gnu");
      expect(platformTarget("darwin", "arm64")).toBe("aarch64-apple-darwin");
      expect(platformTarget("darwin", "x64")).toBe("x86_64-apple-darwin");
    });

    test("returns null for an unsupported platform", () => {
      expect(platformTarget("win32", "x64")).toBeNull();
      expect(platformTarget("linux", "arm64")).toBeNull();
    });
  });

  describe("installSentinelCli", () => {
    test("uses the binary already on PATH without downloading", async () => {
      const existing = path.join("/usr/local/bin", "soroban-state-sentinel");
      process.env.PATH = "/usr/local/bin";
      fsMock.existsSync.mockImplementation((p: string) => p === existing);

      const result = await installSentinelCli(VERSION);

      expect(result).toBe(existing);
      expect(mockExecFileSync).not.toHaveBeenCalled();
    });

    test("downloads, verifies, extracts, and adds the verified binary to PATH", async () => {
      process.env.PATH = ""; // nothing on PATH
      fsMock.existsSync.mockImplementation((p: string) => p === STAGE_BIN);
      fsMock.readFileSync.mockImplementation((p: string) => {
        if (p.endsWith(".sha256")) return `${SHA}  get-sentinel\n`;
        return TARBALL;
      });

      const result = await installSentinelCli(VERSION);

      expect(result).toBe(STAGE_BIN);

      // curl twice (asset + .sha256), then tar.
      const calls = mockExecFileSync.mock.calls.map((c) => c[0]);
      expect(calls).toEqual(["curl", "curl", "tar"]);

      const curlUrl = mockExecFileSync.mock.calls[0][1] as string[];
      expect(curlUrl).toContain(
        `https://github.com/stellar-archival-labs/soroban-state-sentinel/releases/download/${VERSION}/soroban-state-sentinel-${VERSION}-${TARGET}.tar.gz`
      );

      expect(fsMock.chmodSync).toHaveBeenCalledWith(STAGE_BIN, 0o755);
      expect(mockCore.addPath).toHaveBeenCalledWith(STAGE);
    });

    test("refuses to run an unverified binary on checksum mismatch", async () => {
      process.env.PATH = "";
      fsMock.existsSync.mockReturnValue(false);
      fsMock.readFileSync.mockImplementation((p: string) =>
        p.endsWith(".sha256") ? `deadbeef  asset.tar.gz\n` : TARBALL
      );

      await expect(installSentinelCli(VERSION)).rejects.toThrow(
        /Checksum verification failed/
      );

      // tar must never run after a failed verification
      expect(mockExecFileSync.mock.calls.map((c) => c[0])).not.toContain("tar");
    });

    test("falls back to cargo install on an unsupported platform", async () => {
      process.env.PATH = "";
      fsMock.existsSync.mockReturnValue(false);
      setPlatform("win32", "x64");

      await expect(installSentinelCli(VERSION)).rejects.toThrow(
        /cargo install completed but/
      );

      const cargoCall = mockExecFileSync.mock.calls.find((c) => c[0] === "cargo");
      expect(cargoCall).toBeDefined();
      const args = cargoCall![1] as string[];
      expect(args).toContain("install");
      expect(args).toContain("--tag");
      expect(args).toContain(VERSION);
      expect(args).toContain("sentinel-cli");
      expect(args).toContain("--locked");
      expect(args).toContain(
        "https://github.com/stellar-archival-labs/soroban-state-sentinel"
      );
      // No download attempted on the fallback path
      expect(mockExecFileSync.mock.calls.map((c) => c[0])).not.toContain("curl");
    });
  });

  describe("findOnPath", () => {
    test("returns null when PATH has no match", () => {
      process.env.PATH = "/nowhere";
      fsMock.existsSync.mockReturnValue(false);
      expect(findOnPath()).toBeNull();
    });
  });
});

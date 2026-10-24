#!/usr/bin/env bun
/**
 * Cross-runtime validation script.
 *
 * Tests that the library can be imported and used correctly across
 * different JavaScript runtimes (Bun, Node.js, Deno).
 *
 * Run with: bun run scripts/validate-runtime.ts
 */

import { spawn } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

// ── Test Code ─────────────────────────────────────────────────────────

function getTestCode(importPath: string): string {
  return `
import { DevicesApi, PlatformClient, PlatformError } from "${importPath}";

let passed = 0;
let failed = 0;

for (const [name, value] of [["PlatformClient", PlatformClient], ["PlatformError", PlatformError], ["DevicesApi", DevicesApi]]) {
  if (typeof value === "function") {
    passed++;
  } else {
    failed++;
    console.error(\`FAIL: \${name} is not exported\`);
  }
}

// A call through a stub fetch: the request carries the token and the envelope decodes.
try {
  let auth = "";
  const fetchStub = async (_url, init) => {
    auth = new Headers(init.headers).get("Authorization") ?? "";
    return new Response(JSON.stringify({ data: { current: 1, items: [], last: 1 } }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };
  const platform = new PlatformClient({ token: "qmt_test", fetch: fetchStub });
  const page = await platform.api(DevicesApi).listDevices({ teamId: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f" });
  if (auth === "Bearer qmt_test" && Array.isArray(page.data.items)) {
    passed++;
  } else {
    failed++;
    console.error("FAIL: listDevices returned:", page, "with auth", auth);
  }
} catch (error) {
  failed++;
  console.error("FAIL: listDevices threw:", error);
}

console.log(\`Passed: \${passed}, Failed: \${failed}\`);
process.exit(failed > 0 ? 1 : 0);
`.trim()
}

// ── Runtime Detection ─────────────────────────────────────────────────

type RuntimeInfo = {
  name: string
  command: string
  args: string[]
  available: boolean
  version?: string
}

async function checkRuntime(
  name: string,
  command: string,
  versionArg: string
): Promise<RuntimeInfo> {
  return new Promise((resolve) => {
    const proc = spawn(command, [versionArg], { stdio: ["ignore", "pipe", "ignore"] })
    let version = ""

    proc.stdout.on("data", (data: Buffer) => {
      version += data.toString()
    })

    proc.on("error", () => {
      resolve({ name, command, args: [], available: false })
    })

    proc.on("close", (code) => {
      resolve({
        name,
        command,
        args: [],
        available: code === 0,
        version: version.trim().split("\n")[0]
      })
    })
  })
}

// ── Test Runner ───────────────────────────────────────────────────────

async function runTest(
  runtime: RuntimeInfo,
  testFile: string,
  testDir: string,
  importMapPath: string
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    let args = [...runtime.args]
    // Add import map for Deno
    if (runtime.name === "Deno") {
      args = ["run", "--allow-read", "--allow-env", "--allow-net", `--import-map=${importMapPath}`]
    }
    args.push(testFile)

    const proc = spawn(runtime.command, args, { cwd: testDir, stdio: ["ignore", "pipe", "pipe"] })
    let output = ""

    proc.stdout.on("data", (data: Buffer) => {
      output += data.toString()
    })
    proc.stderr.on("data", (data: Buffer) => {
      output += data.toString()
    })

    proc.on("error", (error) => {
      resolve({ success: false, output: error.message })
    })

    proc.on("close", (code) => {
      resolve({ success: code === 0, output: output.trim() })
    })
  })
}

// ── Main ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("Cross-Runtime Validation")
  console.log("========================\n")

  // Check available runtimes
  const runtimes: RuntimeInfo[] = await Promise.all([
    checkRuntime("Bun", "bun", "--version").then((r) => ({ ...r, args: ["run"] })),
    checkRuntime("Node.js", "node", "--version").then((r) => ({
      ...r,
      args: ["--experimental-vm-modules"]
    })),
    checkRuntime("Deno", "deno", "--version").then((r) => ({
      ...r,
      args: ["run", "--allow-read", "--allow-env", "--allow-net", "--node-modules-dir=auto"]
    }))
  ])

  console.log("Available runtimes:")
  for (const runtime of runtimes) {
    const status = runtime.available ? `✓ ${runtime.version ?? "unknown"}` : "✗ not found"
    console.log(`  ${runtime.name}: ${status}`)
  }
  console.log()

  const available = runtimes.filter((r) => r.available)
  if (available.length === 0) {
    console.error("No runtimes available for testing")
    process.exit(1)
  }

  // Create temporary test directory
  const tmpDir = await mkdtemp(join(tmpdir(), "npm-example-test-"))
  const distPath = join(process.cwd(), "dist", "index.js")

  try {
    // Write test file that imports directly from dist using absolute path
    const testFile = join(tmpDir, "test.mjs")
    await writeFile(testFile, getTestCode(distPath))

    // Create import map for Deno (no external dependencies needed)
    const importMapPath = join(tmpDir, "import_map.json")
    await writeFile(
      importMapPath,
      JSON.stringify({
        imports: {}
      })
    )

    // Run tests
    console.log("Running validation tests:")
    console.log("-".repeat(40))

    let passed = 0
    let failed = 0

    for (const runtime of available) {
      process.stdout.write(`${runtime.name}: `)
      const result = await runTest(runtime, testFile, tmpDir, importMapPath)

      if (result.success) {
        console.log("✓ PASS")
        passed++
      } else {
        console.log("✗ FAIL")
        console.log(`  Output: ${result.output}`)
        failed++
      }
    }

    console.log("-".repeat(40))
    console.log()
    console.log(`Results: ${String(passed)} passed, ${String(failed)} failed`)
    console.log()

    if (failed > 0) {
      process.exit(1)
    }
  } finally {
    // Cleanup
    await rm(tmpDir, { recursive: true, force: true })
  }
}

main().catch((error: unknown) => {
  console.error("Validation failed:", error)
  process.exit(1)
})

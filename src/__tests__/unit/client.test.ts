import { afterEach, describe, expect, it, vi } from "vitest"

import {
  DEFAULT_BASE_URL,
  DevicesApi,
  HealthApi,
  PlatformClient,
  PlatformError
} from "../../index.js"

type Call = { url: string; init: RequestInit }

/** A `fetch` that records each call and answers with `status` and `body`. */
function stubFetch(status: number, body: unknown): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = []
  const fetchStub = (async (input: string, init?: RequestInit) => {
    calls.push({ url: input, init: init ?? {} })
    const text = typeof body === "string" ? body : JSON.stringify(body)
    await Promise.resolve()
    return new Response(text, { status, headers: { "Content-Type": "application/json" } })
  }) as unknown as typeof fetch
  return { fetch: fetchStub, calls }
}

const teamId = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f"

const device = {
  id: "0b9f8a1e-8c1d-4b6f-9a51-2f6c1e3d4a5b",
  teamId,
  spaceId: "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a",
  spaceName: "bench",
  name: "bench-pico",
  payload: "{}",
  status: "claimed",
  createdAt: "2026-10-19 00:00:00",
  updatedAt: "2026-10-19 00:00:00"
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("PlatformClient", () => {
  it("sends the token as a bearer header to the production API by default", async () => {
    vi.stubEnv("QUALITHM_API_URL", "")
    const { fetch, calls } = stubFetch(200, { data: { current: 1, items: [], last: 1 } })
    const platform = new PlatformClient({ token: "qmt_test", fetch })

    const page = await platform.api(DevicesApi).listDevices({ teamId, page: 2, limit: 10 })

    expect(page.data.items).toEqual([])
    expect(calls[0]?.url).toBe(`${DEFAULT_BASE_URL}/v1/teams/${teamId}/devices?page=2&limit=10`)
    expect(new Headers(calls[0]?.init.headers).get("Authorization")).toBe("Bearer qmt_test")
  })

  it("reads the token and base URL from the environment", async () => {
    vi.stubEnv("QUALITHM_API_TOKEN", "qmt_env")
    vi.stubEnv("QUALITHM_API_URL", "https://api.dev.qualithm.com/")
    const { fetch, calls } = stubFetch(200, { data: device })

    const got = await new PlatformClient({ fetch })
      .api(DevicesApi)
      .getDevice({ teamId, deviceId: device.id })

    expect(got.data.name).toBe("bench-pico")
    expect(calls[0]?.url).toBe(
      `https://api.dev.qualithm.com/v1/teams/${teamId}/devices/${device.id}`
    )
    expect(new Headers(calls[0]?.init.headers).get("Authorization")).toBe("Bearer qmt_env")
  })

  it("prefers the config over the environment", async () => {
    vi.stubEnv("QUALITHM_API_TOKEN", "qmt_env")
    vi.stubEnv("QUALITHM_API_URL", "https://api.dev.qualithm.com")
    const { fetch, calls } = stubFetch(200, { status: "ok" })

    await new PlatformClient({ token: "qmt_arg", baseUrl: "http://localhost:3000", fetch })
      .api(HealthApi)
      .getHealthz()

    expect(calls[0]?.url).toBe("http://localhost:3000/healthz")
  })

  it("refuses to start without a token", () => {
    vi.stubEnv("QUALITHM_API_TOKEN", "")
    expect(() => new PlatformClient()).toThrow(PlatformError)
    try {
      new PlatformClient()
    } catch (error) {
      expect((error as PlatformError).code).toBe("unauthorized")
      expect((error as PlatformError).message).toBe(
        "api token missing: pass token or set QUALITHM_API_TOKEN"
      )
    }
  })

  it("creates each API class once", () => {
    const platform = new PlatformClient({ token: "qmt_test" })
    expect(platform.api(DevicesApi)).toBe(platform.api(DevicesApi))
  })
})

describe("PlatformError", () => {
  async function failure(status: number, body: unknown): Promise<PlatformError> {
    const { fetch } = stubFetch(status, body)
    const platform = new PlatformClient({ token: "qmt_test", fetch })
    try {
      await platform.api(DevicesApi).getDevice({ teamId, deviceId: device.id })
    } catch (error) {
      return error as PlatformError
    }
    throw new Error("expected the call to fail")
  }

  it("carries the envelope's code, message and status", async () => {
    const error = await failure(404, { message: "device not found", code: "not_found" })
    expect(error).toBeInstanceOf(PlatformError)
    expect(error.code).toBe("not_found")
    expect(error.message).toBe("device not found")
    expect(error.status).toBe(404)
  })

  it("decodes a code this version doesn't know to unknown", async () => {
    const error = await failure(422, {
      message: "device limit reached",
      code: "device_limit_reached"
    })
    expect(error.code).toBe("unknown")
    expect(error.message).toBe("device limit reached")
  })

  it("names the status when the body isn't an envelope", async () => {
    const error = await failure(502, "<html>bad gateway</html>")
    expect(error.code).toBe("unknown")
    expect(error.message).toBe("request failed with status 502")
    expect(error.status).toBe(502)
  })

  it("wraps a request that never got a response", async () => {
    const offline = (async () => {
      await Promise.reject(new TypeError("Network Down"))
    }) as unknown as typeof fetch
    const platform = new PlatformClient({ token: "qmt_test", fetch: offline })

    const error: unknown = await platform
      .api(HealthApi)
      .getHealthz()
      .catch((e: unknown) => e)
    if (!(error instanceof PlatformError)) {
      throw new Error("expected a PlatformError")
    }

    expect(error).toBeInstanceOf(PlatformError)
    expect(error.status).toBe(0)
    expect(error.code).toBe("unknown")
    expect(error.message).toBe("request failed: network down")
    expect(error.cause).toBeInstanceOf(TypeError)
  })
})

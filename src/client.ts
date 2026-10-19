import { errorFromResponse, PlatformError } from "./error.js"
import { type BaseAPI, Configuration, type FetchAPI, type Middleware } from "./generated/runtime.js"

/** The production API; `QUALITHM_API_URL` or `baseUrl` points the client elsewhere. */
export const DEFAULT_BASE_URL = "https://api.qualithm.com"

/** How a `PlatformClient` reaches the API. Every field is optional. */
export type PlatformClientConfig = {
  /** An API token (`qmt_…`). Defaults to `QUALITHM_API_TOKEN`. */
  token?: string
  /** The API's base URL. Defaults to `QUALITHM_API_URL`, else the production API. */
  baseUrl?: string
  /** The `fetch` to send requests with. Defaults to the global one. */
  fetch?: FetchAPI
}

type ApiClass<T extends BaseAPI> = new (configuration: Configuration) => T

function env(name: string): string | undefined {
  const value = typeof process === "undefined" ? undefined : process.env[name]
  return value === "" ? undefined : value
}

/** Turns every error response and failed request into a `PlatformError`. */
const raisePlatformErrors: Middleware = {
  async post({ response }) {
    if (!response.ok) {
      throw await errorFromResponse(response)
    }
    return response
  },
  // eslint-disable-next-line @typescript-eslint/require-await -- the runtime awaits this hook
  async onError({ error }) {
    const cause = error instanceof Error ? error : new Error(String(error))
    throw new PlatformError(`request failed: ${cause.message.toLowerCase()}`, "unknown", 0, {
      cause
    })
  }
}

/**
 * The Qualithm Platform API, authenticated with one API token. Each generated API class is one
 * resource group from the spec:
 *
 * ```ts
 * const platform = new PlatformClient()
 * const { data } = await platform.api(DevicesApi).listDevices()
 * ```
 */
export class PlatformClient {
  /** The generated client configuration every API class shares. */
  readonly configuration: Configuration
  private readonly apis = new Map<ApiClass<BaseAPI>, BaseAPI>()

  /**
   * @param config - token, base URL and `fetch`; each falls back to its default
   * @throws {PlatformError} with code `unauthorized` when no token is given or set in
   *   `QUALITHM_API_TOKEN`
   */
  constructor(config: PlatformClientConfig = {}) {
    const token = config.token ?? env("QUALITHM_API_TOKEN")
    if (token === undefined || token === "") {
      throw new PlatformError(
        "api token missing: pass token or set QUALITHM_API_TOKEN",
        "unauthorized",
        0
      )
    }
    const baseUrl = (config.baseUrl ?? env("QUALITHM_API_URL") ?? DEFAULT_BASE_URL).replace(
      /\/+$/,
      ""
    )
    this.configuration = new Configuration({
      basePath: baseUrl,
      accessToken: token,
      middleware: [raisePlatformErrors],
      ...(config.fetch === undefined ? {} : { fetchApi: config.fetch })
    })
  }

  /**
   * One generated API class, bound to this client and created once.
   *
   * @param apiClass - a generated API class, such as `DevicesApi`
   * @returns the instance for this client
   */
  api<T extends BaseAPI>(apiClass: ApiClass<T>): T {
    let instance = this.apis.get(apiClass)
    if (instance === undefined) {
      instance = new apiClass(this.configuration)
      this.apis.set(apiClass, instance)
    }
    return instance as T
  }
}

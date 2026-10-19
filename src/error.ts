import { ApiErrorCode } from "./generated/index.js"

/** An `ApiErrorCode`, or `unknown` for a code this client version doesn't know yet. */
export type PlatformErrorCode = ApiErrorCode | "unknown"

const knownCodes = new Set<string>(Object.values(ApiErrorCode))

/**
 * Every failure a platform call raises: an error response from the API, or a request that never
 * got one. Branch on `code`, never on `message`.
 */
export class PlatformError extends Error {
  override readonly name = "PlatformError"
  /** The envelope's stable code; `unknown` for one this version doesn't know. */
  readonly code: PlatformErrorCode
  /** The HTTP status, or `0` when no response arrived. */
  readonly status: number

  /**
   * @param message - what failed, lowercase, as the API sent it
   * @param code - the envelope's stable code; `unknown` for one this version doesn't know
   * @param status - the HTTP status, or `0` when no response arrived
   * @param options - the underlying error, when there is one
   */
  constructor(message: string, code: PlatformErrorCode, status: number, options?: ErrorOptions) {
    super(message, options)
    this.code = code
    this.status = status
  }
}

/**
 * Builds the `PlatformError` for an error response, reading the `{ message, code }` envelope.
 *
 * @param response - a non-2xx response
 * @returns the error to raise
 */
export async function errorFromResponse(response: Response): Promise<PlatformError> {
  let body: unknown
  try {
    body = await response.clone().json()
  } catch {
    body = undefined
  }
  const envelope = (typeof body === "object" && body !== null ? body : {}) as Record<
    string,
    unknown
  >
  const code =
    typeof envelope.code === "string" && knownCodes.has(envelope.code)
      ? (envelope.code as ApiErrorCode)
      : "unknown"
  const message =
    typeof envelope.message === "string" && envelope.message !== ""
      ? envelope.message
      : `request failed with status ${String(response.status)}`
  return new PlatformError(message, code, response.status)
}

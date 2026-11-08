/**
 * The error codes this client version knows. The platform declares the set growable
 * (`x-extensible-enum`), so the generated `ApiErrorCode` is a plain string; this list is the
 * client's own, and a newer code decodes to `unknown`.
 */
export const platformErrorCodes = [
  "bad_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "precondition_failed",
  "unsupported_media_type",
  "unprocessable_entity",
  "failed_dependency",
  "rate_limited",
  "internal_error",
  "backend_unavailable",
  "last_owner",
  "role_too_high",
  "email_in_use",
  "otp_invalid",
  "owns_team",
  "account_not_found",
  "already_member",
  "zone_closed",
  "zone_mismatch",
  "plan_limit",
  "registered_limit",
  "name_taken",
  "paid_plan_required",
  "scope_not_empty",
  "idempotency_mismatch",
  "idempotency_in_flight"
] as const

/** A code from {@link platformErrorCodes}, or `unknown` for one this client version doesn't know. */
export type PlatformErrorCode = (typeof platformErrorCodes)[number] | "unknown"

const knownCodes = new Set<string>(platformErrorCodes)

function isKnownCode(code: unknown): code is (typeof platformErrorCodes)[number] {
  return typeof code === "string" && knownCodes.has(code)
}

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
  const code = isKnownCode(envelope.code) ? envelope.code : "unknown"
  const message =
    typeof envelope.message === "string" && envelope.message !== ""
      ? envelope.message
      : `request failed with status ${String(response.status)}`
  return new PlatformError(message, code, response.status)
}

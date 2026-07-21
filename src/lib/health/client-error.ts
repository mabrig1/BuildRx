/**
 * Client-safe error carrying the structured diagnosis from a health
 * API error response ({ error, code, subsystem, cause, suggestedFix }),
 * so UI can surface the real cause instead of a generic message.
 */
export class ApiError extends Error {
  code?: string;
  diagnosedCause?: string;
  suggestedFix?: string;

  constructor(
    message: string,
    extra?: { code?: string; diagnosedCause?: string; suggestedFix?: string }
  ) {
    super(message);
    this.name = "ApiError";
    this.code = extra?.code;
    this.diagnosedCause = extra?.diagnosedCause;
    this.suggestedFix = extra?.suggestedFix;
  }
}

/** Builds an ApiError from a parsed JSON error body (or null). */
export function apiErrorFrom(data: unknown, fallback: string): ApiError {
  const body = (data ?? {}) as {
    error?: string;
    code?: string;
    cause?: string;
    suggestedFix?: string;
  };
  return new ApiError(body.error ?? fallback, {
    code: body.code,
    diagnosedCause: body.cause,
    suggestedFix: body.suggestedFix,
  });
}

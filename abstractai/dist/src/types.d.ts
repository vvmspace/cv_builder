export type JsonObject = Record<string, unknown>;
export interface RateLimitError extends Error {
    isRateLimit?: boolean;
}

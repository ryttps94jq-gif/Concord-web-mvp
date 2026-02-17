/**
 * Centralized configuration constants for the Concord frontend.
 *
 * All modules that need the backend base URL or socket URL should import
 * from here instead of reading process.env directly, so there is exactly
 * one place to change the fallback and one place to audit.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';

export const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';

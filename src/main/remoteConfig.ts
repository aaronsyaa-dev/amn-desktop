import 'dotenv/config';

/**
 * Central-API configuration, read only in the main process. The operator
 * token deliberately never reaches the renderer (see src/main/remoteApi.ts —
 * all amn-api calls are proxied over IPC), unlike the browser fallback in
 * src/lib/bridge.ts, which has no choice but to hold its own token
 * client-side and is documented as dev/test-only for that reason.
 */
export const remoteConfig = {
  apiUrl: (process.env.AMN_API_URL || '').replace(/\/$/, ''),
  operatorToken: process.env.AMN_API_OPERATOR_TOKEN || '',
};

export function isRemoteConfigured(): boolean {
  return Boolean(remoteConfig.apiUrl && remoteConfig.operatorToken);
}

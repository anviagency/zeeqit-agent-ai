import { httpApi } from './http-client'

/**
 * Returns the appropriate API client based on the runtime environment.
 * In Electron: uses the preload IPC bridge (window.zeeqitApi).
 * In browser: uses HTTP fetch to the local API server.
 */
export function getApi(): typeof httpApi {
  if (typeof window !== 'undefined' && window.zeeqitApi) {
    return window.zeeqitApi as typeof httpApi
  }
  return httpApi
}

export const api = getApi()

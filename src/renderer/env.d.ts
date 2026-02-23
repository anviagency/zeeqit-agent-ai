/// <reference types="vite/client" />

import type { ZeeqitApi } from '../preload/api'

declare global {
  interface Window {
    zeeqitApi: ZeeqitApi
  }
}

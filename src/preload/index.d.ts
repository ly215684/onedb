import type { OneDBApi } from './index'

declare global {
  interface Window {
    onedb: OneDBApi
  }
}

export {}

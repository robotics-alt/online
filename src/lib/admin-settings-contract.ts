import type { PlatformSettings } from './settings'

/** Shared by the settings endpoint and its screen to keep runtime shapes aligned. */
export interface AdminSettingsResponse {
  settings: PlatformSettings
  integrations: {
    video: { provider: string; status: string; note: string }
    payments: { name: string; enabled: boolean; requiredCredentials: string[] }[]
    email: { smtpConfigured: boolean; note: string }
    oauth: { google: boolean; note: string }
  }
}

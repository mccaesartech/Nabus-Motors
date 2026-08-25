/** Re-export forced password-change helpers (canonical definitions live in paths.ts). */
export {
  PLATFORM_FORCED_PASSWORD_CHANGE_PATH,
  isPlatformForcedPasswordChangePath,
  PLATFORM_PASSWORD_CHANGE_ALLOWED_API_PREFIXES,
  isApiAllowedDuringPasswordChange,
  platformForcedPasswordChangeRedirectUrl,
} from "@/lib/platform/paths";
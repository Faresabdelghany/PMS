// ============================================
// UI TIMING
// ============================================
/** Duration to show success toast messages (ms) */
export const UI_TOAST_TIMEOUT = 3000
/** Duration to show email confirmation messages (ms) */
export const UI_EMAIL_CONFIRM_TIMEOUT = 5000
/** Duration before copy button resets to default state (ms) */
export const UI_COPY_RESET_DELAY = 2000

// ============================================
// PAGINATION & LIMITS
// ============================================
/** Max active projects shown in sidebar */
export const SIDEBAR_PROJECT_LIMIT = 7
/** Results per category in global search */
export const SEARCH_RESULTS_PER_CATEGORY = 5
/** Max conversations per page */
export const CONVERSATION_PAGE_SIZE = 50
/** Max messages per conversation page */
export const MESSAGE_PAGE_SIZE = 100
/** Max inbox items per page */
export const INBOX_PAGE_SIZE = 50
/** Max search results for conversations */
export const SEARCH_CONVERSATION_LIMIT = 20

// ============================================
// FILE UPLOADS
// ============================================
/** Maximum avatar file size (5MB) */
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024

// ============================================
// SIGNED URL EXPIRY
// ============================================
/** Signed URL expiry for on-demand downloads (1 hour) */
export const SIGNED_URL_EXPIRY_DOWNLOAD = 3600
/** Signed URL expiry for stored preview/display URLs (24 hours) */
export const SIGNED_URL_EXPIRY_PREVIEW = 86400

// ============================================
// UI THRESHOLDS
// ============================================
/** Project progress color thresholds (percentage) */
export const PROGRESS_THRESHOLDS = { high: 75, medium: 50, low: 25 } as const
/** Notification badge cap — shows "99+" above this */
export const BADGE_CAP = 99

// ============================================
// TASK URGENCY
// ============================================
/** Days until due date to mark as urgent */
export const URGENCY_DAYS_CRITICAL = 3
/** Days until due date to mark as upcoming */
export const URGENCY_DAYS_WARNING = 7

// ============================================
// TASK LIST
// ============================================
/** Max tasks shown per project section before "Show more" button */
export const INITIAL_VISIBLE_TASKS_PER_PROJECT = 5

// ============================================
// IN-MEMORY CACHE
// ============================================
/** Maximum entries in the in-memory cache (local dev fallback) */
export const MAX_MEMORY_CACHE_SIZE = 500
/** Percentage of max size that triggers a warning log */
export const MEMORY_CACHE_WARN_THRESHOLD = 0.8
/** Interval between expired-entry sweeps (ms) */
export const MEMORY_CACHE_CLEANUP_INTERVAL_MS = 60_000

// ============================================
// AI CONTEXT LIMITS
// ============================================
/** Maximum length for user-provided strings interpolated into AI prompts */
export const AI_PROMPT_INPUT_MAX_LENGTH = 2000

export const AI_CONTEXT_LIMITS = {
  members: 10,
  projects: 20,
  tasks: 15,
  inbox: 5,
  content: 5000,
  taskList: 30,
  suggestedActions: 3,
} as const

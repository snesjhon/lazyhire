export const IPC = {
  // Jobs
  JOBS_LIST: 'jobs:list',
  JOBS_ADD: 'jobs:add',
  JOBS_UPDATE: 'jobs:update',
  JOBS_REMOVE: 'jobs:remove',
  JOBS_HYDRATE: 'jobs:hydrate',

  // Answers
  ANSWERS_LIST: 'answers:list',
  ANSWERS_SAVE: 'answers:save',

  // Profile
  PROFILE_READ: 'profile:read',
  PROFILE_SAVE: 'profile:save',
  PROFILE_HAS: 'profile:has',

  // Settings
  SETTINGS_READ: 'settings:read',
  SETTINGS_SAVE: 'settings:save',

  // AI (invoke → result)
  AI_EVALUATE: 'ai:evaluate',
  AI_GENERATE_RESUME: 'ai:generate-resume',
  AI_GENERATE_COVER_LETTER: 'ai:generate-cover-letter',
  AI_EXTRACT_PROFILE: 'ai:extract-profile',
  AI_EXTRACT_PROFILE_FROM_URL: 'ai:extract-profile-from-url',
  AI_GENERATE_ANSWER: 'ai:generate-answer',
  AI_DETECT_ANSWER_CATEGORY: 'ai:detect-answer-category',
  AI_REFINE_ANSWER: 'ai:refine-answer',

  // Scan
  SCAN_RUN: 'scan:run',
  SCAN_DISCOVER: 'scan:discover',
  SCAN_ACCEPT_BATCH: 'scan:accept-batch',

  // Shell
  SHELL_OPEN_PATH: 'shell:open-path',

  // Progress events (main → renderer via on())
  AI_PROGRESS: 'ai:progress',
  SCAN_PROGRESS: 'scan:progress',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

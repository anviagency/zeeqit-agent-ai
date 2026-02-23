/** Central registry of all workflow node types with metadata, config schemas, and icons. */

export type NodeCategory = 'web' | 'social' | 'storage' | 'ai' | 'channel' | 'system'

export type ExtendedNodeType =
  // Web
  | 'google-search' | 'web-scrape' | 'screenshot' | 'navigate'
  // Social
  | 'instagram-post' | 'telegram-send' | 'tiktok-upload' | 'whatsapp-send'
  // Storage
  | 'nanobanano-upload' | 'nanobanano-download'
  | 's3-upload' | 's3-download'
  | 'gdrive-upload' | 'gdrive-download'
  // AI
  | 'openai-generate' | 'anthropic-generate' | 'ai-analyze' | 'ai-summarize'
  // Legacy / generic (backward compat)
  | 'browser' | 'system' | 'api' | 'agent' | 'channel'

export interface NodeConfigField {
  key: string
  label: string
  type: 'text' | 'password' | 'select' | 'textarea' | 'number'
  placeholder?: string
  options?: { value: string; label: string }[]
  required?: boolean
  defaultValue?: string
}

export interface NodeTypeDefinition {
  type: ExtendedNodeType
  category: NodeCategory
  title: string
  description: string
  iconPath: string
  configFields: NodeConfigField[]
}

/* ── SVG icon paths ─────────────────────────────────────── */

const ICONS = {
  search: 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.35-4.35',
  globe: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  navigate: 'M3 11l19-9-9 19-2-8-8-2z',
  instagram: 'M17.5 6.5h.01M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  telegram: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
  video: 'M23 7l-7 5 7 5V7zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z',
  phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  cloud: 'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 1 0 0-10z',
  drive: 'M22 12h-4l-3 9L9 3H5M1 12h4',
  openai: 'M12 2l9 4.5v7l-9 4.5L3 13.5v-7L12 2zM12 22V13.5M3 6.5l9 4.5 9-4.5',
  brain: 'M9.5 2A5.5 5.5 0 0 0 5 7.5c0 2 1 3 2 4l.5 1V15h5v-2.5l.5-1c1-1 2-2 2-4A5.5 5.5 0 0 0 9.5 2zM8 15v2h4v-2',
  analyze: 'M18 20V10M12 20V4M6 20v-6',
  api: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  agent: 'M12 2l9 4.5v7l-9 4.5L3 13.5v-7L12 2zM12 22V13.5M3 6.5l9 4.5 9-4.5',
  system: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  channel: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
  scrape: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
}

/* ── Node definitions ───────────────────────────────────── */

const AI_MODEL_OPTIONS: NodeConfigField['options'] = [
  { value: 'anthropic/claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'anthropic/claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  { value: 'openai/gpt-4o', label: 'GPT-4o' },
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
]

export const NODE_REGISTRY: NodeTypeDefinition[] = [
  // ── Web ────────────────────────────────────────────────
  {
    type: 'google-search',
    category: 'web',
    title: 'Google Search',
    description: 'Search Google and extract results via browser automation.',
    iconPath: ICONS.search,
    configFields: [
      { key: 'query', label: 'Search Query', type: 'text', placeholder: 'Enter search term...', required: true },
      { key: 'maxResults', label: 'Max Results', type: 'number', defaultValue: '10' },
    ],
  },
  {
    type: 'web-scrape',
    category: 'web',
    title: 'Web Scraper',
    description: 'Scrape structured data from a web page using CSS selectors.',
    iconPath: ICONS.scrape,
    configFields: [
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://...', required: true },
      { key: 'selector', label: 'CSS Selector', type: 'text', placeholder: '.content, table tr' },
      { key: 'format', label: 'Output Format', type: 'select', options: [
        { value: 'json', label: 'JSON' }, { value: 'csv', label: 'CSV' }, { value: 'text', label: 'Plain Text' },
      ], defaultValue: 'json' },
    ],
  },
  {
    type: 'screenshot',
    category: 'web',
    title: 'Screenshot',
    description: 'Capture a screenshot of a web page.',
    iconPath: ICONS.camera,
    configFields: [
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://...', required: true },
      { key: 'fullPage', label: 'Full Page', type: 'select', options: [
        { value: 'true', label: 'Yes' }, { value: 'false', label: 'No' },
      ], defaultValue: 'true' },
    ],
  },
  {
    type: 'navigate',
    category: 'web',
    title: 'Navigate',
    description: 'Navigate to a URL and interact with the page.',
    iconPath: ICONS.navigate,
    configFields: [
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://...', required: true },
      { key: 'action', label: 'Action', type: 'select', options: [
        { value: 'navigate', label: 'Just navigate' },
        { value: 'navigate + extract', label: 'Navigate & extract' },
        { value: 'navigate + click', label: 'Navigate & click' },
      ], defaultValue: 'navigate' },
    ],
  },

  // ── Social ─────────────────────────────────────────────
  {
    type: 'instagram-post',
    category: 'social',
    title: 'Instagram Post',
    description: 'Post content to Instagram via browser automation.',
    iconPath: ICONS.instagram,
    configFields: [
      { key: 'sessionToken', label: 'Session Token', type: 'password', required: true },
      { key: 'caption', label: 'Caption', type: 'textarea', placeholder: 'Post caption...' },
      { key: 'mediaSource', label: 'Media Source', type: 'text', placeholder: '{{previous.output}}' },
    ],
  },
  {
    type: 'telegram-send',
    category: 'social',
    title: 'Telegram Send',
    description: 'Send a message or file via Telegram bot.',
    iconPath: ICONS.telegram,
    configFields: [
      { key: 'botToken', label: 'Bot Token', type: 'password', required: true },
      { key: 'chatId', label: 'Chat ID', type: 'text', placeholder: '@channel or numeric ID', required: true },
      { key: 'messageTemplate', label: 'Message Template', type: 'textarea', placeholder: '{{data}}', defaultValue: '{{data}}' },
    ],
  },
  {
    type: 'tiktok-upload',
    category: 'social',
    title: 'TikTok Upload',
    description: 'Upload a video to TikTok via browser automation.',
    iconPath: ICONS.video,
    configFields: [
      { key: 'sessionToken', label: 'Session Token', type: 'password', required: true },
      { key: 'caption', label: 'Caption', type: 'textarea', placeholder: 'Video description...' },
      { key: 'videoSource', label: 'Video Source', type: 'text', placeholder: '{{previous.output}}' },
    ],
  },
  {
    type: 'whatsapp-send',
    category: 'social',
    title: 'WhatsApp Send',
    description: 'Send a message via WhatsApp Web automation.',
    iconPath: ICONS.phone,
    configFields: [
      { key: 'phoneNumber', label: 'Phone Number', type: 'text', placeholder: '+1234567890', required: true },
      { key: 'messageTemplate', label: 'Message Template', type: 'textarea', placeholder: '{{data}}', defaultValue: '{{data}}' },
    ],
  },

  // ── Storage ────────────────────────────────────────────
  {
    type: 'nanobanano-upload',
    category: 'storage',
    title: 'NanoBanano Upload',
    description: 'Upload files to NanoBanano decentralized storage.',
    iconPath: ICONS.upload,
    configFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'bucket', label: 'Bucket', type: 'text', placeholder: 'my-bucket' },
      { key: 'inputSource', label: 'Input Source', type: 'text', placeholder: '{{previous.output}}' },
    ],
  },
  {
    type: 'nanobanano-download',
    category: 'storage',
    title: 'NanoBanano Download',
    description: 'Download files from NanoBanano decentralized storage.',
    iconPath: ICONS.download,
    configFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'fileId', label: 'File ID', type: 'text', required: true },
    ],
  },
  {
    type: 's3-upload',
    category: 'storage',
    title: 'S3 Upload',
    description: 'Upload files to an S3-compatible bucket.',
    iconPath: ICONS.cloud,
    configFields: [
      { key: 'accessKeyId', label: 'Access Key ID', type: 'password', required: true },
      { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
      { key: 'bucket', label: 'Bucket Name', type: 'text', required: true },
      { key: 'region', label: 'Region', type: 'text', defaultValue: 'us-east-1' },
    ],
  },
  {
    type: 's3-download',
    category: 'storage',
    title: 'S3 Download',
    description: 'Download files from an S3-compatible bucket.',
    iconPath: ICONS.cloud,
    configFields: [
      { key: 'accessKeyId', label: 'Access Key ID', type: 'password', required: true },
      { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
      { key: 'bucket', label: 'Bucket Name', type: 'text', required: true },
      { key: 'objectKey', label: 'Object Key', type: 'text', required: true },
    ],
  },
  {
    type: 'gdrive-upload',
    category: 'storage',
    title: 'Google Drive Upload',
    description: 'Upload files to Google Drive.',
    iconPath: ICONS.drive,
    configFields: [
      { key: 'serviceAccountKey', label: 'Service Account Key (JSON)', type: 'password', required: true },
      { key: 'folderId', label: 'Folder ID', type: 'text' },
      { key: 'inputSource', label: 'Input Source', type: 'text', placeholder: '{{previous.output}}' },
    ],
  },
  {
    type: 'gdrive-download',
    category: 'storage',
    title: 'Google Drive Download',
    description: 'Download files from Google Drive.',
    iconPath: ICONS.drive,
    configFields: [
      { key: 'serviceAccountKey', label: 'Service Account Key (JSON)', type: 'password', required: true },
      { key: 'fileId', label: 'File ID', type: 'text', required: true },
    ],
  },

  // ── AI ─────────────────────────────────────────────────
  {
    type: 'openai-generate',
    category: 'ai',
    title: 'OpenAI Generate',
    description: 'Generate text or analyze content with OpenAI models.',
    iconPath: ICONS.openai,
    configFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'model', label: 'Model', type: 'select', options: [
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
        { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      ], defaultValue: 'gpt-4o' },
      { key: 'prompt', label: 'Prompt', type: 'textarea', placeholder: 'Instructions for the AI...', required: true },
    ],
  },
  {
    type: 'anthropic-generate',
    category: 'ai',
    title: 'Anthropic Generate',
    description: 'Generate text or analyze content with Claude models.',
    iconPath: ICONS.brain,
    configFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'model', label: 'Model', type: 'select', options: [
        { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
        { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
      ], defaultValue: 'claude-sonnet-4-20250514' },
      { key: 'prompt', label: 'Prompt', type: 'textarea', placeholder: 'Instructions for Claude...', required: true },
    ],
  },
  {
    type: 'ai-analyze',
    category: 'ai',
    title: 'AI Analyze',
    description: 'Analyze data using AI — classify, extract, or transform.',
    iconPath: ICONS.analyze,
    configFields: [
      { key: 'model', label: 'Model', type: 'select', options: AI_MODEL_OPTIONS, defaultValue: 'anthropic/claude-sonnet-4-20250514' },
      { key: 'instruction', label: 'Analysis Instruction', type: 'textarea', placeholder: 'What to analyze and how...' },
      { key: 'inputSource', label: 'Input Source', type: 'text', placeholder: '{{previous.output}}', defaultValue: '{{previous.output}}' },
    ],
  },
  {
    type: 'ai-summarize',
    category: 'ai',
    title: 'AI Summarize',
    description: 'Summarize content using AI.',
    iconPath: ICONS.brain,
    configFields: [
      { key: 'model', label: 'Model', type: 'select', options: AI_MODEL_OPTIONS, defaultValue: 'anthropic/claude-sonnet-4-20250514' },
      { key: 'maxLength', label: 'Max Summary Length', type: 'number', defaultValue: '200' },
      { key: 'inputSource', label: 'Input Source', type: 'text', placeholder: '{{previous.output}}', defaultValue: '{{previous.output}}' },
    ],
  },

  // ── Legacy / Generic ───────────────────────────────────
  {
    type: 'browser',
    category: 'web',
    title: 'Browser Action',
    description: 'Generic browser automation via GoLogin CDP bridge.',
    iconPath: ICONS.globe,
    configFields: [
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://...' },
      { key: 'selector', label: 'CSS Selector', type: 'text' },
      { key: 'action', label: 'Action', type: 'text', defaultValue: 'navigate + extract' },
    ],
  },
  {
    type: 'system',
    category: 'system',
    title: 'System Command',
    description: 'Run a local system command or file operation.',
    iconPath: ICONS.system,
    configFields: [
      { key: 'command', label: 'Command', type: 'text', placeholder: 'shell command...' },
      { key: 'targetPath', label: 'Target Path', type: 'text' },
    ],
  },
  {
    type: 'api',
    category: 'web',
    title: 'API Call',
    description: 'Send data to an external API endpoint.',
    iconPath: ICONS.api,
    configFields: [
      { key: 'endpoint', label: 'Endpoint URL', type: 'text', placeholder: 'https://api.example.com/...', required: true },
      { key: 'method', label: 'Method', type: 'select', options: [
        { value: 'GET', label: 'GET' }, { value: 'POST', label: 'POST' },
        { value: 'PUT', label: 'PUT' }, { value: 'DELETE', label: 'DELETE' },
      ], defaultValue: 'POST' },
      { key: 'token', label: 'Auth Token', type: 'password' },
    ],
  },
  {
    type: 'agent',
    category: 'ai',
    title: 'AI Agent',
    description: 'Run OpenClaw agent to process and analyze data.',
    iconPath: ICONS.agent,
    configFields: [
      { key: 'model', label: 'Model', type: 'select', options: AI_MODEL_OPTIONS, defaultValue: 'anthropic/claude-sonnet-4-20250514' },
      { key: 'message', label: 'Message', type: 'textarea', placeholder: 'Instructions for the agent...' },
      { key: 'thinking', label: 'Thinking Level', type: 'select', options: [
        { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' },
      ], defaultValue: 'medium' },
    ],
  },
  {
    type: 'channel',
    category: 'channel',
    title: 'Channel Delivery',
    description: 'Deliver results to a messaging channel.',
    iconPath: ICONS.channel,
    configFields: [
      { key: 'channel', label: 'Channel', type: 'select', options: [
        { value: 'telegram', label: 'Telegram' }, { value: 'whatsapp', label: 'WhatsApp' },
        { value: 'email', label: 'Email' }, { value: 'webhook', label: 'Webhook' },
      ], defaultValue: 'telegram' },
      { key: 'target', label: 'Target', type: 'text', placeholder: 'Chat ID, phone, or URL' },
      { key: 'messageTemplate', label: 'Message Template', type: 'textarea', defaultValue: '{{result}}' },
    ],
  },
]

export function getNodeDefinition(type: ExtendedNodeType): NodeTypeDefinition | undefined {
  return NODE_REGISTRY.find((n) => n.type === type)
}

export function getNodesByCategory(category: NodeCategory): NodeTypeDefinition[] {
  return NODE_REGISTRY.filter((n) => n.category === category)
}

export function getDefaultConfig(type: ExtendedNodeType): Record<string, string> {
  const def = getNodeDefinition(type)
  if (!def) return {}
  const config: Record<string, string> = {}
  for (const field of def.configFields) {
    config[field.key] = field.defaultValue ?? ''
  }
  return config
}

export function hasMissingRequired(type: ExtendedNodeType, config: Record<string, string>): boolean {
  const def = getNodeDefinition(type)
  if (!def) return false
  return def.configFields.some((f) => f.required && !config[f.key]?.trim())
}

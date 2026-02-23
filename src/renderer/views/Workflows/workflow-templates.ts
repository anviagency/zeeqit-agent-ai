/** Pre-built workflow templates users can start from. */

import { getNodeDefinition, getDefaultConfig, hasMissingRequired } from './node-registry'
import type { ExtendedNodeType } from './node-registry'

export interface TemplateNode {
  type: ExtendedNodeType
  title: string
  desc: string
  configOverrides?: Record<string, string>
}

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: string
  prompt: string
  templateNodes: TemplateNode[]
}

function buildNodes(templateNodes: TemplateNode[]) {
  let xPos = 80
  return templateNodes.map((tn, idx) => {
    const def = getNodeDefinition(tn.type)
    const config = { ...getDefaultConfig(tn.type), ...tn.configOverrides }
    const node = {
      id: `n${idx + 1}`,
      type: tn.type,
      title: tn.title || def?.title || tn.type,
      desc: tn.desc || def?.description || '',
      x: xPos,
      y: 180,
      icon: def?.iconPath ?? '',
      config,
      missing: hasMissingRequired(tn.type, config),
    }
    xPos += 340
    return node
  })
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'google-to-nanobanano',
    name: 'Google Search -> NanoBanano',
    description: 'Search images on Google, upload results to NanoBanano storage.',
    category: 'Web + Storage',
    prompt: 'search images on Google, upload to NanoBanano',
    templateNodes: [
      { type: 'google-search', title: 'Google Search', desc: 'Search Google for images.' },
      { type: 'nanobanano-upload', title: 'Upload to NanoBanano', desc: 'Upload search results to NanoBanano.' },
    ],
  },
  {
    id: 'google-nanobanano-instagram',
    name: 'Google -> NanoBanano -> Instagram',
    description: 'Search images, store them, then post to Instagram.',
    category: 'Full Pipeline',
    prompt: 'search images on Google, upload to NanoBanano and then send to Instagram',
    templateNodes: [
      { type: 'google-search', title: 'Google Search', desc: 'Search Google for images.' },
      { type: 'nanobanano-upload', title: 'Upload to NanoBanano', desc: 'Store images in NanoBanano.' },
      { type: 'instagram-post', title: 'Post to Instagram', desc: 'Post stored images to Instagram.' },
    ],
  },
  {
    id: 'ai-summarize-telegram',
    name: 'AI Summarize -> Telegram',
    description: 'Use AI to summarize content, then send via Telegram.',
    category: 'AI + Social',
    prompt: 'summarize this content and send to Telegram',
    templateNodes: [
      { type: 'ai-summarize', title: 'AI Summarize', desc: 'Summarize the input content.' },
      { type: 'telegram-send', title: 'Send to Telegram', desc: 'Send summary via Telegram bot.' },
    ],
  },
  {
    id: 'scrape-to-s3',
    name: 'Web Scrape -> S3 Upload',
    description: 'Scrape data from a website and store in S3.',
    category: 'Web + Storage',
    prompt: 'scrape data from website and upload to S3',
    templateNodes: [
      { type: 'web-scrape', title: 'Web Scraper', desc: 'Scrape structured data from page.' },
      { type: 's3-upload', title: 'Upload to S3', desc: 'Store scraped data in S3 bucket.' },
    ],
  },
  {
    id: 'scrape-analyze-whatsapp',
    name: 'Scrape -> AI Analyze -> WhatsApp',
    description: 'Scrape data, analyze with AI, send results via WhatsApp.',
    category: 'Full Pipeline',
    prompt: 'scrape this website, analyze the data with AI, and send results via WhatsApp',
    templateNodes: [
      { type: 'web-scrape', title: 'Web Scraper', desc: 'Extract data from web page.' },
      { type: 'ai-analyze', title: 'AI Analysis', desc: 'Analyze extracted data using AI.' },
      { type: 'whatsapp-send', title: 'WhatsApp Send', desc: 'Send analysis results via WhatsApp.' },
    ],
  },
  {
    id: 'screenshot-gdrive',
    name: 'Screenshot -> Google Drive',
    description: 'Take a screenshot of a web page and save to Google Drive.',
    category: 'Web + Storage',
    prompt: 'take a screenshot of this website and save to Google Drive',
    templateNodes: [
      { type: 'screenshot', title: 'Take Screenshot', desc: 'Capture full page screenshot.' },
      { type: 'gdrive-upload', title: 'Save to Drive', desc: 'Upload screenshot to Google Drive.' },
    ],
  },
  {
    id: 'openai-tiktok',
    name: 'OpenAI Generate -> TikTok',
    description: 'Generate content with OpenAI and upload to TikTok.',
    category: 'AI + Social',
    prompt: 'generate content with OpenAI and upload to TikTok',
    templateNodes: [
      { type: 'openai-generate', title: 'OpenAI Generate', desc: 'Generate content using GPT-4.' },
      { type: 'tiktok-upload', title: 'TikTok Upload', desc: 'Upload generated content to TikTok.' },
    ],
  },
  {
    id: 'google-ai-telegram',
    name: 'Google -> AI Agent -> Telegram',
    description: 'Search Google, process with AI agent, send via Telegram.',
    category: 'Full Pipeline',
    prompt: 'search Google for latest news, analyze with AI agent, send summary to Telegram',
    templateNodes: [
      { type: 'google-search', title: 'Google Search', desc: 'Search for latest information.' },
      { type: 'agent', title: 'AI Agent', desc: 'Process and analyze search results.', configOverrides: { message: 'Analyze and summarize the search results' } },
      { type: 'telegram-send', title: 'Telegram Send', desc: 'Send analysis via Telegram.' },
    ],
  },
  {
    id: 'api-nanobanano',
    name: 'API Call -> NanoBanano',
    description: 'Fetch data from an API and store in NanoBanano.',
    category: 'Web + Storage',
    prompt: 'fetch data from API and store in NanoBanano',
    templateNodes: [
      { type: 'api', title: 'API Call', desc: 'Fetch data from external API.' },
      { type: 'nanobanano-upload', title: 'NanoBanano Upload', desc: 'Store API response in NanoBanano.' },
    ],
  },
  {
    id: 'scrape-summarize-instagram',
    name: 'Scrape -> Summarize -> Instagram',
    description: 'Scrape content, AI summarize, post to Instagram.',
    category: 'Full Pipeline',
    prompt: 'scrape this page, summarize with AI, and post to Instagram',
    templateNodes: [
      { type: 'web-scrape', title: 'Web Scraper', desc: 'Extract content from page.' },
      { type: 'ai-summarize', title: 'AI Summarize', desc: 'Create a concise summary.' },
      { type: 'instagram-post', title: 'Instagram Post', desc: 'Post summary to Instagram.' },
    ],
  },
]

/** Expand a template into positioned workflow nodes. */
export function expandTemplate(template: WorkflowTemplate) {
  return {
    prompt: template.prompt,
    nodes: buildNodes(template.templateNodes),
  }
}

import express from 'express'
import cors from 'cors'
import type { Server } from 'http'
import type { Response } from 'express'
import { LogRing } from '../services/diagnostics/log-ring'
import type { IpcResult, InstallProgressEvent, GatewayStateEvent } from '@shared/ipc-channels'

const logger = LogRing.getInstance()
const DEFAULT_PORT = 31311

function ok<T>(data?: T): IpcResult<T> {
  return { success: true, data }
}

/**
 * HTTP API server that exposes the same service layer as the Electron IPC handlers.
 * Enables the UI to run in a regular browser instead of requiring the Electron renderer.
 * Uses Server-Sent Events (SSE) for real-time install progress streaming.
 */
export class HttpApiServer {
  private static instance: HttpApiServer | null = null
  private server: Server | null = null
  private port = DEFAULT_PORT
  private sseClients: Set<Response> = new Set()
  private gatewayStateClients: Set<Response> = new Set()

  private constructor() {}

  static getInstance(): HttpApiServer {
    if (!HttpApiServer.instance) {
      HttpApiServer.instance = new HttpApiServer()
    }
    return HttpApiServer.instance
  }

  getPort(): number {
    return this.port
  }

  /**
   * Broadcasts an install progress event to all connected SSE clients.
   */
  broadcastProgress(event: InstallProgressEvent): void {
    const data = JSON.stringify(event)
    for (const client of this.sseClients) {
      try {
        client.write(`data: ${data}\n\n`)
      } catch {
        this.sseClients.delete(client)
      }
    }
  }

  /**
   * Broadcasts a gateway state change to all connected gateway-state SSE clients.
   */
  broadcastGatewayState(event: GatewayStateEvent): void {
    const data = JSON.stringify(event)
    for (const client of this.gatewayStateClients) {
      try {
        client.write(`data: ${data}\n\n`)
      } catch {
        this.gatewayStateClients.delete(client)
      }
    }
  }

  async start(): Promise<number> {
    if (this.server) return this.port

    const app = express()
    app.use(cors())
    app.use(express.json())

    this.registerRoutes(app)

    return new Promise((resolve, reject) => {
      const tryPort = (port: number): void => {
        const srv = app.listen(port, '127.0.0.1', () => {
          this.server = srv
          this.port = port
          logger.info('HTTP API server started', { port })
          resolve(port)
        })
        srv.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE' && port < DEFAULT_PORT + 10) {
            tryPort(port + 1)
          } else {
            reject(err)
          }
        })
      }
      tryPort(DEFAULT_PORT)
    })
  }

  stop(): void {
    if (this.server) {
      this.server.close()
      this.server = null
      logger.info('HTTP API server stopped')
    }
  }

  private registerRoutes(app: express.Application): void {
    app.get('/api/events/install-progress', (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })
      res.write('data: {"type":"connected"}\n\n')
      this.sseClients.add(res)

      req.on('close', () => {
        this.sseClients.delete(res)
      })
    })

    app.get('/api/events/gateway-state', (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })
      res.write('data: {"type":"connected"}\n\n')
      this.gatewayStateClients.add(res)

      req.on('close', () => {
        this.gatewayStateClients.delete(res)
      })
    })

    app.post('/api/openclaw/install', async (req, res) => {
      try {
        const { OpenClawInstaller } = await import('../services/openclaw/installer')
        const installer = OpenClawInstaller.getInstance()
        await installer.install(req.body)

        // Auto-connect WebSocket to gateway after successful install
        try {
          const { GatewayWebSocketClient } = await import('../services/gateway/websocket-client')
          await GatewayWebSocketClient.getInstance().connect()
          this.broadcastGatewayState({ state: 'connected' })
          logger.info('Gateway WebSocket auto-connected after install')
        } catch (connectErr) {
          logger.warn('Gateway auto-connect failed after install', {
            error: connectErr instanceof Error ? connectErr.message : String(connectErr),
          })
        }

        res.json(ok())
      } catch (err) {
        res.json({ success: false, error: { code: 'INSTALL_ERROR', message: String(err) } })
      }
    })

    app.get('/api/openclaw/status', async (_req, res) => {
      try {
        const { OpenClawInstaller } = await import('../services/openclaw/installer')
        const checkpoint = OpenClawInstaller.getInstance().getCheckpoint()
        res.json(ok(checkpoint))
      } catch (err) {
        res.json({ success: false, error: { code: 'STATUS_ERROR', message: String(err) } })
      }
    })

    app.post('/api/openclaw/repair', async (_req, res) => {
      try {
        const { OpenClawInstaller } = await import('../services/openclaw/installer')
        const report = await OpenClawInstaller.getInstance().repair()
        res.json(ok(report))
      } catch (err) {
        res.json({ success: false, error: { code: 'REPAIR_ERROR', message: String(err) } })
      }
    })

    app.post('/api/daemon/start', async (_req, res) => {
      try {
        const { DaemonManager } = await import('../services/openclaw/daemon')
        await DaemonManager.getInstance().start()
        res.json(ok())
      } catch (err) {
        res.json({ success: false, error: { code: 'DAEMON_ERROR', message: String(err) } })
      }
    })

    app.post('/api/daemon/stop', async (_req, res) => {
      try {
        const { DaemonManager } = await import('../services/openclaw/daemon')
        await DaemonManager.getInstance().stop()
        res.json(ok())
      } catch (err) {
        res.json({ success: false, error: { code: 'DAEMON_ERROR', message: String(err) } })
      }
    })

    app.get('/api/daemon/status', async (_req, res) => {
      try {
        const { DaemonManager } = await import('../services/openclaw/daemon')
        const status = await DaemonManager.getInstance().getStatus()
        res.json(ok(status))
      } catch (err) {
        res.json({ success: false, error: { code: 'DAEMON_ERROR', message: String(err) } })
      }
    })

    app.get('/api/config', async (_req, res) => {
      try {
        const { ConfigCompiler } = await import('../services/openclaw/config-compiler')
        const config = await ConfigCompiler.getInstance().getCurrentConfig()
        res.json(ok(config))
      } catch (err) {
        res.json({ success: false, error: { code: 'CONFIG_ERROR', message: String(err) } })
      }
    })

    app.post('/api/config/apply', async (req, res) => {
      try {
        const { ConfigCompiler } = await import('../services/openclaw/config-compiler')
        await ConfigCompiler.getInstance().apply(req.body)
        res.json(ok())
      } catch (err) {
        res.json({ success: false, error: { code: 'CONFIG_ERROR', message: String(err) } })
      }
    })

    app.post('/api/vault/store', async (req, res) => {
      try {
        const { CredentialStore } = await import('../services/vault/credential-store')
        const { service, key, value } = req.body
        await CredentialStore.getInstance().store(service, key, value)
        res.json(ok())
      } catch (err) {
        res.json({ success: false, error: { code: 'VAULT_ERROR', message: String(err) } })
      }
    })

    app.get('/api/vault/list', async (_req, res) => {
      try {
        const { CredentialStore } = await import('../services/vault/credential-store')
        const entries = await CredentialStore.getInstance().list()
        res.json(ok(entries))
      } catch (err) {
        res.json({ success: false, error: { code: 'VAULT_ERROR', message: String(err) } })
      }
    })

    app.get('/api/vault/get', async (req, res) => {
      try {
        const { CredentialStore } = await import('../services/vault/credential-store')
        const service = String(req.query.service ?? '')
        const key = String(req.query.key ?? '')
        if (!service || !key) {
          res.json({ success: false, error: { code: 'VAULT_ERROR', message: 'service and key are required' } })
          return
        }
        const value = await CredentialStore.getInstance().get(service, key)
        if (value === null) {
          res.json(ok({ exists: false, masked: null }))
          return
        }
        // Mask: first 4 + *** + last 4 (or shorter for small values)
        const masked = value.length > 10
          ? `${value.slice(0, 4)}${'*'.repeat(Math.min(value.length - 8, 20))}${value.slice(-4)}`
          : '*'.repeat(value.length)
        res.json(ok({ exists: true, masked }))
      } catch (err) {
        res.json({ success: false, error: { code: 'VAULT_ERROR', message: String(err) } })
      }
    })

    app.get('/api/vault/status', async (_req, res) => {
      try {
        const { CredentialStore } = await import('../services/vault/credential-store')
        const status = await CredentialStore.getInstance().getStatus()
        res.json(ok(status))
      } catch (err) {
        res.json({ success: false, error: { code: 'VAULT_ERROR', message: String(err) } })
      }
    })

    app.post('/api/gateway/connect', async (_req, res) => {
      try {
        const { GatewayWebSocketClient } = await import('../services/gateway/websocket-client')
        await GatewayWebSocketClient.getInstance().connect()
        res.json(ok())
      } catch (err) {
        res.json({ success: false, error: { code: 'GATEWAY_ERROR', message: String(err) } })
      }
    })

    app.get('/api/gateway/status', async (_req, res) => {
      try {
        const { GatewayWebSocketClient } = await import('../services/gateway/websocket-client')
        const status = GatewayWebSocketClient.getInstance().getState()
        res.json(ok(status))
      } catch (err) {
        res.json({ success: false, error: { code: 'GATEWAY_ERROR', message: String(err) } })
      }
    })

    app.post('/api/gologin/validate', async (req, res) => {
      try {
        const { GoLoginService } = await import('../services/gologin/client')
        const valid = await GoLoginService.getInstance().validateToken(req.body.token)
        res.json(ok(valid))
      } catch (err) {
        res.json({ success: false, error: { code: 'GOLOGIN_ERROR', message: String(err) } })
      }
    })

    app.post('/api/apify/validate', async (req, res) => {
      try {
        const { ApifyService } = await import('../services/apify/client')
        const valid = await ApifyService.getInstance().validateToken(req.body.token)
        res.json(ok(valid))
      } catch (err) {
        res.json({ success: false, error: { code: 'APIFY_ERROR', message: String(err) } })
      }
    })

    app.get('/api/diagnostics/health', async (_req, res) => {
      try {
        const { HealthMonitor } = await import('../services/openclaw/health')
        const result = await HealthMonitor.getInstance().evaluate()
        res.json(ok(result))
      } catch (err) {
        res.json({ success: false, error: { code: 'HEALTH_ERROR', message: String(err) } })
      }
    })

    app.post('/api/workflow/generate-graph', async (req, res) => {
      try {
        const { prompt } = req.body
        if (!prompt) {
          res.json({ success: false, error: { code: 'WORKFLOW_ERROR', message: 'prompt is required' } })
          return
        }

        const { execFile } = await import('child_process')
        const { promisify } = await import('util')
        const execFileAsync = promisify(execFile)

        const systemPrompt = [
          'You are a workflow graph generator. Given a user prompt, return ONLY valid JSON (no markdown, no explanation) with this structure:',
          '{"nodes":[{"type":"<node-type>","title":"<title>","desc":"<description>","config":{...}}]}',
          'Available node types: google-search, web-scrape, screenshot, navigate, instagram-post, telegram-send, tiktok-upload, whatsapp-send, nanobanano-upload, nanobanano-download, s3-upload, s3-download, gdrive-upload, gdrive-download, openai-generate, anthropic-generate, ai-analyze, ai-summarize, api, agent, channel.',
          'Each node should have sensible config keys based on its type. Return nodes in execution order.',
        ].join(' ')

        const args = [
          'agent',
          '--message', `${systemPrompt}\n\nUser prompt: ${prompt}`,
          '--local',
          '--json',
        ]

        const { stdout } = await execFileAsync('openclaw', args, {
          timeout: 60_000,
          env: { ...process.env },
        })

        // Try to parse the agent response as JSON containing nodes
        const agentResult = JSON.parse(stdout)
        const content = agentResult?.result ?? agentResult?.output ?? stdout

        // Extract JSON from response (agent may wrap it)
        const jsonMatch = typeof content === 'string'
          ? content.match(/\{[\s\S]*"nodes"[\s\S]*\}/)
          : null
        const graphData = jsonMatch ? JSON.parse(jsonMatch[0]) : (typeof content === 'object' ? content : null)

        if (graphData?.nodes?.length > 0) {
          // Position nodes
          let xPos = 80
          const positioned = graphData.nodes.map((n: Record<string, unknown>, idx: number) => {
            const node = {
              id: `n${idx + 1}`,
              type: n.type ?? 'agent',
              title: n.title ?? `Step ${idx + 1}`,
              desc: n.desc ?? '',
              x: xPos,
              y: 180,
              icon: '',
              config: (n.config ?? {}) as Record<string, string>,
              missing: false,
            }
            xPos += 340
            return node
          })
          res.json(ok({ nodes: positioned }))
        } else {
          res.json({ success: false, error: { code: 'PARSE_ERROR', message: 'Could not parse graph from AI response' } })
        }
      } catch (err) {
        res.json({ success: false, error: { code: 'WORKFLOW_ERROR', message: String(err) } })
      }
    })

    app.post('/api/workflow/save', async (req, res) => {
      try {
        const { name, prompt, nodes, schedule } = req.body
        const { execFile } = await import('child_process')
        const { promisify } = await import('util')
        const execFileAsync = promisify(execFile)

        if (schedule) {
          try {
            const cronArgs = [
              'cron', 'add',
              '--name', name || 'Zeeqit Workflow',
              '--message', prompt || 'Execute workflow',
              '--cron', schedule,
              '--json',
            ]
            const { stdout } = await execFileAsync('openclaw', cronArgs, {
              timeout: 15_000,
              env: { ...process.env },
            })
            logger.info('Cron job created', { name, schedule, output: stdout.substring(0, 200) })
          } catch (err) {
            logger.warn('Failed to create cron job', {
              error: err instanceof Error ? err.message : String(err),
            })
          }
        }

        res.json(ok({ id: `wf-${Date.now()}`, name, nodes, schedule }))
      } catch (err) {
        res.json({ success: false, error: { code: 'WORKFLOW_ERROR', message: String(err) } })
      }
    })

    app.get('/api/workflow/cron-list', async (_req, res) => {
      try {
        const { execFile } = await import('child_process')
        const { promisify } = await import('util')
        const execFileAsync = promisify(execFile)

        const { stdout } = await execFileAsync('openclaw', ['cron', 'list', '--json'], {
          timeout: 10_000,
          env: { ...process.env },
        })
        res.json(ok(JSON.parse(stdout)))
      } catch (err) {
        res.json(ok({ jobs: [] }))
      }
    })

    app.post('/api/agent/run', async (req, res) => {
      try {
        const { message, model, thinking } = req.body
        const { execFile } = await import('child_process')
        const { promisify } = await import('util')
        const execFileAsync = promisify(execFile)

        const args = ['agent', '--message', message || '', '--local', '--json']
        if (model) args.push('--model', model)
        if (thinking) args.push('--thinking', thinking)

        const { stdout } = await execFileAsync('openclaw', args, {
          timeout: 120_000,
          env: { ...process.env },
        })
        res.json(ok(JSON.parse(stdout)))
      } catch (err) {
        res.json({ success: false, error: { code: 'AGENT_ERROR', message: String(err) } })
      }
    })

    app.get('/api/models/list', async (_req, res) => {
      try {
        const { execFile } = await import('child_process')
        const { promisify } = await import('util')
        const execFileAsync = promisify(execFile)

        const { stdout } = await execFileAsync('openclaw', ['models', 'list', '--json'], {
          timeout: 10_000,
        })
        res.json(ok(JSON.parse(stdout)))
      } catch (err) {
        res.json(ok({ count: 0, models: [] }))
      }
    })

    app.get('/api/skills/list', async (_req, res) => {
      try {
        const { execFile } = await import('child_process')
        const { promisify } = await import('util')
        const execFileAsync = promisify(execFile)

        const { stdout } = await execFileAsync('openclaw', ['skills', 'list', '--json'], {
          timeout: 10_000,
        })
        res.json(ok(JSON.parse(stdout)))
      } catch (err) {
        res.json(ok({ skills: [] }))
      }
    })

    app.get('/api/health', (_req, res) => {
      res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() })
    })
  }
}

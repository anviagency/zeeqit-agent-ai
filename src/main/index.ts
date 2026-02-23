import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllIpcHandlers } from './ipc/register'
import { GoLoginService } from './services/gologin/client'
import { GatewayWebSocketClient } from './services/gateway/websocket-client'
import { LogRing } from './services/diagnostics/log-ring'

const logger = LogRing.getInstance()

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#000000',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.zeeqit.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerAllIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  logger.info('Zeeqit main process started')
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  logger.info('Zeeqit shutting down, cleaning up...')

  try {
    await GoLoginService.getInstance().killOrphanedSessions()
  } catch (err) {
    logger.error('Failed to kill orphaned GoLogin sessions', err)
  }

  try {
    GatewayWebSocketClient.getInstance().disconnect()
  } catch (err) {
    logger.error('Failed to disconnect gateway', err)
  }
})

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception in main process', err)
})

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection in main process', reason)
})

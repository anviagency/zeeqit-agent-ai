import { contextBridge } from 'electron'
import { zeeqitApi } from './api'

contextBridge.exposeInMainWorld('zeeqitApi', zeeqitApi)

import { create } from 'zustand'

export interface TopologyNode {
  id: string
  type: 'service' | 'gateway' | 'browser' | 'external'
  label: string
  status: 'online' | 'offline' | 'degraded'
  metadata?: Record<string, unknown>
}

export interface TopologyEdge {
  id: string
  source: string
  target: string
  label?: string
}

interface TopologyState {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
  selectedNodeId: string | null
  isLoading: boolean

  setNodes: (nodes: TopologyNode[]) => void
  setEdges: (edges: TopologyEdge[]) => void
  selectNode: (nodeId: string | null) => void
  setLoading: (loading: boolean) => void
  getSelectedNode: () => TopologyNode | undefined
}

export const useTopologyStore = create<TopologyState>()((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  isLoading: false,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  selectNode: (selectedNodeId) => set({ selectedNodeId }),
  setLoading: (isLoading) => set({ isLoading }),
  getSelectedNode: () => {
    const { nodes, selectedNodeId } = get()
    return nodes.find((n) => n.id === selectedNodeId)
  }
}))

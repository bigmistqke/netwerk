import { Vector } from '@lib/spagett/types'
import type { Ctx } from './ctx'

export type { Ctx } from './ctx'

export type Func = (...args: any[]) => any
export type DataType = 'string' | 'number' | 'prop'

export type AtomPath = {
  libId: keyof Ctx['lib']
  atomId: string
}

interface AtomBase {
  func: (arg: { props: Record<string, Exclude<any, Function>>; ctx: Ctx; dom: HTMLElement }) => any
  props: Record<string, Parameter>
}

export interface CodeAtom extends AtomBase {
  type: 'code'
  returnType: DataType
}

export interface NetworkAtom extends AtomBase {
  type: 'network'
  nodes: Nodes
  edges: Edge[]
  selectedNodeId: string
  returnType: DataType
}

export interface RendererAtom extends AtomBase {
  type: 'renderer'
  func: (arg: { props: Record<string, Exclude<any, Function>>; ctx: Ctx }) => () => void
}

export type Atom = CodeAtom | NetworkAtom | RendererAtom

interface NodeBase {
  emits: boolean
  position: Vector
}

export interface AtomNode extends NodeBase {
  type: 'atom'
  path: AtomPath
  props: (CodeAtom | NetworkAtom)['props']
}

export interface RendererNode extends NodeBase {
  type: 'renderer'
  path: AtomPath
}

export interface PropsNode extends NodeBase {
  type: 'props'
}

export type Node = AtomNode | PropsNode | RendererNode

export type Nodes = Record<string, Node>

export type Package = Record<string, Atom>

/* NETWORK */

export type Handle = { handleId: string; nodeId: string; type: 'output' | 'input' | 'prop' }
export type Edge = { start: Handle; end: Handle }
export type Parameter<T = any> = { type: DataType; value: T }

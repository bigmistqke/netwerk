import { Vector } from '@lib/spagett/types'
import type { Ctx } from './ctx'

export type { Ctx } from './ctx'

export type Func = (...args: any[]) => any
export type DataType = 'string' | 'number' | 'prop'

export type AtomPath = {
  packageId: keyof Ctx
  atomId: string
}

export interface CodeAtom {
  func: (props: Record<string, Exclude<any, Function>>) => any
  props: Record<string, Parameter>
  returnType: DataType
}

export interface NetworkAtom extends CodeAtom {
  func: (props: Record<string, Exclude<any, Function>>) => any
  nodes: Nodes
  edges: Edge[]
  selectedNodeId: string
}

export type Atom = CodeAtom | NetworkAtom

interface NodeBase {
  position: Vector
}

export interface AtomNode extends NodeBase {
  type: 'atom'
  atom: AtomPath
  props: Atom['props']
}

export interface PropsNode extends NodeBase {
  type: 'props'
}

export type Node = AtomNode | PropsNode

export type Nodes = Record<string, Node>

export type Package = Record<string, CodeAtom | NetworkAtom>

/* NETWORK */

export type Handle = { handleId: string; nodeId: string; type: 'output' | 'input' | 'prop' }
export type Edge = { start: Handle; end: Handle }
export type Parameter<T = any> = { type: DataType; value: T }

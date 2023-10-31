import { Vector } from '@lib/spagett/types'

export type Func = (...args: any[]) => any
export type DataType = 'string' | 'number' | 'parameter'

export interface CodeAtom {
  func: (props: Record<string, Exclude<any, Function>>) => any
  parameters: Record<string, Parameter>
  returnType: DataType
}

export interface NetworkAtom extends CodeAtom {
  func: (props: Record<string, Exclude<any, Function>>) => any
  nodes: Nodes
  edges: Edge[]
  selectedNodeId: string
}

export type Atom = CodeAtom | NetworkAtom

export type Node = Atom & {
  position: Vector
}
export type Nodes = Record<string, Node>

export type Package = Record<string, CodeAtom | NetworkAtom>

/* NETWORK */

export type Handle = { handleId: string; nodeId: string }
export type Edge = { start: Handle; end: Handle }
export type Parameter<T = any> = { type: DataType; value: T }

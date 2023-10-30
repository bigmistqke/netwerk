import { Vector } from '@lib/spagett/types'

export type Handle = { handleId: string; nodeId: string }
export type Edge = { start: Handle; end: Handle }
export type Parameter<T = any> = { type: string; value: T }

export type Nodes = Record<
  string,
  {
    position: Vector
    atom: (parameters: Record<string, any>) => any
    parameters: Record<string, Parameter>
    output: any
  }
>

export type Func = (...args: any[]) => any

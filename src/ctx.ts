import { Package } from './types'

const std = {
  add: {
    func: ({ props }) => props.a + props.b,
    returnType: 'number',
    parameters: {
      a: {
        type: 'number',
        value: 1,
      },
      b: {
        type: 'number',
        value: 1,
      },
    },
  },
  multiply: {
    func: ({ props }) => props.a * props.b,
    returnType: 'number',
    parameters: {
      a: {
        type: 'number',
        value: 1,
      },
      b: {
        type: 'number',
        value: 1,
      },
    },
  },
} satisfies Package

export const ctx: {
  std: typeof std
  self: Package
} & Record<string, Package> = {
  std,
  self: {} as Package,
}

export type Ctx = typeof ctx

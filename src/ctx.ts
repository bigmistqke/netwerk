import { Package } from './types'

const std = {
  add: {
    func: args => args.a + args.b,
    returnType: 'number',
    parameters: {
      a: {
        type: 'number',
        value: 0,
      },
      b: {
        type: 'number',
        value: 0,
      },
    },
  },
  multiply: {
    func: args => args.a * args.b,
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

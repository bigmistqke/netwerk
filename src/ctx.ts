import { Package } from './types'

const std = {
  add: {
    type: 'code',
    func: ({ props }) => props.a + props.b,
    returnType: 'number',
    props: {
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
    type: 'code',
    func: ({ props }) => props.a * props.b,
    returnType: 'number',
    props: {
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
  renderer: {
    type: 'renderer',
    func: ({ ctx }) => {
      let index = 0
      return () => {
        ctx.dom.textContent = (index++).toString()
      }
    },
    props: {
      input: {
        type: 'number',
        value: 1,
      },
    },
  },
} satisfies Package

export const ctx = {
  lib: {
    std,
    self: {},
  },
  dom: document.createElement('div'),
} as {
  lib: {
    std: typeof std
    self: Package
  } & Record<string, Package>
  dom: HTMLElement
}

export type Ctx = typeof ctx

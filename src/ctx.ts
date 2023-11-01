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
} satisfies Package

export const ctx: Ctx = {
  dom: document.createElement('div'),
  event: {
    listeners: {},
    addListener: (nodeId, callback) => {
      if (!ctx.event.listeners[nodeId]) {
        ctx.event.listeners[nodeId] = []
      }
      ctx.event.listeners[nodeId].push(callback)
      return () =>
        (ctx.event.listeners[nodeId] = ctx.event.listeners[nodeId].filter(cb => cb !== callback))
    },
    emit: (nodeId, value) => {
      const listeners = ctx.event.listeners[nodeId]
      if (listeners) {
        for (const listener of listeners) {
          listener(value)
        }
      }
      return value
    },
  },
  lib: {
    std,
    self: {},
  },
}

export type Ctx = {
  dom: HTMLElement
  event: {
    emit: (value: any, id: string) => any
    listeners: Record<string, ((value: any) => void)[]>
    addListener: (nodeId: string, callback: (value: any) => void) => () => void
  }
  lib: {
    std: typeof std
    self: Package
  } & Record<string, Package>
}

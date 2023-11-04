import { Accessor } from 'solid-js'
import { Package } from './types'

const std = {
  add: {
    type: 'code',
    fn: ({ props }) => props.a + props.b,
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
    fn: ({ props }) => props.a * props.b,
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
  domRenderer: {
    type: 'renderer',
    fn: ({ dom }) => {
      dom.innerHTML = ''
      const container = document.createElement('div')
      dom.appendChild(container)
      return result => (container.textContent = result)
    },
    props: {},
  },
} satisfies Package

const memo: Record<string, any> = {}
const previous: Record<string, any> = {}

export const ctx: Ctx = {
  dom: document.createElement('div'),
  event: {
    listeners: {},
    addListener: (nodeId, callback) => {
      if (!ctx.event.listeners[nodeId]) {
        ctx.event.listeners[nodeId] = []
      }
      ctx.event.listeners[nodeId].push(callback)
      function removeListener() {
        ctx.event.listeners[nodeId] = ctx.event.listeners[nodeId].filter(cb => cb !== callback)
      }
      return removeListener
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
  equals: (id, deps) => {
    const result: ReturnType<Ctx['equals']> = {}
    if (!(id in previous)) {
      previous[id] = deps
      for (const key in deps) result[key] = false
      return result
    }
    for (const key in deps) result[key] = previous[id][key] === deps[key]
    previous[id] = deps
    return result
  },
  memo: (accessor, id, deps) => {
    if (!(id in memo)) return (memo[id] = accessor())
    return (memo[id] = !deps.some(dep => !dep) ? memo[id] : accessor())
  },
}

export type Ctx = {
  dom: HTMLElement
  event: {
    emit: (value: any, id: string) => any
    listeners: Record<string, ((value: any) => void)[]>
    addListener: (nodeId: string, callback: (value: any) => void) => () => void
  }
  memo: (value: Accessor<any>, id: number, dependencies: boolean[]) => any
  equals: (id: string, props: Record<string, any>) => Record<string, any>
  lib: {
    std: typeof std
    self: Package
  } & Record<string, Package>
}

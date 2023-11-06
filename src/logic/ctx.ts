import { Accessor, createContext, createEffect, useContext } from 'solid-js'
import { modules } from './runtime'

let memo: Record<string, any> = {}
let previous: Record<string, any> = {}

createEffect(() => {
  JSON.stringify(modules.esm)
  console.log('reset memo and previous')
  memo = {}
  previous = {}
})

export const ctx: Ctx = {
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
    // if (!deps.some(dep => !dep)) console.log('use cached value for', id, ':', memo[id])
    return (memo[id] = !deps.some(dep => !dep) ? memo[id] : accessor())
  },
  lib: modules.esm,
}

export type Ctx = {
  event: {
    emit: (value: any, id: string) => any
    listeners: Record<string, ((value: any) => void)[]>
    addListener: (nodeId: string, callback: (value: any) => void) => () => void
  }
  memo: (value: Accessor<any>, id: number, dependencies: boolean[]) => any
  equals: (id: string, props: Record<string, any>) => Record<string, any>
  lib: typeof modules.esm
}

const ctxContext = createContext<Ctx>(ctx)
export const CtxProvider = ctxContext.Provider
export const useCtx = () => useContext(ctxContext)

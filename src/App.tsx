import { Component, batch, createEffect, createMemo, createSignal } from 'solid-js'

import { createStore } from 'solid-js/store'
import Network from './Network/index'
import { compileGraph } from './compilation'
import type { Func, NetworkAtom, Nodes, Package } from './types'
import { randomFromObject } from './utils/randomFromObject'

const createNodes = (amount = 100) => {
  return Object.fromEntries(
    new Array(amount).fill('').map((_, i) => [
      i.toString(),
      {
        position: {
          x: Math.random() * 8000,
          y: Math.random() * 8000,
        },
        inputs: new Array(5).fill('').map((_, index) => index.toString()),
        handles: new Array(5).fill('').map((_, index) => index.toString()),
      },
    ]),
  )
}

const createEdges = (nodes: Nodes, amount = 50) => {
  return new Array(amount).fill('').map((_, i) => {
    const getHandle = () => {
      const [nodeId, node] = randomFromObject(nodes)
      const [handleId] = randomFromObject(node.handles)
      return {
        nodeId,
        handleId,
      }
    }
    return {
      start: getHandle(),
      end: getHandle(),
    }
  })
}

const createSum = (ctx: Record<string, Record<string, { func: Func }>>, parameters = {}) => ({
  atom: eval('ctx.std.add'),
  output: 'number',
  parameters: {
    a: {
      type: 'number',
      value: 0,
    },
    b: {
      type: 'number',
      value: 0,
    },
    ...parameters,
  },
})

const App: Component = () => {
  const [value, setValue] = createSignal(2)
  const [value2, setValue2] = createSignal(2)

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
          value: 0,
        },
        b: {
          type: 'number',
          value: 0,
        },
      },
    },
  }

  const ctx = {
    std,
    self: {} as Package,
  }

  setTimeout(() => {
    batch(() => {
      setValue(100)
      setValue2(200)
    })
  }, 1000)

  const [self, setSelf] = createStore({
    main: {
      nodes: {
        sum: {
          ...ctx.std.add,
          parameters: {
            ...ctx.std.add.parameters,
            a: {
              type: 'number',
              value: value2,
            },
            b: {
              type: 'number',
              value: 1,
            },
          },
          position: {
            x: 100,
            y: 100,
          },
        },
        sum2: {
          ...ctx.std.add,
          parameters: {
            ...ctx.std.add.parameters,
            a: {
              type: 'number',
              value,
            },
            b: {
              type: 'number',
              value: 3,
            },
          },
          position: {
            x: 200,
            y: 100,
          },
        },
        sum3: {
          ...ctx.std.add,
          parameters: {
            ...ctx.std.add.parameters,
            a: {
              type: 'number',
              value: 0,
            },
            b: {
              type: 'number',
              value: 3,
            },
          },
          position: {
            x: 300,
            y: 150,
          },
        },
        sum4: {
          ...ctx.std.add,
          parameters: {
            ...ctx.std.add.parameters,
            a: {
              type: 'number',
              value: 3,
            },
            b: {
              type: 'number',
              value: 3,
            },
          },
          position: {
            x: 200,
            y: 200,
          },
        },
        multiply: {
          ...ctx.std.multiply,
          parameters: {
            a: {
              type: 'number',
              value: 0,
            },
            b: {
              type: 'number',
              value: 2,
            },
          },
          position: {
            x: 100,
            y: 300,
          },
        },
      },
      edges: [
        // /* {
        //   start: { nodeId: 'sum', handleId: 'output' },
        //   end: { nodeId: 'sum3', handleId: 'a' },
        // },
        // {
        //   start: { nodeId: 'sum3', handleId: 'output' },
        //   end: { nodeId: 'multiply', handleId: 'a' },
        // },
        // {
        //   start: { nodeId: 'sum2', handleId: 'output' },
        //   end: { nodeId: 'sum', handleId: 'b' },
        // }, */
        // /* {
        //   start: { nodeId: 'multiply3', handleId: 'output' },
        //   end: { nodeId: 'sum2', handleId: 'a' },
        // }, */
      ],
      func: (() => {}) as Func,
      parameters: {},
      returnType: 'number',
      selectedNodeId: 'multiply',
    } as NetworkAtom,
  })
  ctx.self = self
  const compiledGraph = createMemo<Func>(
    prev => {
      try {
        const result = compileGraph(self.main)
        return result
      } catch {
        return prev
      }
    },
    () => {},
  )
  createEffect(() => console.log(compiledGraph()(value2(), value())))

  return (
    <div>
      <Network nodes={self.main.nodes} edges={self.main.edges} />
    </div>
  )
}

export default App

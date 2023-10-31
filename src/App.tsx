import { Component, Show, batch, createMemo, createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'

import Network from './Network/index'
import { compileGraph } from './compilation'
import type { Func, NetworkAtom, Package } from './types'

import styles from './App.module.css'

const App: Component = () => {
  const [selected, setSelected] = createSignal<{ packageId: keyof typeof ctx; atomId: string }>({
    packageId: 'self',
    atomId: 'main',
  })

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
  } satisfies Package

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
              type: 'parameter',
              value: 'a',
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
              type: 'parameter',
              value: 'b',
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
      parameters: {
        a: {
          value: 0,
          type: 'number',
        },
        b: {
          value: 0,
          type: 'number',
        },
      },
      returnType: 'number',
      selectedNodeId: 'multiply',
    } as NetworkAtom,
  })
  ctx.self = self

  const selectedAtom = () => (ctx[selected().packageId] as Package)[selected().atomId]

  const compiledGraph = createMemo<ReturnType<typeof compileGraph>>(
    prev => {
      try {
        // we can not directly return compileGraph
        // because otherwise we wouldn't catch it
        // if it would throw
        const result = compileGraph(selectedAtom())
        return result
      } catch (error) {
        console.error('error while compiling graph:', error)
        return prev
      }
    },
    { func: () => {}, time: 0 },
  )

  return (
    <div class={styles.panels}>
      <div class={styles.panel}>
        <h2>Atoms</h2>
        <div>
          {Object.entries(ctx).map(([packageId, _package]) => (
            <div class={styles.panel}>
              <h3>{packageId}</h3>
              <ul class={styles.list}>
                {Object.keys(_package).map(atomId => (
                  <li>
                    <button onClick={() => setSelected({ packageId, atomId })}>{atomId}</button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div class={styles.panel}>
        <Show when={'nodes' in selectedAtom() && (selectedAtom() as NetworkAtom)}>
          {atom => <Network nodes={atom().nodes} edges={self.main.edges} />}
        </Show>
      </div>
      <div class={styles.panel}>
        <h2>Compilation</h2>
        <div
          class={styles.panel__code}
          innerHTML={`(${compiledGraph().func.toString()})({a: ${value2()}, b: ${value()}})`}
        />
        <h2>Compilation Time</h2>
        <div>{compiledGraph().time.toFixed(3)}ms</div>
        <h2>Result</h2>
        <div>{compiledGraph().func({ a: value2(), b: value() })}</div>
      </div>
    </div>
  )
}

export default App

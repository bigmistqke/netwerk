import { AiFillTool } from 'solid-icons/ai'
import { Component, Show, batch, createMemo, createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'

import Network from './Network/index'
import { compileGraph, getAtomFromContext } from './compilation'
import { IconButton } from './components/IconButton'
import { LabelButton } from './components/LabelButton'
import { ctx } from './ctx'
import type { Atom, Ctx, Func, NetworkAtom } from './types'

import clsx from 'clsx'
import styles from './App.module.css'
import { Toggle } from './components/Switch'
import { isDarkMode } from './utils/isDarkMode'

const App: Component = () => {
  const [selected, setSelected] = createSignal<{ packageId: keyof Ctx; atomId: string }>({
    packageId: 'self',
    atomId: 'main',
  })

  const [value, setValue] = createSignal(2)
  const [value2, setValue2] = createSignal(2)

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
          atom: {
            packageId: 'std',
            atomId: 'add',
          },
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
          atom: {
            packageId: 'std',
            atomId: 'add',
          },
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
          atom: {
            packageId: 'std',
            atomId: 'add',
          },
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
          atom: {
            packageId: 'std',
            atomId: 'add',
          },
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
          atom: {
            packageId: 'std',
            atomId: 'multiply',
          },
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
          value: value,
          type: 'number',
        },
        b: {
          value: value2,
          type: 'number',
        },
      },
      returnType: 'number',
      selectedNodeId: 'multiply',
    } as NetworkAtom,
  })
  ctx.self = self

  const selectedAtom = () => getAtomFromContext(ctx, selected())

  const compiledGraph = createMemo<ReturnType<typeof compileGraph>>(
    prev => {
      try {
        const _selectedAtom = selectedAtom()
        if (!_selectedAtom) throw `no selected atom for path: ${JSON.stringify(selected())}`
        const result = compileGraph(ctx, _selectedAtom)
        return result
      } catch (error) {
        console.error('error while compiling graph:', error)
        return prev
      }
    },
    { func: () => {}, time: 0 },
  )

  const resolveParameters = () =>
    selectedAtom() &&
    Object.fromEntries(
      Object.entries(selectedAtom()!.parameters).map(([id, { value }]) => [
        id,
        typeof value === 'function' ? value() : value,
      ]),
    )

  const castToNetworkAtomIfPossible = (atom: Atom | undefined) =>
    atom && 'nodes' in atom && (atom as NetworkAtom)

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
                    <LabelButton
                      label={atomId}
                      onClick={() => console.log('TODO: add atom to graph')}
                    >
                      <IconButton
                        icon={<AiFillTool />}
                        label="edit"
                        onClick={() => setSelected({ packageId: packageId as keyof Ctx, atomId })}
                      />
                    </LabelButton>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div class={clsx(styles.panel, styles.panel__network)}>
        <Toggle
          class={styles.darkModeToggle}
          checked={isDarkMode()}
          onChange={checked => {
            if (checked) {
              document.body.classList.remove('dark')
              document.body.classList.add('light')
            } else {
              document.body.classList.add('dark')
              document.body.classList.remove('light')
            }
          }}
        />
        <Show when={castToNetworkAtomIfPossible(selectedAtom())}>
          {atom => <Network {...atom()} />}
        </Show>
      </div>
      <div class={styles.panel}>
        <h2>Compilation</h2>
        <div
          class={styles.panel__code}
          innerHTML={`(${compiledGraph().func.toString()})
({ "parameters": ${JSON.stringify(resolveParameters(), null, 2)}, "ctx": ${JSON.stringify(
            ctx,
            null,
            2,
          )}
})`}
        />
        <h2>Compilation Time</h2>
        <div>{compiledGraph().time.toFixed(3)}ms</div>
        <h2>Result</h2>
        <div>{compiledGraph().func({ ctx, parameters: resolveParameters() })}</div>
      </div>
    </div>
  )
}

export default App

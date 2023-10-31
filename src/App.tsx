import { AiFillTool } from 'solid-icons/ai'
import { Component, Show, batch, createEffect, createMemo, createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'
import zeptoid from 'zeptoid'

import Network from './Network/index'
import { compileGraph, getAtomFromContext } from './compilation'
import { ctx } from './ctx'
import type { Atom, AtomPath, Ctx, Func, NetworkAtom, Package } from './types'

import clsx from 'clsx'
import styles from './App.module.css'
import { Button, IconButton, LabelButton } from './components/Button'
import { Toggle } from './components/Switch'
import { isDarkMode } from './utils/isDarkMode'

const createNetworkNode = (ctx: Ctx, path: AtomPath) => ({
  [zeptoid()]: {
    atom: path,
    parameters: getAtomFromContext(ctx, path)?.parameters,
    /* TODO: add proper positioning of node */
    position: {
      x: Math.random() * 400,
      y: Math.random() * 300,
    },
  },
})

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

  const [self, setSelf] = createStore<Package>({
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
      selectedNodeId: 'sum',
    } as NetworkAtom,
    second: {
      nodes: {
        sum: {
          atom: {
            packageId: 'std',
            atomId: 'add',
          },
          func: ctx.std.add,
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
      },
      edges: [],
      func: ctx.std.add.func,
      parameters: {
        ...ctx.std.add.parameters,
        a: {
          type: 'parameter',
          value: 'a',
        },
      },
      returnType: 'number',
      selectedNodeId: 'sum',
    } as NetworkAtom,
  })
  ctx.self = self

  const selectedAtom = () => getAtomFromContext(ctx, selected())

  const compiledGraph = createMemo<ReturnType<typeof compileGraph>>(
    prev => {
      try {
        const _selectedAtom = selectedAtom()
        if (!_selectedAtom) throw `no selected atom for path: ${JSON.stringify(selected())}`
        const func = compileGraph(ctx, _selectedAtom)
        return func
      } catch (error) {
        console.error('error while compiling graph:', error)
        return prev
      }
    },
    { func: () => {}, time: 0 },
  )

  createEffect(() => {
    const func = compiledGraph().func
    if (func) setSelf(selected().atomId, 'func', () => func)
  })

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

  let atomId = 0
  const addAtomToSelf = () => {
    setSelf('atom' + atomId++, {
      nodes: {
        sum: {
          atom: {
            packageId: 'std',
            atomId: 'add',
          },
          func: ctx.std.add,
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
      },
      edges: [],
      func: (() => {}) as Func,
      parameters: {},
      returnType: 'number',
      selectedNodeId: 'sum',
    } as NetworkAtom)
  }

  return (
    <div class={styles.panels}>
      <div class={styles.panel}>
        <h2>Atoms</h2>
        <div>
          {Object.entries(ctx).map(([packageId, _package]) => (
            <div class={styles.panel}>
              <h3 class={styles.packageHeading}>
                <span>{packageId}</span>
                {packageId === 'self' ? (
                  <Button onClick={addAtomToSelf} label="add new atom">
                    +
                  </Button>
                ) : undefined}
              </h3>
              <ul class={styles.list}>
                {Object.keys(_package).map(atomId => (
                  <li>
                    <LabelButton
                      label={atomId}
                      onClick={() =>
                        setSelf(
                          selected().atomId,
                          'nodes',
                          createNetworkNode(ctx, { packageId, atomId }),
                        )
                      }
                    >
                      <IconButton
                        icon={<AiFillTool />}
                        label="edit"
                        onClick={() => setSelected({ packageId: packageId as keyof Ctx, atomId })}
                        stopPropagation
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
          {atom => (
            <Network
              nodes={atom().nodes}
              edges={atom().edges}
              setNodes={(...args) => setSelf(selected().atomId, 'nodes', ...args)}
              setEdges={(...args) => setSelf(selected().atomId, 'edges', ...args)}
              selectedNodeId={atom().selectedNodeId}
            />
          )}
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

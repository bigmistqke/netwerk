import { AiFillTool } from 'solid-icons/ai'
import { Component, Show, createEffect, createMemo, createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'
import zeptoid from 'zeptoid'

import Network from './Network/index'
import { compileGraph, getAtomFromContext } from './compilation'
import { ctx } from './ctx'
import type { Atom, AtomNode, AtomPath, Ctx, Func, NetworkAtom, Package } from './types'

import clsx from 'clsx'
import styles from './App.module.css'
import { Button, IconButton, LabelButton } from './components/Button'
import { Toggle } from './components/Switch'
import { isDarkMode } from './utils/isDarkMode'

const createNetworkNode = (ctx: Ctx, path: AtomPath): Record<string, AtomNode> => ({
  [zeptoid()]: {
    type: 'atom',
    atom: path,
    props: getAtomFromContext(ctx, path)!.props,
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

  const [self, setSelf] = createStore<Package>({
    main: {
      nodes: {
        sum: {
          type: 'atom',
          atom: {
            packageId: 'std',
            atomId: 'add',
          },
          props: {
            ...ctx.std.add.props,
          },
          position: {
            x: 100,
            y: 200,
          },
        },
        sum2: {
          type: 'atom',
          atom: {
            packageId: 'std',
            atomId: 'add',
          },
          props: {
            ...ctx.std.add.props,
          },
          position: {
            x: 300,
            y: 200,
          },
        },
        props: {
          type: 'props',
          position: {
            x: 300,
            y: 0,
          },
        },
      },
      edges: [
        {
          start: { nodeId: 'sum2', handleId: 'b', type: 'input' },
          end: { nodeId: 'props', handleId: 'b', type: 'prop' },
        },
        {
          start: { nodeId: 'sum', handleId: 'a', type: 'input' },
          end: { nodeId: 'props', handleId: 'a', type: 'prop' },
        },
      ],
      func: (() => {}) as Func,
      props: {
        a: {
          value: 0,
          type: 'number',
        },
        b: {
          value: 1,
          type: 'number',
        },
      },
      returnType: 'number',
      selectedNodeId: 'sum',
    },
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

  const resolveProps = () =>
    selectedAtom() &&
    Object.fromEntries(
      Object.entries(selectedAtom()!.props).map(([id, { value }]) => [
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
          type: 'atom',
          atom: {
            packageId: 'std',
            atomId: 'add',
          },
          func: ctx.std.add,
          props: {
            ...ctx.std.add.props,
          },
          position: {
            x: 100,
            y: 100,
          },
        },
      },
      edges: [],
      func: (() => {}) as Func,
      props: {
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
              atomId={selected().atomId}
              atom={atom()}
              setAtom={(...args: any[]) => setSelf(selected().atomId, ...args)}
            />
          )}
        </Show>
      </div>
      <div class={styles.panel}>
        <h2>Compilation</h2>
        <div
          class={styles.panel__code}
          innerHTML={`(${compiledGraph().func.toString()})
({ "props": ${JSON.stringify(resolveProps(), null, 2)}, "ctx": ${JSON.stringify(ctx, null, 2)}
})`}
        />
        <h2>Compilation Time</h2>
        <div>{compiledGraph().time.toFixed(3)}ms</div>
        <h2>Result</h2>
        <div>{compiledGraph().func({ ctx, props: resolveProps() })}</div>
      </div>
    </div>
  )
}

export default App

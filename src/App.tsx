import { AiFillTool } from 'solid-icons/ai'
import {
  Accessor,
  Component,
  For,
  Show,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  useContext,
} from 'solid-js'
import { SetStoreFunction, createStore } from 'solid-js/store'
import zeptoid from 'zeptoid'

import Network from './Network/index'
import { compileGraph, getAtomFromContext } from './compilation'
import { ctx } from './ctx'
import type {
  Atom,
  AtomNode,
  AtomPath,
  Ctx,
  Func,
  NetworkAtom,
  Package,
  RendererNode,
} from './types'

import clsx from 'clsx'
import styles from './App.module.css'
import { Button, IconButton, LabelButton } from './components/Button'
import { Toggle } from './components/Switch'
import { Title } from './components/Title'
import { isDarkMode } from './utils/isDarkMode'
import { when } from './utils/when'

const createCodeOrNetworkNode = (ctx: Ctx, path: AtomPath): Record<string, AtomNode> => {
  const props = getAtomFromContext(ctx, path)!.props
  return {
    [zeptoid()]: {
      type: 'atom',
      path,
      props,
      /* TODO: add proper positioning of node */
      position: {
        x: Math.random() * 400,
        y: Math.random() * 300,
      },
    },
  }
}

const createRendererNode = (ctx: Ctx, path: AtomPath): Record<string, RendererNode> => ({
  [zeptoid()]: {
    type: 'renderer',
    path,
    position: {
      x: Math.random() * 400,
      y: Math.random() * 300,
    },
  },
})

const ParameterPanel = (props: { atom: Atom; setAtom: SetStoreFunction<Atom> }) => {
  return (
    <div class={styles.parameterPanel}>
      <For each={Object.entries(props.atom.props)}>
        {([propId, prop]) => {
          const id1 = createUniqueId()
          const id2 = createUniqueId()
          return (
            <div>
              <h3>{propId}</h3>
              <div class={styles.parameterRow}>
                <label for={id1}>value:</label>
                <input
                  id={id1}
                  value={prop.value}
                  onChange={e => props.setAtom('props', propId, 'value', +e.currentTarget.value)}
                  onKeyDown={e => {
                    switch (e.key) {
                      case 'ArrowUp':
                        if (prop.type === 'number') {
                          props.setAtom('props', propId, 'value', value => value + 1)
                          e.preventDefault()
                        }
                        break
                      case 'ArrowDown':
                        if (prop.type === 'number') {
                          props.setAtom('props', propId, 'value', value => value - 1)
                          e.preventDefault()
                        }
                        break
                    }
                  }}
                />
                <label for={id2}>type:</label>
                <input
                  id={id2}
                  value={prop.type}
                  onChange={e => props.setAtom('props', propId, 'value', +e.currentTarget.value)}
                />
              </div>
            </div>
          )
        }}
      </For>
    </div>
  )
}

const ctxContext = createContext<{ ctx: Ctx; result: Accessor<any> }>({
  ctx,
  result: () => undefined,
})
export const useCtx = () => useContext(ctxContext)

const App: Component = () => {
  const [selected, setSelected] = createSignal<{ libId: keyof Ctx['lib']; atomId: string }>({
    libId: 'self',
    atomId: 'main',
  })

  const [self, setSelf] = createStore<Package>({
    main: {
      type: 'network',
      nodes: {
        sum: {
          type: 'atom',
          path: {
            libId: 'std',
            atomId: 'add',
          },
          props: {
            ...ctx.lib.std.add.props,
          },
          position: {
            x: 100,
            y: 600,
          },
          emits: false,
        },
        sum2: {
          type: 'atom',
          path: {
            libId: 'std',
            atomId: 'add',
          },
          props: {
            ...ctx.lib.std.add.props,
          },
          position: {
            x: 100,
            y: 200,
          },
          emits: false,
        },
        sum3: {
          type: 'atom',
          path: {
            libId: 'std',
            atomId: 'add',
          },
          props: {
            ...ctx.lib.std.add.props,
          },
          position: {
            x: 100,
            y: 300,
          },
          emits: false,
        },
        sum4: {
          type: 'atom',
          path: {
            libId: 'std',
            atomId: 'add',
          },
          props: {
            ...ctx.lib.std.add.props,
          },
          position: {
            x: 100,
            y: 400,
          },
          emits: false,
        },
        props: {
          type: 'props',
          position: {
            x: 500,
            y: 0,
          },
        },
      },
      edges: [
        {
          start: { nodeId: 'sum2', handleId: 'b', type: 'output' },
          end: { nodeId: 'props', handleId: 'a', type: 'prop' },
        },
        {
          end: { nodeId: 'sum3', handleId: 'b', type: 'input' },
          start: { nodeId: 'sum2', handleId: 'output', type: 'output' },
        },
        {
          end: { nodeId: 'sum3', handleId: 'a', type: 'input' },
          start: { nodeId: 'sum2', handleId: 'output', type: 'output' },
        },
        {
          end: { nodeId: 'sum4', handleId: 'b', type: 'input' },
          start: { nodeId: 'sum3', handleId: 'output', type: 'output' },
        },
        {
          end: { nodeId: 'sum', handleId: 'b', type: 'input' },
          start: { nodeId: 'sum4', handleId: 'output', type: 'output' },
        },
        {
          end: { nodeId: 'sum', handleId: 'a', type: 'input' },
          start: { nodeId: 'sum4', handleId: 'output', type: 'output' },
        },
      ],
      fn: (() => {}) as Func,
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
  ctx.lib.self = self
  window.ctx = ctx

  const selectedAtom = () => getAtomFromContext(ctx, selected())

  const resolveProps = () =>
    selectedAtom() &&
    Object.fromEntries(
      Object.entries(selectedAtom()!.props).map(([id, { value }]) => [
        id,
        typeof value === 'function' ? value() : value,
      ]),
    )

  let atomId = 0
  const createAtom = () => {
    const id = 'atom' + atomId++
    const sumId = zeptoid()
    const propsId = zeptoid()
    setSelf(id, {
      type: 'network',
      nodes: {
        [sumId]: {
          type: 'atom',
          path: {
            libId: 'std',
            atomId: 'add',
          },
          fn: ctx.lib.std.add,
          props: {
            ...ctx.lib.std.add.props,
          },
          position: {
            x: 100,
            y: 400,
          },
          emits: false,
        },
        [propsId]: {
          type: 'props',
          position: {
            x: 100,
            y: 100,
          },
        },
      },
      edges: [
        {
          start: { nodeId: sumId, handleId: 'b', type: 'input' },
          end: { nodeId: propsId, handleId: 'b', type: 'prop' },
        },
        {
          start: { nodeId: sumId, handleId: 'a', type: 'input' },
          end: { nodeId: propsId, handleId: 'a', type: 'prop' },
        },
      ],
      fn: (() => {}) as Func,
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
      selectedNodeId: sumId,
    } as NetworkAtom)
    setSelected({ libId: 'self', atomId: id })
  }
  const addNodeToSelectedNetworkAtom = (atom: Atom, path: AtomPath) => {
    setCurrentAtom(
      'nodes',
      atom.type === 'renderer' ? createRendererNode(ctx, path) : createCodeOrNetworkNode(ctx, path),
    )
  }
  const setCurrentAtom = (...args: any[]) => setSelf(selected().atomId, ...args)

  const compiledGraph = createMemo<ReturnType<typeof compileGraph>>(
    prev => {
      try {
        const _selectedAtom = selectedAtom()
        if (!_selectedAtom) throw `no selected atom for path: ${JSON.stringify(selected())}`
        const fn = compileGraph({
          ctx,
          graph: _selectedAtom,
          path: selected(),
        })
        return fn
      } catch (error) {
        console.error('error while compiling graph:', error)
        return prev
      }
    },
    { fn: () => {}, time: 0 },
  )

  createEffect(() => {
    const fn = compiledGraph().fn
    if (fn) setSelf(selected().atomId, 'fn', () => fn)
  })

  const [result, setResult] = createSignal()

  createEffect(() => {
    const props = resolveProps()
    const fn = compiledGraph().fn
    /* setTimeout(() => */ setResult(fn({ ctx, props })) /* , 0) */
  })

  return (
    <ctxContext.Provider
      value={{
        ctx,
        result,
      }}
    >
      <div class={styles.panels}>
        <div class={styles.panel}>
          <Title title="Atoms" />
          <div>
            {Object.entries(ctx.lib).map(([libId, _package]) => (
              <div class={styles.panel}>
                <Title title={libId} as="h3" class={styles.packageHeading}>
                  <span>{libId}</span>
                  {libId === 'self' ? (
                    <Button onClick={createAtom} label="add new atom">
                      +
                    </Button>
                  ) : undefined}
                </Title>
                <ul class={styles.list}>
                  {Object.keys(_package).map(atomId => (
                    <li>
                      <LabelButton
                        label={atomId}
                        onClick={() =>
                          addNodeToSelectedNetworkAtom(_package[atomId], { libId: libId, atomId })
                        }
                      >
                        <IconButton
                          icon={<AiFillTool />}
                          label="edit"
                          onClick={() => setSelected({ libId: libId as keyof Ctx, atomId })}
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
          <Show when={when(selectedAtom)(atom => 'nodes' in atom && (atom as NetworkAtom))}>
            {atom => (
              <>
                <ParameterPanel atom={atom()} setAtom={setCurrentAtom} />
                <Network
                  atomId={selected().atomId}
                  atom={atom()}
                  setAtom={setCurrentAtom}
                  ctx={ctx}
                />
              </>
            )}
          </Show>
        </div>
        <div class={styles.panel}>
          <Title title="Compilation" />
          <div class={styles.panel__code}>
            <span innerHTML={`(${compiledGraph().fn.toString()})`} />
            <span
              innerHTML={`({ "props": ${JSON.stringify(
                resolveProps(),
                null,
                2,
              )}, "ctx": ${JSON.stringify(ctx, null, 2)}
})`}
            />
          </div>
          <Title title="Compilation Time" />
          <div class={styles.panelContent}>{compiledGraph().time.toFixed(3)}ms</div>
          <Title title="Result" />
          <div class={styles.panelContent}>{result()}</div>
        </div>
      </div>
    </ctxContext.Provider>
  )
}

export default App

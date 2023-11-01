import { AiFillTool } from 'solid-icons/ai'
import {
  Component,
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
} from 'solid-js'
import { createStore } from 'solid-js/store'
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

const ParameterPanel = (props: { atom: Atom }) => {
  const [atom, setAtom] = createStore(props.atom)

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
                  onChange={e => setAtom('props', propId, 'value', +e.currentTarget.value)}
                />
                <label for={id2}>type:</label>
                <input
                  id={id2}
                  value={prop.type}
                  onChange={e => setAtom('props', propId, 'value', +e.currentTarget.value)}
                />
              </div>
            </div>
          )
        }}
      </For>
    </div>
  )
}

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
            y: 200,
          },
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
  ctx.lib.self = self

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
    setSelf(id, {
      type: 'network',
      nodes: {
        sum: {
          type: 'atom',
          path: {
            libId: 'std',
            atomId: 'add',
          },
          func: ctx.std.add,
          props: {
            ...ctx.lib.std.add.props,
          },
          position: {
            x: 100,
            y: 400,
          },
        },
        props: {
          type: 'props',
          position: {
            x: 100,
            y: 100,
          },
        },
      },
      edges: [
        {
          start: { nodeId: 'sum', handleId: 'b', type: 'input' },
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
          value: 0,
          type: 'number',
        },
      },
      returnType: 'number',
      selectedNodeId: 'sum',
    } as NetworkAtom)
    setSelected({ libId: 'self', atomId: id })
  }
  const addNodeToSelectedAtom = (atom: Atom, path: AtomPath) => {
    setSelf(
      selected().atomId,
      'nodes',
      atom.type === 'renderer' ? createRendererNode(ctx, path) : createCodeOrNetworkNode(ctx, path),
    )
  }

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

  return (
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
                        addNodeToSelectedAtom(_package[atomId], { libId: libId, atomId })
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
              <ParameterPanel atom={atom()} />
              <Network
                atomId={selected().atomId}
                atom={atom()}
                setAtom={(...args: any[]) => setSelf(selected().atomId, ...args)}
                ctx={ctx}
              />
            </>
          )}
        </Show>
      </div>
      <div class={styles.panel}>
        <Title title="Compilation" />
        <div class={styles.panel__code}>
          <span innerHTML={`(${compiledGraph().func.toString()})`} />
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
        <div class={styles.panelContent}>
          {compiledGraph().func({ ctx, props: resolveProps() })}
        </div>
      </div>
    </div>
  )
}

export default App

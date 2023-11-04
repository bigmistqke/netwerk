import { ContextMenu } from '@kobalte/core'
import clsx from 'clsx'
import {
  ComponentProps,
  For,
  Index,
  Match,
  Show,
  Switch,
  createEffect,
  createRenderEffect,
  createSignal,
  onCleanup,
  onMount,
  splitProps,
} from 'solid-js'
import type { SetStoreFunction } from 'solid-js/store'

import { Anchor, Edge, Graph, Handle, Html, Node } from '@lib/spagett'
import type { Vector } from '@lib/spagett/types'
import { useCtx as useRuntime } from '../App'
import type {
  Atom,
  AtomNode,
  AtomNode as AtomNodeType,
  Ctx,
  Edge as EdgeType,
  Handle as HandleType,
  NetworkAtom,
  PropsNode,
} from '../types'

import styles from './Network.module.css'

const Step = (_props: { start: Vector; end: Vector } & ComponentProps<'path'>) => {
  const [props, rest] = splitProps(_props, ['start', 'end'])
  const middle = () => ({
    x: props.start.x - (props.start.x - props.end.x) / 2,
    y: props.start.y - (props.start.y - props.end.y) / 2,
  })
  const d = () => {
    const start = props.start
    const end = props.end

    return `M ${start.x} ${start.y} L ${start.x} ${middle().y} ${end.x} ${middle().y} ${end.x} ${
      end.y
    }`
  }
  return (
    <>
      <path stroke="var(--color-front)" fill="transparent" d={d()} {...rest} />
      <Html.Portal>
        <div
          style={{ position: 'absolute', transform: `translate(${middle().x}px, ${middle().y}px)` }}
        ></div>
      </Html.Portal>
    </>
  )
}

const PropsNodeContextMenu = (props: {
  props: Atom['props']
  setProps: (props: Atom['props']) => void
  removeNode: () => void
}) => {
  return (
    <>
      <ContextMenu.Portal>
        <ContextMenu.Content class={styles['context-menu__content']}>
          <ContextMenu.Item class={styles['context-menu__item']} closeOnSelect={false}>
            Edit Properties
          </ContextMenu.Item>
          <ContextMenu.Separator class={styles['context-menu__separator']} />
          <ContextMenu.Item class={styles['context-menu__item']}>Duplicate</ContextMenu.Item>
          <ContextMenu.Item onClick={props.removeNode} class={styles['context-menu__item']}>
            Delete
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </>
  )
}

const PropsNode = (props: {
  atomId: string
  nodeId: string
  onDrop: (start: HandleType, end: HandleType) => void
  onDragHandle: (
    handle: HandleType,
    position: Vector,
    hoveringHandle: HandleType | undefined,
  ) => void
  props: Atom['props']
  removeNode: () => void
  setTemporaryEdges: (edge: EdgeType | undefined) => void
  setProps: (props: Partial<Atom['props']>) => void
}) => {
  return (
    <>
      <PropsNodeContextMenu
        props={props.props}
        setProps={props.setProps}
        removeNode={props.removeNode}
      />
      <div class={styles.nodeName}>Props</div>
      <div class={clsx(styles.handles, styles.out)}>
        <Index each={Object.entries(props.props)}>
          {handleEntry => {
            const [handleId] = handleEntry()
            return (
              <Handle
                onMove={(position, hoveringHandle) =>
                  props.onDragHandle(
                    { nodeId: props.nodeId, handleId: handleId, type: 'prop' },
                    position,
                    hoveringHandle,
                  )
                }
                type="prop"
                onMoveEnd={() => props.setTemporaryEdges(undefined)}
                onConnect={handle =>
                  props.onDrop(handle, { nodeId: props.nodeId, handleId: handleId, type: 'prop' })
                }
                class={styles.handle}
                id={handleId}
              >
                <Anchor style={{ bottom: '0%', left: '50%', transform: 'translate(-50%, 0%)' }} />
                <span>{handleId}</span>
              </Handle>
            )
          }}
        </Index>
      </div>
    </>
  )
}

const AtomNodeContextMenu = (props: {
  emits: boolean
  selected: boolean
  selectNode: () => void
  removeNode: () => void
  toggleEmit: () => void
}) => {
  return (
    <>
      <ContextMenu.Portal>
        <ContextMenu.Content class={styles['context-menu__content']}>
          <Show when={!props.selected}>
            <ContextMenu.Item class={styles['context-menu__item']} onClick={props.selectNode}>
              Watch <div class={styles['context-menu__item-right-slot']}>⌘+W</div>
            </ContextMenu.Item>
          </Show>
          <ContextMenu.Item class={styles['context-menu__item']} onClick={props.toggleEmit}>
            <Show when={props.emits} fallback="Emit">
              Stop Emitting
            </Show>
          </ContextMenu.Item>
          <ContextMenu.Separator class={styles['context-menu__separator']} />
          <ContextMenu.Item
            class={styles['context-menu__item']}
            onChange={e => {
              e.stopPropagation()
              e.preventDefault()
            }}
            closeOnSelect={false}
          >
            Edit Properties
          </ContextMenu.Item>
          <ContextMenu.Item class={styles['context-menu__item']}>Edit Network</ContextMenu.Item>
          <ContextMenu.Separator class={styles['context-menu__separator']} />
          <ContextMenu.Item class={styles['context-menu__item']}>Duplicate</ContextMenu.Item>
          <ContextMenu.Item class={styles['context-menu__item']} onClick={props.removeNode}>
            Delete
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </>
  )
}

const Renderer = (props: { value: any }) => {
  let dom: HTMLDivElement
  const runtime = useRuntime()
  onMount(() => {
    const render = runtime.ctx.lib.std.domRenderer.fn({ dom, ctx: runtime.ctx })
    createEffect(() => render(props.value))
  })
  return <div ref={dom!} class={clsx(styles.rendererNode, styles.node)} />
}

const AtomNode = (props: {
  selected: boolean
  node: AtomNodeType
  nodeId: string
  onDragHandle: (
    handle: HandleType,
    position: Vector,
    hoveringHandle: HandleType | undefined,
  ) => void
  setTemporaryEdges: (edge: EdgeType | undefined) => void
  onDrop: (start: HandleType, end: HandleType) => void
  selectNode: () => void
  removeNode: () => void
  toggleEmit: () => void
}) => {
  const [value, setValue] = createSignal()
  const runtime = useRuntime()

  createRenderEffect(() => {
    if (props.node.emits) {
      const unsubscribe = runtime.ctx.event.addListener(props.nodeId, value => {
        setValue(value)
      })
      onCleanup(unsubscribe)
    }
  })

  const currentValue = () =>
    (props.selected && runtime.result() !== undefined && runtime.result()) ||
    (props.node.emits && value() !== undefined && value())

  createEffect(() => {
    console.log('current', currentValue())
  })

  return (
    <>
      <AtomNodeContextMenu
        emits={props.node.emits}
        selected={props.selected}
        selectNode={props.selectNode}
        removeNode={props.removeNode}
        toggleEmit={props.toggleEmit}
      />
      <div class={styles.handles}>
        <Index each={Object.keys(props.node.props)}>
          {_handleId => {
            const handleId = _handleId()
            return (
              <Handle
                onMove={(position, hoveringHandle) =>
                  props.onDragHandle(
                    { nodeId: props.nodeId, handleId: handleId, type: 'input' },
                    position,
                    hoveringHandle,
                  )
                }
                type="input"
                onMoveEnd={() => props.setTemporaryEdges(undefined)}
                onConnect={handle =>
                  props.onDrop(handle, { nodeId: props.nodeId, handleId: handleId, type: 'input' })
                }
                class={styles.handle}
                id={handleId}
              >
                <Anchor style={{ top: '0%', left: '50%', transform: 'translate(-50%, 0%)' }} />
                <span>{handleId}</span>
              </Handle>
            )
          }}
        </Index>
      </div>
      <div class={styles.nodeName}>
        <span>
          {props.node.path?.atomId.charAt(0).toUpperCase() + props.node.path?.atomId.slice(1)}
        </span>
      </div>

      <div class={clsx(styles.handles, styles.out)}>
        <Handle
          onMove={(position, hoveringHandle) =>
            props.onDragHandle(
              { nodeId: props.nodeId, handleId: 'output', type: 'output' },
              position,
              hoveringHandle,
            )
          }
          type="output"
          onMoveEnd={() => props.setTemporaryEdges(undefined)}
          onConnect={handle =>
            props.onDrop(handle, { nodeId: props.nodeId, handleId: 'output', type: 'output' })
          }
          id="output"
          class={styles.handle}
        >
          <Anchor style={{ bottom: '0px', left: '50%', transform: 'translate(-50%, 0%)' }} />
        </Handle>
      </div>

      <Show when={currentValue()}>
        <Renderer value={currentValue()} />
      </Show>
    </>
  )
}

/**
 * Network mutates the nodes- and edges-store
 * */
export default function Network(props: {
  atomId: string
  atom: NetworkAtom
  setAtom: SetStoreFunction<NetworkAtom>
  ctx: Ctx
}) {
  const [temporaryEdges, setTemporaryEdges] = createSignal<{
    start: Vector | HandleType
    end: Vector | HandleType
  }>()

  /* GRAPH MUTATIONS */
  const moveNode = (nodeId: string, position: Vector) =>
    props.setAtom('nodes', nodeId, { position })
  const removeNode = (nodeId: string) => {
    props.setAtom('nodes', nodeId, undefined)
    removeEdgeFromNodeId(nodeId)
  }
  const selectNode = (nodeId: string) => props.setAtom('selectedNodeId', nodeId)
  const toggleEmitNode = (nodeId: string) => {
    props.setAtom('nodes', nodeId, 'emits', b => {
      if (!b) {
        console.info(`start listening to events with:`)
        console.info(`ctx.event.addListener("${nodeId}", console.log)`)
      }
      return !b
    })
  }

  const removeEdgeFromIndex = (index: number) =>
    props.setAtom('edges', x => {
      x.splice(index, 1)
      return [...x]
    })
  const removeEdgeFromNodeId = (nodeId: string) =>
    props.setAtom('edges', edges =>
      edges.filter(edge => edge.end.nodeId !== nodeId && edge.start.nodeId !== nodeId),
    )
  const addEdge = (edge: EdgeType) => {
    props.setAtom('edges', edges => [...edges, edge])
  }

  /* UTILITIES */
  const validateDrop = (start: HandleType, end: HandleType) => {
    if (start.nodeId === end.nodeId) return false
    if (start.type === end.type) return false
    return true
  }

  /* EVENT HANDLERS */
  const onDragHandle = (handle: HandleType, end: Vector, connectingHandle?: HandleType) =>
    connectingHandle && validateDrop(handle, connectingHandle)
      ? setTemporaryEdges({
          start: handle,
          end: connectingHandle,
        })
      : setTemporaryEdges({
          start: handle,
          end,
        })

  const onDropHandle = (start: HandleType, end: HandleType) =>
    validateDrop(start, end) && addEdge({ start, end })

  return (
    <Graph
      /* added timeout so it would reset selected texts */
      onPanStart={() => setTimeout(() => document.body.classList.add('panning'), 0)}
      onPanEnd={() => document.body.classList.remove('panning')}
      class={styles.graph}
    >
      <Html.Destination>
        <For each={props.atom.edges}>
          {(edge, index) => (
            <Edge start={edge.start} end={edge.end}>
              {(start, end) => (
                <Step
                  start={start}
                  end={end}
                  class={styles.edge}
                  onDblClick={() => removeEdgeFromIndex(index())}
                />
              )}
            </Edge>
          )}
        </For>
      </Html.Destination>
      <Html>
        <For each={Object.keys(props.atom.nodes)}>
          {nodeId => {
            const node = () => props.atom.nodes[nodeId]
            return (
              <ContextMenu.Root>
                <ContextMenu.Trigger class="context-menu__trigger">
                  <Node
                    position={node().position}
                    id={nodeId}
                    onMove={position => moveNode(nodeId, position)}
                    class={clsx(
                      styles.node,
                      nodeId === props.atom.selectedNodeId && styles.selected,
                      styles[node().type],
                    )}
                    tabIndex={0}
                    onDblClick={() => selectNode(nodeId)}
                  >
                    <Switch>
                      <Match when={node().type === 'atom'}>
                        <AtomNode
                          selected={nodeId === props.atom.selectedNodeId}
                          node={node() as AtomNode}
                          nodeId={nodeId}
                          onDragHandle={onDragHandle}
                          setTemporaryEdges={setTemporaryEdges}
                          onDrop={onDropHandle}
                          selectNode={() => props.setAtom('selectedNodeId', nodeId)}
                          removeNode={() => removeNode(nodeId)}
                          toggleEmit={() => toggleEmitNode(nodeId)}
                        />
                      </Match>
                      <Match when={node().type === 'props'}>
                        <PropsNode
                          atomId={props.atomId}
                          props={props.atom.props}
                          nodeId={nodeId}
                          onDragHandle={onDragHandle}
                          setTemporaryEdges={setTemporaryEdges}
                          onDrop={onDropHandle}
                          setProps={_props => props.setAtom('props', _props)}
                          removeNode={() => removeNode(nodeId)}
                        />
                      </Match>
                    </Switch>
                  </Node>
                </ContextMenu.Trigger>
              </ContextMenu.Root>
            )
          }}
        </For>
      </Html>
      <Show when={temporaryEdges()}>
        {edge => (
          <Edge start={edge().start} end={edge().end} class={styles.edge}>
            {(start, end) => <Step start={start} end={end} />}
          </Edge>
        )}
      </Show>
    </Graph>
  )
}

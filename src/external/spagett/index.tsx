import clsx from 'clsx'
import type { Accessor, ComponentProps, JSX, ParentProps } from 'solid-js'
import {
  Show,
  children,
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  splitProps,
  untrack,
  useContext,
} from 'solid-js'
import { createStore } from 'solid-js/store'

import type { Handle as HandleType, Vector } from './types'
import { cursor } from './utils/cursor'
import { vector } from './utils/vector'

import styles from './spagett.module.css'

/* HTML */

export const Html = function (props: ComponentProps<'foreignObject'>) {
  const [classProp, rest] = splitProps(props, ['class'])
  return (
    <foreignObject class={clsx(styles.foreignObject, classProp)} {...rest}>
      {props.children}
    </foreignObject>
  )
}

const htmlContext = createContext<{
  add: (element: Accessor<JSX.Element>) => void
  remove: (element: Accessor<JSX.Element>) => void
}>()
const useHtmlDestinationContext = () => useContext(htmlContext)

Html.Destination = (props: ComponentProps<typeof Html>) => {
  const [elements, setElements] = createSignal<Accessor<JSX.Element>[]>([])
  const api = {
    add: (element: Accessor<JSX.Element>) => {
      setElements(elements => [...elements, element])
    },
    remove: (element: Accessor<JSX.Element>) => {
      setElements(elements => elements?.filter(e => e !== element))
    },
  }
  return (
    <>
      <htmlContext.Provider value={api}>
        <Html {...props}>{elements() as any as JSX.Element}</Html>
        {props.children}
      </htmlContext.Provider>
    </>
  )
}
Html.Portal = (props: ParentProps) => {
  const htmlDestinationContext = useHtmlDestinationContext()
  const childs = children(() => props.children)

  createEffect(() => {
    if (!htmlDestinationContext) return
    htmlDestinationContext?.add(childs)
  })
  onCleanup(() => htmlDestinationContext?.remove(childs))

  return <></>
}

/* NODE */

const nodeContext = createContext<{
  addHandle: (handleId: string, getPosition: Accessor<Vector>) => void
  removeHandle: (handleId: string) => void
  id: string
  position: Vector
}>()
const useGraphToNode = () => useContext(nodeContext)

export const Node = function (
  _props: ParentProps<{
    id: string
    position: Vector
    onMove: (position: Vector) => void
    children: JSX.Element
    style?: JSX.CSSProperties
    class?: string
  }> &
    Omit<ComponentProps<'div'>, 'style' | 'onDrag'>,
) {
  const [props, rest] = splitProps(_props, [
    'children',
    'class',
    'id',
    'onMove',
    'position',
    'style',
  ])
  const graphContext = useGraph()

  if (!graphContext) throw 'Node should be sibling of Graph'

  const onMouseDown = (e: MouseEvent) => {
    const start = { ...props.position }
    cursor(e, delta => {
      props.onMove({
        x: start.x - delta.x / graphContext.zoom,
        y: start.y - delta.y / graphContext.zoom,
      })
    })
  }

  const addHandle = (handleId: string, getHandlePosition: Accessor<Vector>) => {
    let delta: Vector
    graphContext?.addHandle(props.id, handleId, {
      get position() {
        if (!delta) delta = vector.subtract(getHandlePosition(), props.position)
        return vector.add(props.position, delta)
      },
    })
  }

  const removeHandle = (handleId: string) => graphContext?.removeHandle(props.id, handleId)

  return (
    <nodeContext.Provider
      value={{
        addHandle,
        removeHandle,
        position: props.position,
        get id() {
          return props.id
        },
      }}
    >
      <div
        style={{
          position: 'absolute',
          transform: `translate(${props.position.x}px, ${props.position.y}px)`,
          ...props.style,
        }}
        class={props.class}
        onMouseDown={onMouseDown}
        {...rest}
      >
        {props.children}
      </div>
    </nodeContext.Provider>
  )
}

/* HANDLE */

const handleToAnchorContext = createContext<{
  id: string
  addAnchor: (getPosition: Accessor<Vector>) => void
  removeAnchor: () => void
}>()
const useHandleToAnchor = () => useContext(handleToAnchorContext)

export function Handle(
  props: ParentProps<{
    id: string
    onMove?: (handle: Vector, hoveringHandle?: HandleType) => void
    onMoveStart?: () => void
    onMoveEnd?: () => void
    onConnect?: (handle: HandleType) => void
    style?: JSX.CSSProperties
    position?: Vector
    class?: string
    type: string
  }>,
) {
  const graphToNode = useGraphToNode()
  const graphToAnchor = useGraphToAnchor()
  const graph = useGraph()

  let ref: HTMLDivElement
  const [bounds, setBounds] = createSignal<DOMRect>()
  const [anchor, setAnchor] = createSignal<Accessor<Vector> | undefined>(undefined)

  if (!graphToNode) throw 'Handle should be sibling of Node'
  if (!graphToAnchor || !graph) throw 'Handle should be sibling of Graph'

  const getPositionFromBounds = () => {
    const _bounds = bounds() || setBounds(ref.getBoundingClientRect())
    return {
      x: _bounds.x + _bounds.width / 2 - graph.pan.x - graph.offset.x,
      y: _bounds.y + _bounds.height / 2 - graph.pan.y - graph.offset.y,
    }
  }

  onMount(() =>
    graphToNode?.addHandle(
      props.id,
      () => anchor?.()?.() || props.position || getPositionFromBounds(),
    ),
  )

  const onMouseDown = async (e: MouseEvent) => {
    e.stopPropagation()

    const position = {
      x: e.clientX,
      y: e.clientY,
    }

    graphToAnchor.setDraggingHandle({
      handleId: props.id,
      nodeId: graphToNode.id,
      type: props.type,
    })

    props.onMoveStart?.()

    await cursor(e, delta => {
      props.onMove?.(
        vector.subtract(vector.subtract(position, graph.offset), delta),
        graphToAnchor.hoveringHandle,
      )
    })

    props.onMoveEnd?.()
    graphToAnchor.setDraggingHandle(undefined)
  }

  const onMouseUp = () =>
    graphToAnchor.draggingHandle && props.onConnect && props.onConnect(graphToAnchor.draggingHandle)

  const onMouseMove = () => {
    if (!graphToAnchor.draggingHandle) return
    if (
      graphToAnchor.draggingHandle.handleId === props.id &&
      graphToAnchor.draggingHandle.nodeId === graphToNode.id
    )
      return

    graphToAnchor.setHoveringHandle({
      handleId: props.id,
      nodeId: graphToNode.id,
      type: props.type,
    })
  }

  const onMouseOut = () => {
    if (
      graphToAnchor.hoveringHandle?.nodeId !== graphToNode?.id ||
      graphToAnchor.hoveringHandle?.handleId !== props.id
    )
      return

    graphToAnchor.setHoveringHandle(undefined)
  }

  return (
    <div
      ref={ref!}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseMove={onMouseMove}
      onMouseOut={onMouseOut}
      style={{
        position: 'relative',
        ...props.style,
      }}
      class={props.class}
    >
      <handleToAnchorContext.Provider
        value={{
          id: props.id,
          addAnchor: anchor => setAnchor(() => anchor),
          removeAnchor: () => setAnchor(undefined),
        }}
      >
        {props.children}
      </handleToAnchorContext.Provider>
    </div>
  )
}

/* ANCHOR */

export function Anchor(props: {
  children?: JSX.Element
  position?: Vector
  style: JSX.CSSProperties
}) {
  const graphToNode = useGraphToNode()
  const handleToAnchor = useHandleToAnchor()
  const graph = useGraph()
  let ref: HTMLDivElement

  if (!graph) throw 'Handle should be sibling of Graph'
  if (!graphToNode) throw 'Handle should be sibling of Node'
  if (!handleToAnchor) throw 'Handle should be sibling of Handle'

  const getPositionFromBounds = () => {
    const bounds = ref.getBoundingClientRect()
    return {
      x: bounds.x + bounds.width / 2 - graph.pan.x - graph.offset.x,
      y: bounds.y + bounds.height / 2 - graph.pan.y - graph.offset.y,
    }
  }

  onMount(() => handleToAnchor.addAnchor(() => props.position || getPositionFromBounds()))

  return (
    <div ref={ref!} style={{ ...props.style, position: 'absolute' }}>
      {props.children}
    </div>
  )
}

/* EDGE */

export const Edge = (props: {
  start: { handleId: string; nodeId: string } | Vector
  end: { handleId: string; nodeId: string } | Vector
  children?: (start: Vector, end: Vector) => JSX.Element
  class?: string
}) => {
  const graphContext = useGraph()

  const start = () =>
    graphContext
      ? 'x' in props.start
        ? vector.subtract(
            props.start,
            untrack(() => graphContext.pan),
          )
        : graphContext.sceneGraph[props.start.nodeId]?.[props.start.handleId]?.position
      : undefined
  const end = () =>
    graphContext
      ? 'x' in props.end
        ? vector.subtract(
            props.end,
            untrack(() => graphContext.pan),
          )
        : graphContext?.sceneGraph[props.end.nodeId]?.[props.end.handleId]?.position
      : undefined

  return (
    <Show
      when={start() && end() && props.children}
      fallback={
        <line
          class={clsx(styles.line, props.class)}
          x1={start()?.x}
          y1={start()?.y}
          x2={end()?.x}
          y2={end()?.y}
        />
      }
    >
      {props.children?.(start()!, end()!)}
    </Show>
  )
}

/* GRAPH */

type SceneGraph = Record<string, Record<string, { position: Vector }>>

const graphContext = createContext<{
  addHandle: (nodeId: string, handleId: string, handle: SceneGraph[string][string]) => void
  removeHandle: (nodeId: string, handleId: string) => void
  sceneGraph: SceneGraph
  pan: Vector
  zoom: number
  offset: Vector
}>()
const useGraph = () => useContext(graphContext)

const currentHandleContext = createContext<{
  draggingHandle: undefined | HandleType
  setDraggingHandle: (handle: undefined | HandleType) => void
  hoveringHandle: undefined | HandleType
  setHoveringHandle: (handle: undefined | HandleType) => void
}>()
const useGraphToAnchor = () => useContext(currentHandleContext)

export const getHandlePosition = (nodeId: string, handleId: string) => {
  const graphContext = useGraph()
  return graphContext?.sceneGraph[nodeId]?.[handleId]?.position
}

export function Graph(
  props: ParentProps<{
    style?: JSX.CSSProperties
    onPanStart?: (pan: Vector) => void
    onPanEnd?: (pan: Vector) => void
    class?: string
  }>,
) {
  let svgRef: SVGSVGElement
  const [sceneGraph, setSceneGraph] = createStore<SceneGraph>({})

  const [draggingHandle, setDraggingHandle] = createSignal<HandleType | undefined>()
  const [hoveringHandle, setHoveringHandle] = createSignal<HandleType | undefined>()

  const [pan, setPan] = createSignal<Vector>({ x: 0, y: 0 })
  const [zoom, setZoom] = createSignal(1)
  const [offset, setOffset] = createSignal<Vector>({ x: 0, y: 0 })

  const addHandle = (nodeId: string, handleId: string, handle: SceneGraph[string][string]) => {
    setSceneGraph(nodeId, { [handleId]: handle })
  }

  const removeHandle = (nodeId: string, handleId: string) =>
    setSceneGraph(nodeId, handleId, undefined)

  const onMouseDown = async (e: MouseEvent) => {
    if (e.currentTarget !== e.target) return
    const start = { ...pan() }
    props.onPanStart?.(pan())
    await cursor(e, delta => {
      setPan({
        x: start.x - delta.x,
        y: start.y - delta.y,
      })
    })
    props.onPanEnd?.(pan())
  }

  const onWheel = (e: WheelEvent) => {
    /* TODO: properly implement zooming, currently disabled because bit buggy */
    return
    const newZoom = zoom() + e.deltaY / 100
    if (newZoom > 2 || newZoom < 0.1) return

    const cursor = vector.multiply(
      {
        x: e.clientX,
        y: e.clientY,
      },
      zoom(),
    )
    const newCursor = vector.multiply(vector.divide(cursor, zoom()), newZoom)

    const newPan = vector.multiply(vector.divide(pan(), zoom()), newZoom)
    const offset = vector.subtract(cursor, newCursor)

    setZoom(newZoom)
    setPan(newPan)
    setPan(vector.add(newPan, vector.divide(offset, zoom())))
  }

  const initOffset = () => {
    const bounds = svgRef!.getBoundingClientRect()
    setOffset({
      x: bounds.x,
      y: bounds.y,
    })
  }
  const observer = new MutationObserver(initOffset)
  onMount(() => {
    initOffset()
    observer.observe(svgRef, { attributes: true, childList: true, subtree: true })
  })

  return (
    <graphContext.Provider
      value={{
        addHandle,
        removeHandle,
        sceneGraph,
        get offset() {
          return offset()
        },
        get pan() {
          return pan()
        },
        get zoom() {
          return zoom()
        },
      }}
    >
      <currentHandleContext.Provider
        value={{
          get draggingHandle() {
            return draggingHandle()
          },
          setDraggingHandle,
          get hoveringHandle() {
            return hoveringHandle()
          },
          setHoveringHandle,
        }}
      >
        <svg
          style={{
            width: '100%',
            height: '100%',
            ...props.style,
          }}
          ref={svgRef!}
          class={clsx(styles.svg, props.class)}
          onMouseDown={onMouseDown}
          onWheel={onWheel}
          overflow="visible"
        >
          <g
            style={{
              transform: `translate(${pan().x}px, ${pan().y}px) scale(${zoom()})`,
              'will-change': 'transform',
              'pointer-events': 'none',
            }}
          >
            {props.children}
          </g>
        </svg>
      </currentHandleContext.Provider>
    </graphContext.Provider>
  )
}

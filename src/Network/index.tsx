import { For, Index, Show, createSignal } from 'solid-js'

import { Anchor, Edge, Graph, Handle, Html, Node } from '@lib/spagett'
import type { Vector } from '@lib/spagett/types'
import { createStore } from 'solid-js/store'
import type { Edge as EdgeType, Handle as HandleType, Nodes } from 'src/types'

const Step = (props: { start: Vector; end: Vector }) => {
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
      <path stroke="black" fill="transparent" d={d()} />
      <Html.Portal>
        <div
          style={{ position: 'absolute', transform: `translate(${middle().x}px, ${middle().y}px)` }}
        ></div>
      </Html.Portal>
    </>
  )
}

/**
 * Network mutates the nodes- and edges-store
 * */
export default function Network(props: { nodes: Nodes; edges: EdgeType[] }) {
  const [nodes, setNodes] = createStore(props.nodes)
  const [edges, setEdges] = createStore(props.edges)

  const [temporaryEdges, setTemporaryEdges] = createSignal<{
    start: Vector | HandleType
    end: Vector | HandleType
  }>()

  const validateDrop = (start: HandleType, end: HandleType) => {
    if (start.nodeId === end.nodeId) return false
    if (start.handleId === 'output' && end.handleId !== 'output') return true
    if (start.handleId !== 'output' && end.handleId === 'output') return true
    return false
  }

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

  const onDrop = (start: HandleType, end: HandleType) =>
    validateDrop(start, end) && setEdges(edges => [...edges, { start, end }])

  return (
    <Graph style={{ height: '100vh', width: '100vw' }}>
      <Html.Destination>
        <For each={edges}>
          {edge => (
            <Edge start={edge.start} end={edge.end}>
              {(start, end) => <Step start={start} end={end} />}
            </Edge>
          )}
        </For>
      </Html.Destination>
      <Html>
        <For each={Object.entries(nodes)}>
          {([nodeId, node]) => (
            <Node
              position={node.position}
              id={nodeId}
              onDrag={position => setNodes(nodeId, { position })}
              style={{
                background: 'blue',
                color: 'black',
              }}
            >
              <div style={{ display: 'flex', gap: '5px' }}>
                <Index each={Object.entries(node.parameters)}>
                  {handleEntry => {
                    const [handleId, value] = handleEntry()
                    return (
                      <Handle
                        onDrag={(position, hoveringHandle) =>
                          onDragHandle({ nodeId, handleId: handleId }, position, hoveringHandle)
                        }
                        onDragEnd={() => setTemporaryEdges(undefined)}
                        onDrop={handle => onDrop(handle, { nodeId, handleId: handleId })}
                        id={handleId}
                      >
                        <Anchor style={{ top: '0px', left: '50%' }} />
                        {handleId}
                        {handleEntry()[1].value}
                      </Handle>
                    )
                  }}
                </Index>
              </div>
              {nodeId}
              <Handle
                onDrag={(position, hoveringHandle) =>
                  onDragHandle({ nodeId, handleId: 'output' }, position, hoveringHandle)
                }
                onDragEnd={() => setTemporaryEdges(undefined)}
                onDrop={handle => onDrop(handle, { nodeId, handleId: 'output' })}
                id="output"
              >
                output
              </Handle>
            </Node>
          )}
        </For>
      </Html>
      <Show when={temporaryEdges()}>
        {edge => (
          <Edge start={edge().start} end={edge().end}>
            {(start, end) => <Step start={start} end={end} />}
          </Edge>
        )}
      </Show>
    </Graph>
  )
}

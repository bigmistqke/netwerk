import {
  onCleanup,
  onMount,
  createUniqueId,
  For,
  createSignal,
  createEffect,
  Show,
  createMemo,
} from 'solid-js'
import { JSX } from 'solid-js/jsx-runtime'
import { createStore } from 'solid-js/store'

function createTeleport<T>() {
  const [elements, setElements] = createStore<{
    [key: string]: { element: JSX.Element; data: T }
  }>({})

  // let Destinations: string[] = []
  const [destinations, setDestinations] = createSignal<string[]>([])

  type StartProps = unknown extends T
    ? {
        children: JSX.Element | JSX.Element[]
      }
    : {
        data: T
        children: JSX.Element | JSX.Element[]
      }

  function Start(props: StartProps) {
    const id = createUniqueId()

    onMount(() => {
      if ('data' in props) {
        setElements(id, {
          element: createMemo(() => props.children),
          data: props.data,
        })
      } else {
        setElements(id, {
          element: createMemo(() => props.children),
        })
      }
    })

    createEffect(() => {
      if ('data' in props) {
        console.log('data')
        setElements(id, 'data', props.data)
      }
    })

    onCleanup(() => {
      setElements(id, undefined)
    })

    return <></>
  }

  function Destination(props: {
    children?: (
      elements: { element: JSX.Element; data: T }[]
    ) => JSX.Element | JSX.Element[]
  }) {
    const id = createUniqueId()
    const [error, setError] = createSignal(false)
    onMount(() => {
      setDestinations((destinations) => [...destinations, id])
      if (destinations().length > 1) {
        console.error('multiple Teleport.Destinations detected')
        setError(true)
      }
    })
    onCleanup(() => {
      setDestinations((destinations) =>
        destinations.filter((destination) => destination !== id)
      )
    })
    createEffect(() => {
      if (
        error() &&
        (destinations().length === 1 || destinations()[0] === id)
      ) {
        console.log('errored Teleport.Destinations started working again')
        setError(false)
      }
    })
    return (
      <Show when={!error()}>
        <Show
          when={props.children}
          fallback={
            <For each={Object.values(elements)}>{({ element }) => element}</For>
          }
        >
          {elements ? props.children!(Object.values(elements)) : undefined}
        </Show>
      </Show>
    )
  }

  return { Start, Destination }
}

export default createTeleport

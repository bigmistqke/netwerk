import { Component, createEffect, createMemo, createSignal } from 'solid-js'
import Network from './Network/index'
import { createIntermediaryFromGraph } from './createIntermediaryFromGraph'
import type { Nodes } from './types'
import { randomFromObject } from './utils/randomFromObject'

const createNodes = (amount = 100) => {
  return Object.fromEntries(
    new Array(amount).fill('').map((_, i) => [
      i.toString(),
      {
        position: {
          x: Math.random() * 8000,
          y: Math.random() * 8000,
        },
        inputs: new Array(5).fill('').map((_, index) => index.toString()),
        handles: new Array(5).fill('').map((_, index) => index.toString()),
      },
    ]),
  )
}

const createEdges = (nodes: Nodes, amount = 50) => {
  return new Array(amount).fill('').map((_, i) => {
    const getHandle = () => {
      const [nodeId, node] = randomFromObject(nodes)
      const [handleId] = randomFromObject(node.handles)
      return {
        nodeId,
        handleId,
      }
    }
    return {
      start: getHandle(),
      end: getHandle(),
    }
  })
}

const App: Component = () => {
  const [value, setValue] = createSignal(2)

  setTimeout(() => {
    setValue(100)
  }, 1000)

  const sum = eval('(args)=>args.a+args.b')
  const multiplyString = '(args)=>args.a*args.b'

  const createSum = (parameters: Record<string, any>) => ({
    func: sum,
    output: 'number',
    parameters: {
      a: {
        type: 'number',
        value: 0,
      },
      b: {
        type: 'number',
        value: 0,
      },
      ...parameters,
    },
  })

  const multiply = {
    func: eval(multiplyString),
    output: 'multiply',
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
  }

  const nodes: Nodes = {
    sum: {
      ...createSum({
        a: {
          type: 'number',
          value,
        },
        b: {
          type: 'number',
          value: 0,
        },
      }),
      position: {
        x: 100,
        y: 100,
      },
    },
    sum2: {
      ...createSum({
        a: {
          type: 'number',
          value: 1,
        },
        b: {
          type: 'number',
          value: 3,
        },
      }),
      position: {
        x: 200,
        y: 100,
      },
    },
    sum3: {
      ...createSum({
        a: {
          type: 'number',
          value: 1,
        },
        b: {
          type: 'number',
          value: 3,
        },
      }),
      position: {
        x: 200,
        y: 0,
      },
    },
    multiply: {
      ...multiply,
      position: {
        x: 100,
        y: 300,
      },
    },
  }

  const edges = [
    {
      start: { nodeId: 'sum', handleId: 'output' },
      end: { nodeId: 'multiply', handleId: 'a' },
    },
    {
      start: { nodeId: 'sum2', handleId: 'output' },
      end: { nodeId: 'multiply', handleId: 'b' },
    },
    {
      start: { nodeId: 'sum3', handleId: 'output' },
      end: { nodeId: 'sum2', handleId: 'a' },
    },
  ]

  const intermediary = createMemo(() =>
    createIntermediaryFromGraph({ nodes, edges, selectedNodeId: 'multiply' }),
  )

  const compiledCode = createMemo(() => eval(intermediary().compile()))

  createEffect(() => {
    console.log(compiledCode(), compiledCode()(value()))
  })

  return (
    <div>
      <Network nodes={nodes} edges={edges} />
    </div>
  )
}

export default App

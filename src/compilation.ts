import { createLazyMemo } from '@solid-primitives/memo'
import { createMemo, createSignal, type Accessor, type Setter } from 'solid-js'

import { Edge, Nodes } from './types'

type PropsAccessor<T = any> = {
  [TKey in keyof T]: T[TKey] | Node | Accessor<T[TKey]>
}
type Func = (...args: any[]) => any

const resolveProps = <T>(_props: T) => {
  const props = {} as T
  for (const key in _props) {
    const prop = _props[key]
    if (typeof prop === 'function') {
      props[key] = prop()
      continue
    }
    if (typeof prop === 'object' && 'exec' in prop) {
      props[key] = prop.exec()
      continue
    }
    props[key] = prop
  }
  return props
}

let id = 0
class Node<TProps = Record<string, any>, T extends Func = (props: TProps) => any> {
  func: T
  props: Accessor<PropsAccessor<TProps>>
  id = ++id
  setProps: (props: Partial<PropsAccessor<TProps>>) => void
  constructor(func: T, props: PropsAccessor<TProps>) {
    this.func = func
    const [_props, setProps] = createSignal<PropsAccessor<TProps>>(props)
    this.props = _props
    this.setProps = props => setProps(p => ({ ...p, ...props }))
  }
  private resolveProps() {
    return resolveProps(this.props)
  }
  setFunc(func: T) {
    this.func = func
  }
  createInstance() {
    return new Node(this.func, this.props())
  }
  toIntermediary(
    functionMap: Map<Func, FunctionCache>,
    nodeMap: Map<Node, NodeCache>,
    parameterMap: Map<Accessor<any>, string>,
  ) {
    const props = { ...this.props() }
    let pure = true
    let self = this as Node
    for (const key in props) {
      let prop = this.props()[key]!

      if (typeof prop === 'function') {
        /* a function as entry-point will mark a path as impure */
        pure = false
        props[key] = prop
        continue
      }

      /* this prop is a Node */
      if (typeof prop === 'object' && 'exec' in prop) {
        const _node = nodeMap.get(self as Node)
        if (_node) {
          /* 
            The parent-node was already initialized in nodeMap:
            This means that we visited the same node at least two times.
            We mark the node in the nodeMap as visited.
            This will initialize node-memoization during code-generation.
          */
          _node.visited = true
        }

        const compilation = (prop as Node).toIntermediary(functionMap, nodeMap, parameterMap)

        if (!nodeMap.has(self as Node)) {
          /* 
            we initialize this node to the node-pool
          */
          nodeMap.set(self as Node, {
            id: (uuid.node++).toString(),
            visited: false,
            intermediary: compilation,
            used: false,
          })
        }

        if (compilation.pure) {
          /* 
            if the compilation-result of this node is pure,
            we can immediately execute the result.
          */
          props[key] = eval(`${(prop as Node).func.toString()}`)(compilation.props)
          continue
        }

        /* 
          if it was impure, we store the intermediary result
        */
        pure = false
        props[key] = compilation
        continue
      }

      props[key] = prop
    }

    if (!functionMap.has(this.func)) {
      functionMap.set(this.func, { id: `__fn__${uuid.function++}`, used: false })
    }

    return {
      pure,
      func: this.func,
      props,
      node: self,
    }
  }
  exec = createLazyMemo(() => {
    return this.func instanceof Network ? this.func.exec() : this.func(this.resolveProps())
  })
}

class Parameter<T> {
  exec: Accessor<T>
  set: Setter<T>
  name: string
  constructor(name: string, value: T) {
    const [signal, setSignal] = createSignal(value)
    this.exec = signal
    this.set = setSignal
    this.name = name
  }
  toJSON() {
    return {
      name: this.name,
      value: this.exec(),
    }
  }
}

const intermediaryToCode = (
  intermediary: ReturnType<Node['toIntermediary']>,
  functions: Map<Func, FunctionCache>,
  nodes: Map<Node, NodeCache>,
  parameters: Map<Accessor<any>, string>,
) => {
  const node = nodes.get(intermediary.node)

  if (functions.has(intermediary.func)) {
    functions.get(intermediary.func)!.used = true
  }

  let string = ''
  string += `(`
  string += functions.get(intermediary.func)?.id || intermediary.func.toString()
  string += ')({'
  Object.entries(intermediary.props).forEach(([propId, prop]) => {
    string += propId
    string += ': '
    if (typeof prop === 'object') {
      const resolvedProps = intermediaryToCode(prop, functions, nodes, parameters)
      if (node?.visited) {
        console.log('node.id is ', node.id)
        node.used = true
        string += `__node__${node.id}`
      } else {
        string += resolvedProps
      }
    } else if (typeof prop === 'function') {
      let id = parameters.get(prop)
      if (!id) {
        id = 'parameter__' + uuid.parameter++
        parameters.set(prop, id)
      }
      string += id
    } else {
      string += prop
    }
    string += ','
  })
  string += '})'

  return string
}

type FunctionCache = {
  id: string
  used: boolean
}

type NodeCache = {
  id: string
  visited: boolean
  intermediary: any
  used: boolean
}

class Network {
  nodes: Node[] = []
  selectedNode: Accessor<Node | undefined>
  selectNode: (node: Node) => void
  constructor() {
    const [selectedNode, setSelectedNode] = createSignal<Node>()
    this.selectNode = node => setSelectedNode(node)
    this.selectedNode = selectedNode
  }
  createNode<
    TProps extends Record<string, Exclude<any, Function>>,
    T extends (props: TProps) => any,
  >(func: T, props: PropsAccessor) {
    const node = new Node(func, props)
    this.nodes.push(node)
    return node
  }
  exec(): any {
    return this.selectedNode?.()?.exec()
  }
  toCode() {
    /* !CAUTION! we mutate nodes and paremeters inside toIntermediary !CAUTION! */
    const functions = new Map<Func, FunctionCache>()
    const nodes = new Map<Node, NodeCache>()
    const parameters = new Map<Accessor<any>, string>()
    const intermediary = this.selectedNode()?.toIntermediary(functions, nodes, parameters)!

    const code = intermediaryToCode(intermediary, functions, nodes, parameters)

    const functionsToCode = Array.from(functions.entries())
      .filter(([, { used }]) => used)
      .map(([func, data]) => `const ${data.id} = ${func.toString()};`)

    const usedNodesToCode = Array.from(nodes.values())
      .filter(node => node.used)
      .map(
        node =>
          `const __node__${node.id} = ${intermediaryToCode(
            node.intermediary,
            functions,
            nodes,
            parameters,
          )};`,
      )

    return `
(${Array.from(parameters.values()).join(', ')}) => {
  ${[...functionsToCode, ...usedNodesToCode].join('\n  ')}\n
  return ${code}
}`
  }
}

let uuid = {
  parameter: 0,
  function: 0,
  node: 0,
}
export const createIntermediaryFromGraph = (graph: {
  nodes: Nodes
  edges: Edge[]
  selectedNodeId: keyof Nodes
}) => {
  uuid = {
    function: 0,
    node: 0,
    parameter: 0,
  }
  const network = new Network()
  const nodes = Object.fromEntries(
    Object.entries(graph.nodes).map(([nodeId, node]) => {
      return [
        nodeId,
        network.createNode(
          node.func,
          Object.fromEntries(
            Object.entries(node.parameters).map(([id, parameter]) => {
              return [id, parameter.value]
            }),
          ),
        ),
      ]
    }),
  )
  for (const edge of graph.edges) {
    nodes[edge.end.nodeId].setProps({
      [edge.end.handleId]: nodes[edge.start.nodeId],
    })
  }
  network.selectNode(nodes[graph.selectedNodeId])
  return network
}

export const compileGraph = (graph: {
  nodes: Nodes
  edges: Edge[]
  selectedNodeId: keyof Nodes
}) => {
  return createMemo(prev => {
    try {
      const code = createIntermediaryFromGraph(graph).toCode()
      const result = eval(code)
      console.log('code:\n', code)
      return result
    } catch (err) {
      console.error(err)
      return prev
    }
  })
}

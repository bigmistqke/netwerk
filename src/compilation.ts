import { createLazyMemo } from '@solid-primitives/memo'
import { createMemo, createSignal, type Accessor, type Setter } from 'solid-js'

import { Edge, Nodes } from './types'
import { mergeGetters } from './utils/mergeGetters'

type PropsAccessor<T> = {
  [TKey in keyof T]: T[TKey] | { exec: Accessor<T[TKey]> } | Accessor<T[TKey]>
}

const math = {
  add: ({ a, b }: { a: number; b: number }) => a + b,
}

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
class Node<
  TProps extends Record<string, Exclude<any, Function>> = Record<string, Exclude<any, Function>>,
  T extends (props: TProps) => any = (props: TProps) => any,
> {
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
    nodes: Map<Node, { id: string; visited: boolean }>,
    parameters: Map<Accessor<any>, string>,
  ) {
    const props = { ...this.props() }
    let pure = true
    let self = this as Node
    for (const key in props) {
      const prop = this.props()[key]
      if (typeof prop === 'function') {
        /* a function as entry-point will mark a path as impure */
        pure = false
        props[key] = prop
        continue
      }
      if (typeof prop === 'object' && 'exec' in prop) {
        if (nodes.has(self)) {
          const node = nodes.get(self)!
          if (!node.visited) nodes.set(self, { id: node.id, visited: true })
        } else {
          nodes.set(self, { id: (uuid++).toString(), visited: false })
        }

        // const parameters = new Map<Accessor<any>, string>()
        const compilation = prop.toIntermediary(nodes, parameters)
        if (!compilation.pure) {
          pure = false
          props[key] = compilation
          continue
        }

        props[key] = eval(`${prop.func.toString()}`)(compilation.props)
        continue
      }

      props[key] = prop
    }
    return {
      pure,
      func: this.func,
      props,
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

let uuid = 0
const intermediaryToCode = (
  intermediary: {
    func: (props: Record<string, any>) => any
    props: Record<string, any>
  },
  parameters: Map<Accessor<any>, string>,
) => {
  let string = ''
  string += '('
  string += intermediary.func.toString()
  string += ')({'
  Object.entries(intermediary.props).forEach(([propId, prop]) => {
    string += propId
    string += ': '

    if (typeof prop === 'object') {
      const resolvedProps = intermediaryToCode(prop, parameters)
      string += resolvedProps
    } else if (typeof prop === 'function') {
      let id = parameters.get(prop)
      if (!id) {
        id = 'parameter__' + uuid++
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

class Network<TProps extends Record<string, any>> {
  nodes: Node[] = []
  selectedNode: Accessor<Node | undefined>
  selectNode: (node: Node) => void
  parameters: TProps
  constructor() {
    const [selectedNode, setSelectedNode] = createSignal<Node>()
    this.selectNode = node => setSelectedNode(node)
    this.selectedNode = selectedNode
    this.parameters = {} as TProps
  }
  createParameter<T>(key: keyof TProps, value: T) {
    const parameter = new Parameter(key, value)
    this.parameters = mergeGetters(this.parameters, {
      get [key]() {
        return parameter.exec()
      },
      set [key](value: T) {
        parameter.set(value)
      },
    })
    return parameter
  }
  setParameter<TKey extends keyof TProps>(key: TKey, value: TProps[TKey]) {
    this.parameters[key] = value
  }
  createNode<
    TProps extends Record<string, Exclude<any, Function>>,
    T extends ((props: TProps) => any) | Network<TProps>,
  >(func: T, props: PropsAccessor<TProps>) {
    const node = new Node<TProps, T>(func, props)
    this.nodes.push(node)
    return node
  }
  exec(): any {
    return this.selectedNode?.()?.exec()
  }
  toCode() {
    const nodes = new Map<Node, { id: string; visited: boolean }>()
    const parameters = new Map<Accessor<any>, string>()
    const intermediary = this.selectedNode()?.toIntermediary(nodes, parameters)!
    const code = intermediaryToCode(intermediary, parameters)
    return `(${Array.from(parameters.values()).join(', ')}) => (${code})`
  }
}

export const createIntermediaryFromGraph = (graph: {
  nodes: Nodes
  edges: Edge[]
  selectedNodeId: keyof Nodes
}) => {
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
      console.log('code: ', code)
      return result
    } catch (err) {
      console.error(err)
      return prev
    }
  })
}

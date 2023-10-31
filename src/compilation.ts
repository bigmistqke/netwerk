import { ctx } from './App'
import type { Atom, AtomPath, Edge, Func, Nodes } from './types'

type PropsAccessor<T = any> = {
  [TKey in keyof T]: T[TKey] | Node | (() => T[TKey])
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
type CompilationCache = {
  atom: Map<Func, FunctionCache>
  node: Map<Node<Record<string, any>, (props: Record<string, any>) => any>, NodeCache>
  parameter: Map<() => any, string>
}

const uuid_reset = {
  parameter: 0,
  atom: 0,
  node: 0,
  nodeCache: 0,
}
let uuid = { ...uuid_reset }

const resolveProps = <T>(_props: T) => {
  const props = {} as T
  for (const key in _props) {
    const prop = _props[key]
    if (typeof prop === 'function') {
      props[key] = prop()
      continue
    }
    if (prop && typeof prop === 'object' && 'exec' in prop) {
      /* ugly type-cast ¯\_(ツ)_/¯ */
      props[key] = (prop as unknown as Node).exec()
      continue
    }
    props[key] = prop
  }
  return props
}

class Node<TProps = Record<string, any>, T extends Func = (props: TProps) => any> {
  atom: T
  props: PropsAccessor<TProps>
  id = ++uuid.node
  updateProps: (props: Partial<PropsAccessor<TProps>>) => void
  constructor(atom: T, props: PropsAccessor<TProps>) {
    this.atom = atom
    this.props = { ...props }
    this.updateProps = props => (this.props = { ...this.props, ...props })
  }
  private resolveProps() {
    return resolveProps(this.props)
  }
  toIntermediary(cache: CompilationCache) {
    const props = { ...this.props }
    let pure = true
    let self = this as Node
    for (const key in props) {
      let prop = this.props[key]!

      if (typeof prop === 'function') {
        /* a function as entry-point will mark a path as impure */
        pure = false
        props[key] = prop
        continue
      }

      /* props with type parameter are marked with a symbol */
      if (isParameter(prop)) {
        props[key] = prop
        pure = false
        continue
      }

      /* this prop is a Node */
      if (typeof prop === 'object' && 'exec' in prop) {
        const node_cache = cache.node.get(prop as Node)
        if (node_cache) {
          /* 
            The prop/node was already initialized in nodeMap:
            This means that we visited the same node at least two times.
            We mark the node in the nodeMap as visited.
            This will initialize node-memoization during code-generation.
          */
          node_cache.visited = true
        }

        const intermediary = (prop as Node).toIntermediary(cache)

        if (!node_cache) {
          /* 
            we initialize this props/node to the node-pool
          */
          cache.node.set(prop as Node, {
            id: (uuid.nodeCache++).toString(),
            visited: false,
            intermediary,
            used: false,
          })
        }

        if (intermediary.pure) {
          /* 
            if the compilation-result of this node is pure,
            we can immediately execute the result.
          */
          props[key] = eval(`${(prop as Node).atom.toString()}`)(intermediary.props)
          continue
        }

        /* 
          if it was impure, we store the intermediary result
        */
        pure = false
        props[key] = intermediary
        continue
      }

      props[key] = prop
    }

    if (!cache.atom.has(this.atom)) {
      cache.atom.set(this.atom, { id: `__fn__${uuid.atom++}`, used: false })
    }

    return {
      pure,
      atom: this.atom,
      props,
      node: self,
    }
  }
  exec = () => (this.atom instanceof Network ? this.atom.exec() : this.atom(this.resolveProps()))
}

class Network {
  nodes: Node[] = []
  selectedNode: Node | undefined = undefined
  selectNode = (node: Node) => (this.selectedNode = node)
  createNode<
    TProps extends Record<string, Exclude<any, Function>>,
    T extends (props: TProps) => any,
  >(atom: T | undefined, props: PropsAccessor) {
    const node = new Node(atom, props)
    this.nodes.push(node)
    return node
  }
  exec(): any {
    return this.selectedNode?.exec()
  }
  toCode() {
    /* !CAUTION! we mutate cache inside toIntermediary !CAUTION! */
    const cache: CompilationCache = {
      atom: new Map(),
      node: new Map(),
      parameter: new Map(),
    }

    const intermediary = this.selectedNode?.toIntermediary(cache)!
    const code = intermediaryToCode(intermediary, cache)

    const atomsToCode = Array.from(cache.atom.entries())
      .filter(([, { used }]) => used)
      .map(([atom, data]) => `const ${data.id} = ${atom.toString()};`)

    const usedNodesToCode = Array.from(cache.node.values())
      .filter(node => node.used)
      .map(node => `const __node__${node.id} = ${intermediaryToCode(node.intermediary, cache)};`)

    return `
(parameters) => {
  ${[...atomsToCode, ...usedNodesToCode].join('\n  ')}\n
  return ${code}
}`
  }
}

const $PARAM = Symbol('parameter')
const isParameter = (value: any) => typeof value === 'object' && $PARAM in value

/**
 *
 */
const getFuncFromContext = (context: typeof ctx, path: AtomPath): Func | undefined =>
  context[path.packageId]?.[path.atomId]?.func

const createIntermediaryFromGraph = (
  context: typeof ctx,
  graph: {
    nodes: Nodes
    edges: Edge[]
    selectedNodeId: keyof Nodes
  },
) => {
  /* reset uuid */
  uuid = { ...uuid_reset }
  const network = new Network()
  const nodes = Object.fromEntries(
    Object.entries(graph.nodes).map(([nodeId, node]) => {
      const func = getFuncFromContext(context, node.atom)
      if (!func) throw 'could not find func'
      return [
        nodeId,
        network.createNode(
          func,
          Object.fromEntries(
            Object.entries(node.parameters).map(([id, parameter]) => {
              return [
                id,
                parameter.type === 'parameter'
                  ? {
                      [$PARAM]: true,
                      ...parameter,
                    }
                  : parameter.value,
              ]
            }),
          ),
        ),
      ]
    }),
  )
  for (const edge of graph.edges) {
    nodes[edge.end.nodeId].updateProps({
      [edge.end.handleId]: nodes[edge.start.nodeId],
    })
  }
  network.selectNode(nodes[graph.selectedNodeId])
  return network
}

const intermediaryToCode = (
  intermediary: ReturnType<Node['toIntermediary']>,
  cache: CompilationCache,
) => {
  if (cache.atom.has(intermediary.atom)) {
    cache.atom.get(intermediary.atom)!.used = true
  }

  let string = ''
  string += `(`
  /* if atom is in the cache it means its value is memoized */
  string += cache.atom.get(intermediary.atom)?.id || intermediary.atom.toString()
  string += ')({'
  const entries = Object.entries(intermediary.props)
  for (const entry of entries) {
    const [propId, prop] = entry

    string += propId
    string += ': '

    const node = cache.node.get(prop.node)

    if (typeof prop === 'object') {
      if (prop.type === 'parameter') {
        string += 'parameters.'
        string += prop.value
        string += ','
        continue
      }
      const code = intermediaryToCode(prop, cache)
      if (node?.visited) {
        node.used = true
        string += `__node__${node.id}`
        string += ','
        continue
      }
      string += code
      string += ','
      continue
    }
    string += prop
    string += ','
  }
  string += '})'

  return string
}

/**
 * compiles NetworkAtom to a single function. simply returns CodeAtom's func-property.
 * @throws `!WARNING!` `!CAN THROW!` `!WARNING!`
 */
export const compileGraph = (context: typeof ctx, graph: Atom) => {
  let start = performance.now()
  const code = 'nodes' in graph && createIntermediaryFromGraph(context, graph).toCode()
  return {
    func: code ? eval(code) : graph.func,
    time: performance.now() - start,
  }
}

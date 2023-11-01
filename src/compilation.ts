import type { Atom, AtomPath, Ctx, Edge, Func, Nodes } from './types'

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
  emits: boolean
}
type CompilationCache = {
  atom: Map<Func, FunctionCache>
  node: Map<Node<Record<string, any>, (props: Record<string, any>) => any>, NodeCache>
  prop: Map<() => any, string>
}

const uuid_reset = {
  prop: 0,
  atom: 0,
  node: 0,
  nodeCache: 0,
}
let uuid = { ...uuid_reset }

const $PROP = Symbol('prop')
const isProp = (value: any) => typeof value === 'object' && $PROP in value

export const getAtomFromContext = (ctx: Ctx, path: AtomPath): Atom | undefined => {
  const result = ctx.lib[path?.libId]?.[path?.atomId]
  if (!result) {
    console.error('getAtomFromContext is undefined:', ctx, path, ctx.lib[path?.libId])
  }
  return result
}

export const getFuncFromContext = (ctx: Ctx, path: AtomPath): Func | undefined => {
  const result = getAtomFromContext(ctx, path)?.func
  if (!result) {
    console.error('getFuncFromContext is undefined:', ctx, path)
  }
  return result
}

const generateCodeFromAtomPath = (path: AtomPath) => `ctx.lib.${path.libId}.${path.atomId}.func`

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
  path: AtomPath
  props: PropsAccessor<TProps>
  id: string
  emits = false
  updateProps: (props: Partial<PropsAccessor<TProps>>) => void
  constructor(id: string, path: AtomPath, atom: T, props: PropsAccessor<TProps>, emits: boolean) {
    this.id = id
    this.path = path
    this.atom = atom
    this.emits = emits
    this.props = { ...props }
    this.updateProps = props => (this.props = { ...this.props, ...props })
  }
  private resolveProps() {
    return resolveProps(this.props)
  }
  toIntermediary({ ctx, cache }: { ctx: Ctx; cache: CompilationCache }) {
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

      /* handles that are connected to a props-node are marked as prop */
      if (isProp(prop)) {
        props[key] = prop
        pure = false
        continue
      }

      /* this prop is a Node */

      if (/* typeof prop === 'object' && 'exec' in prop */ prop instanceof Node) {
        const node_cache = cache.node.get(prop)
        if (node_cache) {
          /* 
            The prop/node was already initialized in nodeMap:
            This means that we visited the same node at least two times.
            We mark the node in the nodeMap as visited.
            This will initialize node-memoization during code-generation.
          */
          node_cache.visited = true
        }

        const intermediary = prop.toIntermediary({ cache, ctx })

        if (!node_cache) {
          /* 
            we initialize this props/node to the node-pool
          */
          cache.node.set(prop, {
            id: prop.id,
            visited: false,
            intermediary,
            used: false,
            emits: prop.emits,
          })
        }

        if (intermediary.pure) {
          /* 
            if the compilation-result of this node is pure,
            we can immediately execute the result.
          */
          const result = eval(`${prop.atom.toString()}`)({
            props: intermediary.props,
            ctx,
          })
          if (prop.emits) ctx.event.emit(prop.id, result)
          props[key] = result
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
      path: self.path,
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
  >(id: string, path: AtomPath, func: T | undefined, props: PropsAccessor, emits: boolean) {
    const node = new Node(id, path, func, props, emits)
    this.nodes.push(node)
    return node
  }
  exec(): any {
    return this.selectedNode?.exec()
  }
  toCode(ctx: Ctx) {
    /* !CAUTION! we mutate cache inside toIntermediary !CAUTION! */
    const cache: CompilationCache = {
      atom: new Map(),
      node: new Map(),
      prop: new Map(),
    }

    if (!this.selectedNode) {
      console.error('Network.selectedNode is undefined')
      return
    }

    const intermediary = this.selectedNode?.toIntermediary({ cache, ctx })!

    const code = intermediaryToCode(ctx, intermediary, cache)

    /* const atomsToCode = Array.from(cache.atom.entries())
      .filter(([, { used }]) => used)
      .map(([atom, data]) => `const ${data.id} = ${atom.toString()};`) */

    const usedNodesToCode = Array.from(cache.node.values())
      .filter(node => node.used)
      .map(node => {
        let body = intermediaryToCode(ctx, node.intermediary, cache).join('')
        body = node.emits ? `ctx.event.emit("${node.id}", ${body})` : body
        return `const __node__${node.id} = ${body};`
      })

    const body = [...usedNodesToCode, `return ${code.join('')}\n`]
      /* prefix with padding */
      .map(v => `\n  ${v}`)
      .join('')

    return `({props, ctx}) => {${body}}`
  }
}

const createIntermediaryFromGraph = (
  ctx: Ctx,
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
    Object.entries(graph.nodes)
      .map(([nodeId, node]) => {
        if (node.type === 'props') return [nodeId, undefined]

        const func = getFuncFromContext(ctx, node.path)
        if (!func) throw 'could not find func'

        return [
          nodeId,
          network.createNode(
            nodeId,
            node.path,
            func,
            'props' in node
              ? Object.fromEntries(
                  Object.entries(node.props).map(([id, prop]) => {
                    const edge = graph.edges.find(
                      edge =>
                        (edge.start.nodeId === nodeId && edge.start.handleId === id) ||
                        (edge.end.nodeId === nodeId && edge.end.handleId === id),
                    )
                    if (edge && (edge.end.type === 'prop' || edge.start.type === 'prop')) {
                      return [
                        id,
                        {
                          [$PROP]: true,
                          type: 'prop',
                          value: edge.end.type === 'prop' ? edge.end.handleId : edge.start.handleId,
                        },
                      ]
                    }
                    return [id, prop.value]
                  }),
                )
              : {},
            node.emits,
          ),
        ]
      })
      .filter(v => v !== undefined),
  )
  for (const edge of graph.edges) {
    if (edge && (edge.end.type === 'prop' || edge.start.type === 'prop')) continue
    nodes[edge.end.nodeId]?.updateProps({
      [edge.end.handleId]: nodes[edge.start.nodeId],
    })
  }
  network.selectNode(nodes[graph.selectedNodeId])
  return network
}

const intermediaryToCode = (
  ctx: Ctx,
  intermediary: ReturnType<Node['toIntermediary']>,
  cache: CompilationCache,
): [func: string, arg: string] | [empty: '', result: string | number] => {
  if (cache.atom.has(intermediary.atom)) {
    cache.atom.get(intermediary.atom)!.used = true
  }

  let funcString = ''

  // if (intermediary.node.emits) funcString += 'ctx.emit('

  funcString += generateCodeFromAtomPath(intermediary.path)

  let argString = ''
  argString += '({props: {'
  const entries = Object.entries(intermediary.props)
  for (const entry of entries) {
    const [propId, prop] = entry

    argString += propId
    argString += ': '

    const node = cache.node.get(prop.node)

    if (typeof prop === 'object') {
      if (prop.type === 'prop') {
        argString += 'props.'
        argString += prop.value
        argString += ','
        continue
      }

      /* 
        TODO: we could provide an option to either 
          - static linking of the code:
            - inline each atom's func
            - allows for code elimination by collapsing pure branches
            - can be done during build for embed as optimization-step
          - dynamic linking of the code:
            - link to `ctx` by AtomPath
            - allows for incremental compilation of each atom
            - maybe we should keep dependency-graph of an atom:
              - typecheck when signature changes
              - update symbols (change name of atom, gets updated throughout codebase?)
        
        currently we are dynamically linking, without any typechecks.
      */

      const [, arg] = intermediaryToCode(ctx, prop, cache)

      if (node?.visited) {
        node.used = true
        argString += `__node__${node.id}`
        argString += ','
        continue
      }

      let tempString = generateCodeFromAtomPath(prop.path)
      tempString += arg

      argString += prop.node.emits ? `ctx.event.emit("${prop.node.id}", ${tempString})` : tempString
      argString += ', '
      continue
    }
    argString += prop
    argString += ','
  }
  argString += '}, ctx })'

  // if (intermediary.node.emits) argString += ')'

  if (intermediary.pure) {
    return ['', eval([funcString, argString].join(''))]
  }

  return [funcString, argString]
}

/**
 * compiles NetworkAtom to a single function. simply returns CodeAtom's func-property.
 * @throws `!WARNING!` `!CAN THROW!` `!WARNING!`
 */
export const compileGraph = (ctx: Ctx, graph: Atom) => {
  let start = performance.now()
  const code = 'nodes' in graph && createIntermediaryFromGraph(ctx, graph).toCode(ctx)
  console.info('code is ', code)
  return {
    func: code ? eval(code) : graph.func,
    time: performance.now() - start,
  }
}

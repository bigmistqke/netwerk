import type { Atom, AtomPath, Ctx, Func, NetworkAtom } from './types'

type PropsAccessor<T = any> = {
  [TKey in keyof T]: T[TKey] | Node | (() => T[TKey])
}

type FunctionCache = {
  id: string
  used: boolean
}
type NodeCache = {
  id: string
  visited: number
  intermediary: any
  used: boolean
  emits: boolean
}
type CompilationCache = {
  atom: Map<Func, FunctionCache>
  node: Set<Node>
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

export const getFnFromContext = (ctx: Ctx, path: AtomPath): Func | undefined => {
  const result = getAtomFromContext(ctx, path)?.fn
  if (!result) {
    console.error('getFuncFromContext is undefined:', ctx, path)
  }
  return result
}

const generateCodeFromAtomPath = (path: AtomPath) => `ctx.lib.${path.libId}.${path.atomId}.fn`

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
  /* props */
  atom: T
  path: AtomPath
  props: PropsAccessor<TProps>
  id: string
  emits = false
  updateProps: (props: Partial<PropsAccessor<TProps>>) => void

  /* results analyis */
  visited = 0
  used = false
  intermediary: any
  dependencies = new Set()

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

    this.visited++

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
        this.dependencies.add(prop)
        continue
      }

      /* this prop is a Node */

      if (prop instanceof Node) {
        prop.intermediary = prop.toIntermediary({ cache, ctx })
        prop.dependencies.forEach(dep => this.dependencies.add(dep))

        if (prop.intermediary.pure) {
          /* 
            if the compilation-result of this node is pure,
            we can immediately execute the result.
          */
          const result = eval(`${prop.atom.toString()}`)({
            props: prop.intermediary.props,
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
        props[key] = prop.intermediary
        continue
      }

      props[key] = prop
    }

    /* 
      add self to cache.node after iterating over props
      this way we assure the nodes are added in the correct order
      when unwinding the nodes in Network.toCode
    */
    cache.node.add(self)

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
  graph: NetworkAtom
  path: AtomPath

  constructor(graph: NetworkAtom, path: AtomPath) {
    this.graph = graph
    this.path = path
  }

  createNode<
    TProps extends Record<string, Exclude<any, Function>>,
    T extends (props: TProps) => any,
  >(id: string, path: AtomPath, fn: T | undefined, props: PropsAccessor, emits: boolean) {
    const node = new Node(id, path, fn, props, emits)
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
      node: new Set(),
      prop: new Map(),
    }

    if (!this.selectedNode) {
      console.error('Network.selectedNode is undefined')
      return
    }

    const intermediary = this.selectedNode?.toIntermediary({ cache, ctx })!

    const code = intermediaryToCode({ ctx, intermediary, cache })

    // const compareCode = `const changed = ctx.compare(${})`

    const compare = `const equals = ctx.equals("${this.path.atomId}", props)`

    const used_nodes = Array.from(cache.node.values())
      .filter(node => node.used)
      .map(node => {
        let body = intermediaryToCode({ ctx, intermediary: node.intermediary, cache }).join('')
        console.log('node.dependencies:', node.dependencies)

        const dependencies = Array.from(node.dependencies)
          .map(d => `equals.${d.value}`)
          .join(', ')

        body = node.emits ? `ctx.event.emit("${node.id}", ${body})` : body
        body = `ctx.memo(() => ${body}, "${node.id}", [${dependencies}])`
        return `const __node__${node.id} = ${body};`
      })

    const body = [compare, ...used_nodes, `return ${code.join('')}\n`]
      /* prefix with padding */
      .map(v => `\n  ${v}`)
      .join('')

    return `({props, ctx}) => {${body}}`
  }
}

const createIntermediaryFromGraph = (ctx: Ctx, graph: NetworkAtom, path: AtomPath) => {
  /* reset uuid */
  uuid = { ...uuid_reset }
  const network = new Network(graph, path)
  const nodes = Object.fromEntries(
    Object.entries(graph.nodes)
      .map(([nodeId, node]) => {
        if (node.type === 'props') return [nodeId, undefined]
        if (node.type === 'renderer') return [nodeId, undefined]

        const fn = getFnFromContext(ctx, node.path)
        if (!fn) throw 'could not find fn'

        return [
          nodeId,
          network.createNode(
            nodeId,
            node.path,
            fn,
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

const intermediaryToCode = ({
  ctx,
  intermediary,
  cache,
}: {
  ctx: Ctx
  intermediary: ReturnType<Node['toIntermediary']>
  cache: CompilationCache
}): [fn: string, arg: string] | [empty: '', result: string | number] => {
  if (cache.atom.has(intermediary.atom)) {
    cache.atom.get(intermediary.atom)!.used = true
  }

  let fnString = ''

  fnString += generateCodeFromAtomPath(intermediary.path)
  let argString = ''
  argString += '({props: {'
  const entries = Object.entries(intermediary.props)
  for (const entry of entries) {
    const [propId, prop] = entry

    argString += propId
    argString += ': '

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
            - inline each atom's fn
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

      const [, arg] = intermediaryToCode({ ctx, intermediary: prop, cache })

      if (prop.node && prop.node?.visited > (intermediary.node.visited || 0)) {
        prop.node.used = true
        argString += `__node__${prop.node.id}`
        argString += ','
        continue
      }

      const body = generateCodeFromAtomPath(prop.path) + arg

      argString += prop.node.emits ? `ctx.event.emit("${prop.node.id}", ${body})` : body
      argString += ', '
      continue
    }
    argString += prop
    argString += ','
  }
  argString += '}, ctx })'

  if (intermediary.pure) {
    return ['', eval([fnString, argString].join(''))]
  }

  return [fnString, argString]
}

/**
 * compiles NetworkAtom to a single function. simply returns CodeAtom's func-property.
 * @throws `!WARNING!` `!CAN THROW!` `!WARNING!`
 */
export const compileGraph = ({ ctx, graph, path }: { ctx: Ctx; graph: Atom; path: AtomPath }) => {
  let start = performance.now()
  const code = 'nodes' in graph && createIntermediaryFromGraph(ctx, graph, path).toCode(ctx)
  // console.info('code is ', code)
  return {
    fn: code ? eval(code) : graph.fn,
    time: performance.now() - start,
  }
}

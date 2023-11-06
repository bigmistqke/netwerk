import { AtomNode, AtomPath, NetworkAtom, Node, Package } from '@src/types'
import { createStore } from 'solid-js/store'
import zeptoid from 'zeptoid'
import { getAtom } from './compiler'
import { Ctx, ctx } from './ctx'
import { autoManagePackagesModules } from './runtime'
import { std } from './std'

export const [packages, setPackages] = createStore<Record<string, Package>>({
  self: {
    main: {
      type: 'network',
      nodes: {
        sum: {
          type: 'atom',
          path: {
            libId: 'std',
            atomId: 'add',
          },
          props: {
            ...std.add.props,
          },
          position: {
            x: 100,
            y: 600,
          },
          emits: false,
        },
        sum2: {
          type: 'atom',
          path: {
            libId: 'std',
            atomId: 'add',
          },
          props: {
            ...std.add.props,
          },
          position: {
            x: 100,
            y: 200,
          },
          emits: false,
        },
        sum3: {
          type: 'atom',
          path: {
            libId: 'std',
            atomId: 'add',
          },
          props: {
            ...std.add.props,
          },
          position: {
            x: 100,
            y: 300,
          },
          emits: false,
        },
        sum4: {
          type: 'atom',
          path: {
            libId: 'std',
            atomId: 'add',
          },
          props: {
            ...std.add.props,
          },
          position: {
            x: 100,
            y: 400,
          },
          emits: false,
        },
        props: {
          type: 'props',
          position: {
            x: 500,
            y: 0,
          },
        },
      },
      edges: [
        {
          start: { nodeId: 'sum2', handleId: 'b', type: 'output' },
          end: { nodeId: 'props', handleId: 'a', type: 'prop' },
        },
        {
          end: { nodeId: 'sum3', handleId: 'b', type: 'input' },
          start: { nodeId: 'sum2', handleId: 'output', type: 'output' },
        },
        {
          end: { nodeId: 'sum3', handleId: 'a', type: 'input' },
          start: { nodeId: 'sum2', handleId: 'output', type: 'output' },
        },
        {
          end: { nodeId: 'sum4', handleId: 'b', type: 'input' },
          start: { nodeId: 'sum3', handleId: 'output', type: 'output' },
        },
        {
          end: { nodeId: 'sum', handleId: 'b', type: 'input' },
          start: { nodeId: 'sum4', handleId: 'output', type: 'output' },
        },
        {
          end: { nodeId: 'sum', handleId: 'a', type: 'input' },
          start: { nodeId: 'sum4', handleId: 'output', type: 'output' },
        },
      ],
      code: 'export default () => {}',
      props: {
        a: {
          value: 0,
          type: 'number',
        },
        b: {
          value: 1,
          type: 'number',
        },
      },
      returnType: 'number',
      selectedNodeId: 'sum',
    },
  },
  std,
})
autoManagePackagesModules(packages)
export const [store, setStore] = createStore<{ selectedPath: AtomPath }>({
  selectedPath: {
    atomId: 'main',
    libId: 'self',
  },
})
export const selectedAtom = () => packages[store.selectedPath.libId][store.selectedPath.atomId]
export const setSelectedPath = (path: AtomPath) => setStore('selectedPath', path)
export const setSelectedAtom = (...args: any[]) =>
  setPackages(store.selectedPath.libId, store.selectedPath.atomId, ...args)

let atomId = 0
export const createAtom = () => {
  const id = 'atom' + atomId++
  const sumId = zeptoid()
  const propsId = zeptoid()
  setPackages('self', id, {
    type: 'network',
    nodes: {
      [sumId]: {
        type: 'atom',
        path: {
          libId: 'std',
          atomId: 'add',
        },
        fn: std.add,
        props: {
          ...std.add.props,
        },
        position: {
          x: 100,
          y: 400,
        },
        emits: false,
      },
      [propsId]: {
        type: 'props',
        position: {
          x: 100,
          y: 100,
        },
      },
    },
    edges: [
      {
        start: { nodeId: sumId, handleId: 'b', type: 'input' },
        end: { nodeId: propsId, handleId: 'b', type: 'prop' },
      },
      {
        start: { nodeId: sumId, handleId: 'a', type: 'input' },
        end: { nodeId: propsId, handleId: 'a', type: 'prop' },
      },
    ],
    code: '(() => {})',
    props: {
      a: {
        value: 0,
        type: 'number',
      },
      b: {
        value: 0,
        type: 'number',
      },
    },
    returnType: 'number',
    selectedNodeId: sumId,
  } as NetworkAtom)
  setSelectedAtom({ libId: 'self', atomId: id })
}

export const addNodeToSelectedAtom = (path: AtomPath) =>
  setSelectedAtom('nodes', createNode(ctx, path))

const createNode = (
  ctx: Ctx,
  path: AtomPath,
  type: Node['type'] = 'atom',
): Record<string, AtomNode> => {
  const props = getAtom(ctx, path)!.props
  return {
    [zeptoid()]: {
      type,
      path,
      props,
      emits: false,
      /* TODO: add proper positioning of node */
      position: {
        x: Math.random() * 400,
        y: Math.random() * 300,
      },
    },
  }
}

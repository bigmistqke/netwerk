import { Package } from '@src/types'

export const std = {
  add: {
    type: 'code',
    code: 'export default ({ props }) => props.a + props.b',
    returnType: 'number',
    props: {
      a: {
        type: 'number',
        value: 1,
      },
      b: {
        type: 'number',
        value: 1,
      },
    },
  },
  multiply: {
    type: 'code',
    code: 'export default ({ props }) => props.a * props.b',
    returnType: 'number',
    props: {
      a: {
        type: 'number',
        value: 1,
      },
      b: {
        type: 'number',
        value: 1,
      },
    },
  },
  simple_renderer: {
    type: 'renderer',
    code: `export default ({ dom }) => {
      dom.innerHTML = ''
      const container = document.createElement('div')
      dom.appendChild(container)
      return result => (container.textContent = result)
    }`,
    props: {},
  },
} satisfies Package

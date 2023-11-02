## Netwerk 🕸️

A node-based editor for composing calculations.<br/>
Build with <a href="https://solidjs.com/">solid-js</a> and <a href="https://github.com/bigmistqke/spagett">spagett</a>.

https://github.com/bigmistqke/netwerk/assets/10504064/f2fc307e-b437-49fa-97f6-64083dbbdbbb

## Main ideas

- compilation:
  - minimal to no runtime
  - compile networks to javascript function-strings while editing
  - analysis:
    - static branches get resolved / collapsed (see how the compiled code starts with a single value)
    - calculations that are accessed multiple times are cached (see `__node__`)
  - this allows for the resulting code to be framework-agnostic: it can be driven by any reactive system
- event-system:
  - nodes are able to emit their values out of the calculation through an event-system
  - this can be used p.ex to have intermediary visualizations of the graph
  - this emit-calls are compiled into the resulting code (see `ctx.event.emits`)
- atoms:
  - atoms are individual blocks of logic
    - `CodeAtom`: contains a single javascript-function. `{ props, ctx }` as argument, returns `value: any`
    - `NetworkAtom`: containing a graph of `CodeAtom`-, and `NetworkAtom`-nodes
    - `RendererAtom`: contains a single javascript-function. `{ props, ctx, dom }` as argument, returns `render: () => void`
  - all atoms contain a property `fn` that extends `(arg: {props, ctx}) => any` allowing atoms to be composed easily with one another
- ctx:
  - `ctx.lib` libraries
    - `ctx.lib.std` standard library
    - `ctx.lib.self` current project's codebase
    - `ctx.lib.[...]` current project's external dependencies
  - `ctx.event` event-system
    - `ctx.event.listeners` all current listeners `Record<string, ((value: any) => void)[]>`
    - `ctx.event.addListener` add listener to nodeId `(nodeId: string, (value: any) => void) => void`
 

import { AiFillTool } from 'solid-icons/ai'
import { Component, For, Show, createEffect, createUniqueId } from 'solid-js'

import { CtxProvider, ctx } from '@logic/ctx'
import Network from './panels/Network/index'
import type { NetworkAtom } from './types'

import { createIntermediaryFromGraph } from '@logic/compiler'
import clsx from 'clsx'
import styles from './App.module.css'
import { Button, IconButton, LabelButton } from './components/Button'
import { Title } from './components/Title'
import {
  addNodeToSelectedAtom,
  createAtom,
  packages,
  selectedAtom,
  setSelectedAtom,
  setSelectedPath,
  store,
} from './logic/packages'
import { areModulesLoading, modules } from './logic/runtime'
import { Editor } from './panels/Editor'
import { when } from './utils/when'

const ParameterPanel = () => {
  return (
    <div class={styles.parameterPanel}>
      <For each={Object.entries(selectedAtom().props)}>
        {([propId, prop]) => {
          const id1 = createUniqueId()
          const id2 = createUniqueId()
          return (
            <div>
              <h3>{propId}</h3>
              <div class={styles.parameterRow}>
                <label for={id1}>value:</label>
                <input
                  id={id1}
                  value={prop.value}
                  onChange={e => setSelectedAtom('props', propId, 'value', +e.currentTarget.value)}
                  onKeyDown={e => {
                    switch (e.key) {
                      case 'ArrowUp':
                        if (prop.type === 'number') {
                          setSelectedAtom('props', propId, 'value', value => value + 1)
                          e.preventDefault()
                        }
                        break
                      case 'ArrowDown':
                        if (prop.type === 'number') {
                          setSelectedAtom('props', propId, 'value', value => value - 1)
                          e.preventDefault()
                        }
                        break
                    }
                  }}
                />
                <label for={id2}>type:</label>
                <input
                  id={id2}
                  value={prop.type}
                  onChange={e => setSelectedAtom('props', propId, 'value', +e.currentTarget.value)}
                />
              </div>
            </div>
          )
        }}
      </For>
    </div>
  )
}

const App: Component = () => {
  const resolvedProps = () =>
    Object.fromEntries(
      Object.entries(selectedAtom().props).map(([id, { value }]) => [
        id,
        typeof value === 'function' ? value() : value,
      ]),
    )

  createEffect(() => {
    console.log(areModulesLoading())
    if (areModulesLoading()) return
    const { atomId, libId } = store.selectedPath
    console.log('execute:', modules.esm[libId][atomId]?.({ props: resolvedProps(), ctx }))
  })

  createEffect(() => {
    const atom = selectedAtom()
    if (atom.type === 'network') {
      const intermediary = createIntermediaryFromGraph({
        ctx,
        atom,
        path: store.selectedPath,
      })
      const code = intermediary.toCode(ctx)
      setSelectedAtom('code', code)
    }
  })

  return (
    <CtxProvider value={ctx}>
      <div class={styles.panels}>
        <div class={styles.panel}>
          <Title title="Atoms" />
          <div>
            {Object.entries(packages).map(([libId, _package]) => (
              <div class={styles.panel}>
                <Title title={libId} as="h3" class={styles.packageHeading}>
                  <span>{libId}</span>
                  {libId === 'self' ? (
                    <Button onClick={createAtom} label="add new atom">
                      +
                    </Button>
                  ) : undefined}
                </Title>
                <ul class={styles.list}>
                  {Object.keys(_package).map(atomId => (
                    <li>
                      <LabelButton
                        label={atomId}
                        onClick={() => addNodeToSelectedAtom({ libId, atomId })}
                      >
                        <IconButton
                          icon={<AiFillTool />}
                          label="edit"
                          onClick={() => setSelectedPath({ libId, atomId })}
                          stopPropagation
                        />
                      </LabelButton>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div class={clsx(styles.panel, styles.panel__network)}>
          <Show
            when={when(selectedAtom)(atom => 'nodes' in atom && (atom as NetworkAtom))}
            fallback={<Editor code={selectedAtom().code} path={store.selectedPath} />}
          >
            {atom => (
              <>
                <ParameterPanel atom={atom()} setAtom={setSelectedAtom} />
                <Network networkAtom={atom()} resolvedProps={resolvedProps()} />
              </>
            )}
          </Show>
        </div>
        <div class={styles.panel}></div>
      </div>
    </CtxProvider>
  )
}

export default App

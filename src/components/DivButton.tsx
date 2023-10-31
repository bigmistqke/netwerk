import clsx from 'clsx'
import { ParentProps } from 'solid-js'

import styles from './Button.module.css'

export const DivButton = (
  props: ParentProps<{ class?: string; label: string; onClick: () => void }>,
) => {
  return (
    <div
      aria-label={props.label}
      class={clsx(styles.divButton, styles.button, props.class)}
      onClick={props.onClick}
      onKeyDown={e => {
        if (e.key === ' ' || e.key === 'Enter') {
          props.onClick()
        }
      }}
      tabIndex={0}
    >
      {props.children}
    </div>
  )
}

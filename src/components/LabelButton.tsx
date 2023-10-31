import clsx from 'clsx'
import { ParentProps } from 'solid-js'

import styles from './Button.module.css'

export const LabelButton = (
  props: ParentProps<{ class?: string; label: string; onClick: () => void }>,
) => {
  return (
    <div
      aria-label={props.label}
      class={clsx(styles.divButton, styles.button, props.class)}
      onClick={props.onClick}
      tabIndex={0}
    >
      <label>{props.label}</label>
      {props.children}
    </div>
  )
}

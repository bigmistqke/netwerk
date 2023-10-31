import clsx from 'clsx'
import { type JSX } from 'solid-js'

import styles from './Button.module.css'

export const IconButton = (props: {
  class?: string
  label: string
  icon: JSX.Element
  onClick: () => void
}) => <button class={clsx(props.class, styles.iconButton)}>{props.icon}</button>

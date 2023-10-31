import { Switch } from '@kobalte/core'
import clsx from 'clsx'
import styles from './Switch.module.css'

export const Toggle = (props: {
  class: string
  checked?: boolean
  onChange: (checked: boolean) => void
}) => (
  <Switch.Root class={clsx(props.class, styles.switch)} onChange={props.onChange}>
    <Switch.Input class={styles.switch__input} checked={props.checked} />
    <Switch.Control class={styles.switch__control}>
      <Switch.Thumb class={styles.switch__thumb} />
    </Switch.Control>
  </Switch.Root>
)

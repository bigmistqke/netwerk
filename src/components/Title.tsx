import clsx from 'clsx'
import { ParentProps } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { Seperator } from './Separator'
import styles from './Title.module.css'

export const Title = (
  props: ParentProps<{ title: string; class?: string; as?: 'h1' | 'h2' | 'h3' | 'h4' }>,
) => (
  <div class={clsx(styles.titleContainer)}>
    <Dynamic
      component={props.as || 'h1'}
      aria-label={props.title}
      class={clsx(styles.title, props.class)}
    >
      {props.children || props.title}
    </Dynamic>
    <Seperator />
  </div>
)

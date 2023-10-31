import clsx from 'clsx'
import { JSX, ParentProps, splitProps } from 'solid-js'

import styles from './Button.module.css'

type ButtonProps = {
  class?: string
  label: string
  onClick: () => void
  preventDefault?: boolean
  stopPropagation?: boolean
}

const handleClick = (e: MouseEvent, props: ButtonProps) => {
  if (props.preventDefault) {
    e.preventDefault()
  }
  if (props.stopPropagation) {
    console.log('stopPropagation!!!')
    e.stopPropagation()
  }
  props.onClick()
}

export const DivButton = (props: ParentProps<ButtonProps>) => {
  return (
    <div
      aria-label={props.label}
      class={clsx(styles.divButton, styles.button, props.class)}
      onClick={e => handleClick(e, props)}
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

export const LabelButton = (props: ParentProps<ButtonProps>) => {
  return (
    <DivButton {...props}>
      <label>{props.label}</label>
      {props.children}
    </DivButton>
  )
}

export const IconButton = (_props: ButtonProps & { icon: JSX.Element }) => {
  const [props, rest] = splitProps(_props, ['icon', 'class'])
  return (
    <Button class={clsx(props.class, styles.iconButton)} {...rest}>
      {props.icon}
    </Button>
  )
}

export const Button = (_props: ParentProps<ButtonProps>) => {
  const [props, rest] = splitProps(_props, ['children', 'label', 'class', 'onClick'])

  return (
    <button
      class={clsx(props.class, styles.button, styles.defaultButton)}
      aria-label={props.label}
      onClick={e => handleClick(e, _props)}
      {...rest}
    >
      {props.children}
    </button>
  )
}

import { ParentProps } from 'solid-js'

import { DivButton } from './DivButton'

export const LabelButton = (
  props: ParentProps<{ class?: string; label: string; onClick: () => void }>,
) => {
  return (
    <DivButton {...props}>
      <label>{props.label}</label>
      {props.children}
    </DivButton>
  )
}

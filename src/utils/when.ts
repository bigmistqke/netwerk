import { type Accessor } from 'solid-js'

export function when<
  const T,
  TAccessors extends Array<Accessor<T> | T>,
  const TValues extends {
    [TKey in keyof TAccessors]: TAccessors[TKey] extends ((...args: any[]) => any) | undefined
      ? Exclude<ReturnType<Exclude<TAccessors[TKey], undefined>>, null | undefined | false>
      : Exclude<TAccessors[TKey], null | undefined | false>
  },
>(...accessors: TAccessors) {
  function callback<const TResult>(callback: (...values: TValues) => TResult) {
    const values = new Array(accessors.length)

    for (let i = 0; i < accessors.length; i++) {
      const _value = typeof accessors[i] === 'function' ? (accessors[i] as () => T)() : accessors[i]
      if (_value === undefined || _value === null || _value === false) return undefined
      values[i] = _value
    }

    return callback(...(values as any))
  }
  return callback
}

export function all<
  const T,
  TAccessors extends Array<Accessor<T> | T>,
  const TValues extends {
    [TKey in keyof TAccessors]: TAccessors[TKey] extends () => any
      ? Exclude<ReturnType<TAccessors[TKey]>, null | undefined | false>
      : Exclude<TAccessors[TKey], null | undefined | false>
  },
>(...accessors: TAccessors): TValues | undefined {
  const values = new Array(accessors.length)

  for (let i = 0; i < accessors.length; i++) {
    const _value = typeof accessors[i] === 'function' ? (accessors[i] as () => T)() : accessors[i]
    if (_value === undefined || _value === null || _value === false) return undefined
    values[i] = _value
  }

  return values as TValues
}

type UnwrapWhen<T> = NonNullable<T>

type UnwrapWhens<T extends [...any[]]> = T extends [infer Head, ...infer Tail]
  ? [UnwrapWhen<Head>, ...UnwrapWhens<Tail>]
  : []

export default function when<T extends [...any[]]>(...whens: [...T]) {
  return {
    then: function <U>(callback: (...items: UnwrapWhens<T>) => U) {
      if (whens.every((when) => !!when)) {
        return callback(...(whens as unknown as UnwrapWhens<T>))
      }
      return undefined
    },
    wrap: function () {
      if (whens.every((when) => !!when)) {
        return whens as unknown as UnwrapWhens<T>
      }
      return undefined
    },
  }
}

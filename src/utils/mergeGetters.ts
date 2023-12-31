function mergeGetters<A, B>(a: A, b: B) {
  const result = Object.defineProperties(
    {},
    {
      ...Object.getOwnPropertyDescriptors(a ?? {}),
      ...Object.getOwnPropertyDescriptors(b ?? {}),
    },
  )
  return result as A & Omit<B, keyof A>
}

function deepMergeGetters<T extends { [key: string]: any }, U extends { [key: string]: any }>(
  obj1: T | undefined | null,
  obj2: U | undefined | null,
): T & U {
  if (!obj1) {
    return obj2 as T & U
  }
  if (!obj2) {
    return obj1 as T & U
  }

  const result = {} as T & U

  const props1 = Object.getOwnPropertyNames(obj1)
  const props2 = Object.getOwnPropertyNames(obj2)
  let prop: keyof T & keyof U
  for (prop of [...props1, ...props2]) {
    const descriptor1 = Object.getOwnPropertyDescriptor(obj1, prop)
    const descriptor2 = Object.getOwnPropertyDescriptor(obj2, prop)
    if (descriptor2 && descriptor2.get) {
      Object.defineProperty(result, prop, descriptor2)
    } else if (typeof obj2[prop] === 'object') {
      result[prop] = deepMergeGetters(obj1[prop], obj2[prop])
    } else if (obj2[prop]) {
      result[prop] = obj2[prop]
    } else if (descriptor1 && descriptor1.get) {
      Object.defineProperty(result, prop, descriptor1)
    } else if (typeof obj1[prop] === 'object') {
      result[prop] = deepMergeGetters(obj1[prop], obj2[prop])
    } else {
      result[prop] = obj2[prop] !== undefined ? obj2[prop] : obj1[prop]
    }
  }

  return result
}
export { deepMergeGetters, mergeGetters }

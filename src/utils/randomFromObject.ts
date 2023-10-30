export const randomFromObject = (obj: Record<string, any>) => {
  const keys = Object.keys(obj)
  const key = keys[Math.floor(Math.random() * keys.length)]
  return [key, obj[key]]
}

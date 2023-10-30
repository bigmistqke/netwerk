const to =
  <T>(input: T) =>
  <U>(callback: (input: T) => U) => {
    return pipe(callback(input))
  }
const end =
  <T>(input: T) =>
  <U>(callback: (input: T) => U) => {
    return callback(input)
  }
const pipe = <T>(input: T) => {
  return { to: to(input), end: end(input) }
}

export default pipe

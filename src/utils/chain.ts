const link =
  <T>(input: T) =>
  <U>(callback: (input: T) => U) =>
    chain(callback(input))

const end =
  <T>(input: T) =>
  <U>(callback: (input: T) => U) =>
    callback(input)

const value = <T>(input: T) => input

const chain = <T>(input: T) => ({
  link: link(input),
  end: end(input),
  value: value(input),
})

export default chain

const join = ({ x, y }: { x: number; y: number }) => x + ', ' + y

export default (
  points: {
    point: { x: number; y: number }
    control: { x: number; y: number }
  }[]
) => {
  let result = 'M '
  const M = points[0].point
  result += join(M)
  result += ' C '
  const c = [points[0].control, points[1].control, points[1].point]
  result += c.map((point) => join(point)).join(' ')
  let index = 2
  while (index < points.length) {
    result += ' S '
    const s = [points[index].control, points[index].point]
    result += s.map((point) => join(point)).join(' ')
    index++
  }
  return result
}

export function normalizeCommandSearch(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function editDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[right.length]
}

function fuzzyWordMatch(query, word) {
  if (query.length < 3) return false
  const tolerance = query.length >= 6 ? 2 : 1
  return Math.abs(query.length - word.length) <= tolerance && editDistance(query, word) <= tolerance
}

function commandScore(command, query) {
  if (!query) return 0
  const values = [command.label, command.id, command.group, ...(command.keywords || [])]
    .map(normalizeCommandSearch)
    .filter(Boolean)
  const queryTokens = query.split(' ')
  let score = 0
  for (const token of queryTokens) {
    let tokenScore = Infinity
    values.forEach((value, valueIndex) => {
      if (value === token) tokenScore = Math.min(tokenScore, valueIndex === 0 ? 0 : 1)
      else if (value.startsWith(token)) tokenScore = Math.min(tokenScore, valueIndex === 0 ? 2 : 3)
      else if (value.includes(token)) tokenScore = Math.min(tokenScore, 5)
      else if (value.split(' ').some(word => fuzzyWordMatch(token, word))) tokenScore = Math.min(tokenScore, 8)
    })
    if (!Number.isFinite(tokenScore)) return null
    score += tokenScore
  }
  return score
}

export function filterTiptapCommands(commands, rawQuery) {
  const query = normalizeCommandSearch(rawQuery)
  return commands
    .map((command, index) => ({ command, index, score: commandScore(command, query) }))
    .filter(result => result.score !== null)
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map(result => result.command)
}

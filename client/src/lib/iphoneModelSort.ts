type ParsedIphoneModel = {
  numberRank: number
  variantRank: number
  tail: string
}

function parseIphoneModel(value: string): ParsedIphoneModel {
  const text = value.trim().toLowerCase()

  const numberMatch = text.match(/iphone\s*(\d+)/i)
  const numberRank = numberMatch ? Number(numberMatch[1]) : Number.MAX_SAFE_INTEGER

  let variantRank = 99
  if (/pro\s*max/.test(text)) {
    variantRank = 3
  } else if (/\bpro\b/.test(text)) {
    variantRank = 2
  } else if (/iphone\s*\d+/.test(text)) {
    variantRank = 1
  }

  const tail = text
    .replace(/iphone\s*\d+/i, '')
    .replace(/pro\s*max/i, '')
    .replace(/\bpro\b/i, '')
    .replace(/\d+\s*gb/i, '')
    .trim()

  return { numberRank, variantRank, tail }
}

export function compareIphoneModelNames(a: string, b: string): number {
  const pa = parseIphoneModel(a)
  const pb = parseIphoneModel(b)

  if (pa.numberRank !== pb.numberRank) return pa.numberRank - pb.numberRank
  if (pa.variantRank !== pb.variantRank) return pa.variantRank - pb.variantRank

  const variantA = a.trim().toLowerCase()
  const variantB = b.trim().toLowerCase()

  if (pa.tail !== pb.tail) return pa.tail.localeCompare(pb.tail)
  return variantA.localeCompare(variantB)
}

export function sortIphoneModelNames(values: string[]): string[] {
  return [...values].sort(compareIphoneModelNames)
}

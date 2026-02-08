export function splitCrn(raw: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let splits = 0;
  for (let i = 0; i < raw.length && splits < 5; i++) {
    if (raw[i] === ":") {
      parts.push(raw.slice(start, i));
      start = i + 1;
      splits += 1;
    }
  }
  parts.push(raw.slice(start));
  return parts;
}

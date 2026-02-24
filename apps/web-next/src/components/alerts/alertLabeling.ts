export function toTitleLabel(value: string): string {
  if (!value) {return value;}
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}


export function normalizeDeliveryTargets(targets: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of targets) {
    const value = raw.trim();
    if (!value) {continue;}

    const canonical = value.toLowerCase();
    if (seen.has(canonical)) {continue;}
    seen.add(canonical);
    normalized.push(value);
  }

  return normalized;
}


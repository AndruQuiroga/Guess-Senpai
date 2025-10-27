const KNOWN_ACRONYMS = new Set(["TV", "OVA", "ONA"]);

export function formatMediaFormatLabel(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => {
      const upper = segment.toUpperCase();
      if (KNOWN_ACRONYMS.has(upper)) {
        return upper;
      }

      const lower = segment.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

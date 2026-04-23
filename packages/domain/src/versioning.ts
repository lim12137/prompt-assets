const VERSION_PREFIX = "v";
const VERSION_DIGITS = 4;

export function nextVersionNo(currentVersionNo?: string): string {
  if (!currentVersionNo) {
    return `${VERSION_PREFIX}${String(1).padStart(VERSION_DIGITS, "0")}`;
  }

  const matched = /^v(\d+)$/.exec(currentVersionNo);
  if (!matched) {
    throw new Error("Invalid version format");
  }

  const current = Number(matched[1]);
  const next = current + 1;
  return `${VERSION_PREFIX}${String(next).padStart(VERSION_DIGITS, "0")}`;
}

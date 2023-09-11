export function removeQuotes(str: string) {
  if (str.length < 2) {
    return str;
  }

  const firstChar = str.charAt(0);
  const lastChar = str.charAt(str.length - 1);

  if (
    (firstChar === '"' && lastChar === '"') ||
    (firstChar === "'" && lastChar === "'")
  ) {
    return str.substring(1, str.length - 1);
  }

  return str;
}

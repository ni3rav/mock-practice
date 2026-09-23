export function splitCodeText(text) {
  const value = String(text ?? "");
  const breakAt = value.indexOf("\n\n");
  if (breakAt === -1) {
    return value.includes("\n")
      ? { prose: "", code: value }
      : { prose: value, code: "" };
  }
  return {
    prose: value.slice(0, breakAt),
    code: value.slice(breakAt + 2),
  };
}

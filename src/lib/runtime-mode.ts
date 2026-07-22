export function allowDemoData(nodeEnv = process.env.NODE_ENV): boolean {
  return nodeEnv === "development";
}

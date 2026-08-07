export const config: { marker: string; items: number[] } = {
  marker: 'dedupe-marker',
  items: [1, 2, 3],
}

export function getConfig(): typeof config {
  return config
}

export async function getAsync(): Promise<string> {
  return 'async-value'
}

export function getArgs(count: number): { marker: string; items: number[] } {
  return {
    marker: 'args-marker',
    items: Array.from({ length: count }, (_, i) => i),
  }
}

export function getFn(): () => string {
  return () => 'fn-value'
}

export function promise(): Promise<string> {
  return Promise.resolve('ok')
}
export const p: Promise<string> = Promise.resolve('ok')

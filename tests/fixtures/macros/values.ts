export function version(): number {
  return 3
}
export function offset(): number {
  return -1
}
export function defaults(): { mode: string } {
  return { mode: 'prod' }
}
export function list(): number[] {
  return [1, 2]
}
export function pattern(): RegExp {
  return /a/g
}

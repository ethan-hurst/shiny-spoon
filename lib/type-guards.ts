export function isNotNull<T>(value: T | null): value is T {
  return value !== null
}

export function isNotUndefined<T>(value: T | undefined): value is T {
  return value !== undefined
}

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

export function hasProperty<T, K extends PropertyKey>(
  obj: T,
  prop: K
): obj is T & Record<K, unknown> {
  return obj != null && typeof obj === 'object' && prop in obj
}

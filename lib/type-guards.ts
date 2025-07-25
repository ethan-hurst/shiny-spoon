/**
 * Determines whether a value is not `null`.
 *
 * @returns `true` if the value is anything other than `null`; otherwise, `false`.
 */
export function isNotNull<T>(value: T | null): value is T {
  return value !== null
}

/**
 * Determines whether a value is not `undefined`.
 *
 * @returns `true` if the value is defined (not `undefined`); otherwise, `false`.
 */
export function isNotUndefined<T>(value: T | undefined): value is T {
  return value !== undefined
}

/**
 * Determines whether a value is neither `null` nor `undefined`.
 *
 * @returns `true` if the value is defined and not null; otherwise, `false`.
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

/**
 * Determines whether the given object is non-null and contains the specified property key.
 *
 * @param obj - The object to check
 * @param prop - The property key to look for
 * @returns `true` if `obj` is a non-null object and has the property `prop`
 */
export function hasProperty<T, K extends PropertyKey>(
  obj: T,
  prop: K
): obj is T & Record<K, unknown> {
  return obj != null && typeof obj === 'object' && prop in obj
}
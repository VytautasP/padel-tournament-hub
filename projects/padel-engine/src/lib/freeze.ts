/**
 * Deep-freeze a session on the way out.
 *
 * Every engine operation returns a new session and mutates nothing. The `readonly` types say
 * so at compile time; freezing says so at runtime, so an app that reaches for `push` finds out
 * immediately rather than corrupting a session document nobody thought was shared.
 */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }

  return value;
}

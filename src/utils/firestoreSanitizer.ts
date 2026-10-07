/**
 * Recursively strips `undefined` properties from objects and arrays so they are safe
 * to send to Firebase Firestore without triggering:
 * "Function setDoc() called with invalid data. Unsupported field value: undefined"
 *
 * It preserves:
 * - Primitives (string, number, boolean, null)
 * - Dates
 * - Firestore Sentinels (serverTimestamp, FieldValue, Timestamp)
 */
export function sanitizeForFirestore<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }

  // Handle Primitives
  if (typeof input !== 'object') {
    return input;
  }

  // Handle Date
  if (input instanceof Date) {
    return input;
  }

  // Handle Firestore Timestamp or FieldValue instances
  if (
    (input as any)?._methodName ||
    typeof (input as any)?.toMillis === 'function' ||
    typeof (input as any)?.isEqual === 'function'
  ) {
    return input;
  }

  // Handle Arrays
  if (Array.isArray(input)) {
    return input
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }

  // Handle Plain Objects
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(input as Record<string, any>)) {
    if (val !== undefined) {
      result[key] = sanitizeForFirestore(val);
    }
  }

  return result as T;
}

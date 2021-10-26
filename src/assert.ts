
/**
 * asserts that value is truthy (e.g. true, non-empty string, non-zero #, etc)
 */
export function softAssert (value: any, message?: string): void {
  if (!value) {
    console.error('Soft assertion failed:', message);
  }
}
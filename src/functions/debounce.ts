/**
 * Creates a debounced function that delays invoking func until after delay milliseconds 
 * have elapsed since the last time the debounced function was invoked.
 * 
 * @param func - The function to debounce
 * @param delay - The number of milliseconds to delay
 * @returns A debounced version of the function
 */
function debounce<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args)
    }, delay)
  }
}

export {debounce}

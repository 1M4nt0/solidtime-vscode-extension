type FetchAPI<T, Params extends unknown[] = []> = (...params: Params) => Promise<T>

type APIResponse<T> = {
  data: T
}

export type {FetchAPI, APIResponse}

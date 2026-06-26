/** 后台轮询：标签页不可见时暂停，减少无效跨境请求 */
export function backgroundPoll(intervalMs: number) {
  return {
    refetchInterval: intervalMs,
    refetchIntervalInBackground: false,
  } as const;
}

export const EVENTS_QUERY_KEY = ["events", {}] as const;

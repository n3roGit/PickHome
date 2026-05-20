let activeBackgroundTasks = 0;

export function beginBackgroundTask() {
  activeBackgroundTasks += 1;
}

export function endBackgroundTask() {
  activeBackgroundTasks = Math.max(0, activeBackgroundTasks - 1);
}

export function isBackgroundTaskActive() {
  return activeBackgroundTasks > 0;
}

export async function yieldToEventLoop(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

/** Cooperative pause so HTTP handlers and UI requests can run between bulk steps. */
export async function backgroundThrottlePause(extraMs = 150): Promise<void> {
  await yieldToEventLoop();
  if (extraMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, extraMs));
  }
}

export function resetBackgroundTaskStateForTests() {
  activeBackgroundTasks = 0;
}

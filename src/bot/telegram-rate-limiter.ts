import { logger } from "../utils/logger.js";

const GLOBAL_MIN_INTERVAL_MS = 40;
const PER_CHAT_MIN_INTERVAL_MS = 1100;
const GROUP_WINDOW_MS = 60_000;
const GROUP_LIMIT_PER_WINDOW = 20;

const RATE_LIMITED_METHODS = new Set<string>([
  "sendMessage",
  "sendDocument",
  "sendPhoto",
  "sendAudio",
  "sendVoice",
  "sendVideo",
  "sendAnimation",
  "sendMediaGroup",
]);

interface QueueJob {
  method: string;
  scopeKey: string | null;
  chatId: number | null;
  isGroupLike: boolean;
  run: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}

function parseChatId(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const value = Reflect.get(payload, "chat_id");
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseThreadId(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const value = Reflect.get(payload, "message_thread_id");
  return typeof value === "number" ? value : null;
}

function scopeKeyFromPayload(payload: unknown): string | null {
  const chatId = parseChatId(payload);
  if (chatId === null) {
    return null;
  }

  const threadId = parseThreadId(payload);
  if (threadId !== null) {
    return `${chatId}:${threadId}`;
  }

  return chatId > 0 ? `dm:${chatId}` : `chat:${chatId}`;
}

function isGroupLikeChat(chatId: number | null): boolean {
  return chatId !== null && chatId < 0;
}

function getRetryAfterMs(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const params = Reflect.get(error, "parameters");
  if (!params || typeof params !== "object") {
    return null;
  }

  const retryAfter = Reflect.get(params, "retry_after");
  if (typeof retryAfter !== "number" || retryAfter <= 0) {
    return null;
  }

  return retryAfter * 1000;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class TelegramRateLimiter {
  private readonly queue: QueueJob[] = [];
  private processing = false;
  private lastGlobalSentAt = 0;
  private readonly lastSentAtByChat = new Map<number, number>();
  private readonly groupWindowByChat = new Map<number, number[]>();
  private activeScopeKey: string | null = null;

  setActiveScopeKey(scopeKey: string | null): void {
    this.activeScopeKey = scopeKey;
  }

  enqueue<T>(method: string, payload: unknown, run: () => Promise<T>): Promise<T> {
    if (!RATE_LIMITED_METHODS.has(method)) {
      return run();
    }

    const chatId = parseChatId(payload);
    const job: QueueJob = {
      method,
      scopeKey: scopeKeyFromPayload(payload),
      chatId,
      isGroupLike: isGroupLikeChat(chatId),
      run,
      resolve: () => undefined,
      reject: () => undefined,
    };

    const promise = new Promise<unknown>((resolve, reject) => {
      job.resolve = resolve;
      job.reject = reject;
    });

    this.queue.push(job);
    if (this.queue.length > 25) {
      logger.debug(`[RateLimiter] Outbound queue depth=${this.queue.length}`);
    }

    this.ensureProcessing();
    return promise as Promise<T>;
  }

  private ensureProcessing(): void {
    if (this.processing) {
      return;
    }

    this.processing = true;
    void this.processLoop();
  }

  private findNextIndex(): number {
    if (!this.activeScopeKey) {
      return 0;
    }

    const prioritized = this.queue.findIndex((job) => job.scopeKey === this.activeScopeKey);
    return prioritized >= 0 ? prioritized : 0;
  }

  private pruneGroupWindow(chatId: number, now: number): number[] {
    const current = this.groupWindowByChat.get(chatId) ?? [];
    const pruned = current.filter((ts) => now - ts < GROUP_WINDOW_MS);
    this.groupWindowByChat.set(chatId, pruned);
    return pruned;
  }

  private getWaitMs(job: QueueJob): number {
    const now = Date.now();
    const waits: number[] = [];

    waits.push(this.lastGlobalSentAt + GLOBAL_MIN_INTERVAL_MS - now);

    if (job.chatId !== null) {
      const lastPerChat = this.lastSentAtByChat.get(job.chatId) ?? 0;
      waits.push(lastPerChat + PER_CHAT_MIN_INTERVAL_MS - now);
    }

    if (job.isGroupLike && job.chatId !== null) {
      const timestamps = this.pruneGroupWindow(job.chatId, now);
      if (timestamps.length >= GROUP_LIMIT_PER_WINDOW) {
        waits.push(timestamps[0] + GROUP_WINDOW_MS - now);
      }
    }

    return Math.max(0, ...waits);
  }

  private markSent(job: QueueJob): void {
    const now = Date.now();
    this.lastGlobalSentAt = now;

    if (job.chatId !== null) {
      this.lastSentAtByChat.set(job.chatId, now);
    }

    if (job.isGroupLike && job.chatId !== null) {
      const timestamps = this.pruneGroupWindow(job.chatId, now);
      timestamps.push(now);
      this.groupWindowByChat.set(job.chatId, timestamps);
    }
  }

  private async executeJob(job: QueueJob): Promise<void> {
    while (true) {
      const waitMs = this.getWaitMs(job);
      if (waitMs > 0) {
        await sleep(waitMs);
      }

      try {
        const result = await job.run();
        this.markSent(job);
        job.resolve(result);
        return;
      } catch (error) {
        const retryAfterMs = getRetryAfterMs(error);
        if (!retryAfterMs) {
          job.reject(error);
          return;
        }

        const cappedDelay = Math.min(retryAfterMs + 100, 10_000);
        logger.warn(
          `[RateLimiter] Telegram 429 for ${job.method}; delaying ${cappedDelay}ms and retrying`,
        );
        await sleep(cappedDelay);
      }
    }
  }

  private async processLoop(): Promise<void> {
    try {
      while (this.queue.length > 0) {
        const index = this.findNextIndex();
        const [job] = this.queue.splice(index, 1);
        await this.executeJob(job);
      }
    } finally {
      this.processing = false;
      if (this.queue.length > 0) {
        this.ensureProcessing();
      }
    }
  }
}

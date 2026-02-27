import { logger } from "../utils/logger.js";

interface PassthroughState {
  payload: string | null;
}

class PassthroughManager {
  private state: PassthroughState = {
    payload: null,
  };

  arm(payload: string): void {
    this.state.payload = payload;
    logger.debug("[PassthroughManager] Armed one-shot payload");
  }

  isArmed(): boolean {
    return this.state.payload !== null;
  }

  consume(): string | null {
    const payload = this.state.payload;
    this.state.payload = null;

    if (payload !== null) {
      logger.debug("[PassthroughManager] Consumed one-shot payload");
    }

    return payload;
  }

  clear(): void {
    if (this.state.payload !== null) {
      logger.debug("[PassthroughManager] Cleared armed payload");
    }

    this.state.payload = null;
  }
}

export const passthroughManager = new PassthroughManager();

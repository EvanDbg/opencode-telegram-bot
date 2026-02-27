import { beforeEach, describe, expect, it } from "vitest";
import { passthroughManager } from "../../src/passthrough/manager.js";

describe("passthroughManager", () => {
  beforeEach(() => {
    passthroughManager.clear();
  });

  it("arms and reports armed state", () => {
    passthroughManager.arm("hello");

    expect(passthroughManager.isArmed()).toBe(true);
  });

  it("consumes once and clears immediately", () => {
    passthroughManager.arm("payload");

    expect(passthroughManager.consume()).toBe("payload");
    expect(passthroughManager.isArmed()).toBe(false);
    expect(passthroughManager.consume()).toBeNull();
  });

  it("clear removes armed payload", () => {
    passthroughManager.arm("value");
    passthroughManager.clear();

    expect(passthroughManager.isArmed()).toBe(false);
    expect(passthroughManager.consume()).toBeNull();
  });

  it("re-arming replaces previous payload and still expires after one consume", () => {
    passthroughManager.arm("first");
    passthroughManager.arm("second");

    expect(passthroughManager.consume()).toBe("second");
    expect(passthroughManager.consume()).toBeNull();
    expect(passthroughManager.isArmed()).toBe(false);
  });
});

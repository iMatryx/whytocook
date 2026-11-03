export type ScreenAwakeState =
  "off" | "requesting" | "active" | "paused" | "released" | "denied" | "unsupported";
type Lease = {
  release: () => Promise<void>;
  addEventListener: (event: "release", listener: () => void) => void;
};
export function createScreenAwake(platform: {
  supported: boolean;
  isVisible: () => boolean;
  request: () => Promise<Lease>;
  onState: (state: ScreenAwakeState) => void;
}) {
  let enabled = false,
    disposed = false,
    generation = 0,
    lease: Lease | null = null;
  const emit = (state: ScreenAwakeState) => {
    if (!disposed) platform.onState(state);
  };
  async function release() {
    const previous = lease;
    lease = null;
    if (previous)
      try {
        await previous.release();
      } catch {}
  }
  async function acquire() {
    const id = ++generation;
    if (!enabled || disposed) return;
    if (!platform.supported) {
      emit("unsupported");
      return;
    }
    if (!platform.isVisible()) {
      emit("paused");
      return;
    }
    if (lease) {
      emit("active");
      return;
    }
    emit("requesting");
    try {
      const next = await platform.request();
      if (disposed || !enabled || id !== generation || !platform.isVisible()) {
        await next.release();
        return;
      }
      lease = next;
      next.addEventListener("release", () => {
        if (lease === next) {
          lease = null;
          emit("released");
        }
      });
      emit("active");
    } catch {
      if (id === generation) emit("denied");
    }
  }
  return {
    enable: async () => {
      enabled = true;
      await acquire();
    },
    disable: async () => {
      enabled = false;
      const id = ++generation;
      await release();
      if (id === generation && !enabled) emit("off");
    },
    visibilityChanged: async () => {
      const id = ++generation;
      if (!platform.isVisible()) {
        await release();
        if (id === generation && enabled && !platform.isVisible()) emit("paused");
      } else if (enabled && !lease) await acquire();
    },
    dispose: () => {
      disposed = true;
      enabled = false;
      generation++;
      void release();
    },
  };
}

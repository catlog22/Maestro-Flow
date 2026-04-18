import type { LayoutEventMap } from '@/client/types/layout-types.js';

// ---------------------------------------------------------------------------
// Typed Event Bus — lightweight pub/sub for cross-component communication
// ---------------------------------------------------------------------------

type EventHandler<T> = (payload: T) => void;

interface Subscription {
  unsubscribe: () => void;
}

class EventBus<TEventMap extends Record<string, any>> {
  private handlers = new Map<keyof TEventMap, Set<EventHandler<unknown>>>();

  /**
   * Subscribe to an event. Returns an object with an `unsubscribe` method.
   */
  subscribe<K extends keyof TEventMap>(
    event: K,
    handler: EventHandler<TEventMap[K]>,
  ): Subscription {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    const set = this.handlers.get(event)!;
    set.add(handler as EventHandler<unknown>);
    return {
      unsubscribe: () => {
        set.delete(handler as EventHandler<unknown>);
        if (set.size === 0) {
          this.handlers.delete(event);
        }
      },
    };
  }

  /**
   * Dispatch an event with its payload to all subscribers.
   */
  dispatch<K extends keyof TEventMap>(event: K, payload: TEventMap[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] Error in handler for "${String(event)}":`, err);
      }
    }
  }

  /**
   * Remove all handlers for a specific event (or all events).
   */
  clear(event?: keyof TEventMap): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }
}

/** Singleton event bus instance for layout events */
export const eventBus = new EventBus<LayoutEventMap>();

export { EventBus };

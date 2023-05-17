type EventListener<Event, Target> = (
  ev: Event & {
    target: Target;
  }
) => any;

export declare class TypedEventTarget<
  EventMap extends Record<string, Event>
> extends EventTarget {
  addEventListener<K extends keyof EventMap, T extends this>(
    type: K,
    listener: null | EventListener<EventMap[K], T>,
    options?: any
  ): void;
  dispatchEvent<K extends keyof EventMap>(event: EventMap[K]): boolean;
  removeEventListener<K extends keyof EventMap, T extends this>(
    type: K,
    listener: (
      ev: EventMap[K] & {
        target: T;
      }
    ) => any,
    options?: any
  ): void;
}
export {};

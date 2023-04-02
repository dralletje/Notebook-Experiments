export class TypedEventTarget<
  EventMap extends Record<string, any>
> extends EventTarget {
  addEventListener<K extends keyof EventMap, T extends this>(
    type: K,
    listener: (ev: EventMap[K] & { target: T }) => any,
    options?: any
  ): void {
    super.addEventListener(type as string, listener, options);
  }
  dispatchEvent<K extends keyof EventMap>(event: EventMap[K]): boolean {
    return super.dispatchEvent(event);
  }
}

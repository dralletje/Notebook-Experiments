export class TypedEventTarget extends EventTarget {
    addEventListener(type, listener, options) {
        super.addEventListener(type, listener, options);
    }
    dispatchEvent(event) {
        return super.dispatchEvent(event);
    }
    removeEventListener(type, listener, options) {
        super.addEventListener(type, listener, options);
    }
}

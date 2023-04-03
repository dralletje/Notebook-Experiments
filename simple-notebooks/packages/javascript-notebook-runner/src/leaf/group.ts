export function group<T>(tag: string, fn: () => T): T;
export function group<T>(tag: string, subject: any, fn: () => T): T;
export function group<T>(
  tag: string,
  subject: any | (() => T),
  fn?: () => T
): T {
  try {
    if (fn == null) {
      console.group(`${tag}`);
      return subject();
    } else {
      console.group(`${tag}: ${subject}`);
      return fn();
    }
  } finally {
    console.groupEnd();
  }
}

export function groupCollapsed<T>(tag: string, fn: () => T): T;
export function groupCollapsed<T>(tag: string, subject: any, fn: () => T): T;
export function groupCollapsed<T>(
  tag: string,
  subject: any | (() => T),
  fn?: () => T
): T {
  try {
    if (fn == null) {
      console.groupCollapsed(`${tag}`);
      return subject();
    } else {
      console.groupCollapsed(`${tag}: ${subject}`);
      return fn();
    }
  } finally {
    console.groupEnd();
  }
}

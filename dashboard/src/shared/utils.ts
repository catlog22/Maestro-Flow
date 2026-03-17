import { sep, posix } from 'node:path';

/** Convert OS-specific path separators to forward slashes */
export function toForwardSlash(p: string): string {
  return p.split(sep).join(posix.sep);
}

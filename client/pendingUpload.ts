// Carries the chosen PDF from the home page's drop zone to the upload page, which reads it.
// A File can't travel in a URL, and both pages live in the same browser tab, so a module variable is enough.
let pending: File | null = null;

export function setPendingUpload(file: File): void {
  pending = file;
}

/** Returns the waiting file once, then forgets it. */
export function takePendingUpload(): File | null {
  const file = pending;
  pending = null;
  return file;
}

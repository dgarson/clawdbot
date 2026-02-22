/**
 * File download utilities for export operations.
 */

/**
 * Format a filename with date suffix
 */
export function formatExportFilename(
  prefix: string,
  extension: string = "json"
): string {
  const date = new Date().toISOString().split("T")[0];
  return `${prefix}-${date}.${extension}`;
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download JSON data as a file
 */
export function downloadFile(
  data: unknown,
  filename: string,
  type: string = "application/json"
): void {
  const content = type === "application/json"
    ? JSON.stringify(data, null, 2)
    : String(data);

  const blob = new Blob([content], { type });
  downloadBlob(blob, filename);
}

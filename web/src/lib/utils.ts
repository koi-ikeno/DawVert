/**
 * Utility functions for plugin development
 */

/**
 * Read a file as ArrayBuffer
 */
export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Read a file as text
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Read a file as JSON
 */
export async function readFileAsJSON<T = any>(file: File): Promise<T> {
  const text = await readFileAsText(file);
  return JSON.parse(text);
}

/**
 * Read a file as Data URL
 */
export async function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Create a Blob from a string
 */
export function createBlobFromText(text: string, mimeType: string = 'text/plain'): Blob {
  return new Blob([text], { type: mimeType });
}

/**
 * Create a Blob from JSON
 */
export function createBlobFromJSON(data: any, pretty: boolean = false): Blob {
  const text = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  return new Blob([text], { type: 'application/json' });
}

/**
 * Parse XML string
 */
export function parseXML(xmlString: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  // Check for parsing errors
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('XML parsing error: ' + parserError.textContent);
  }

  return doc;
}

/**
 * Serialize XML document to string
 */
export function serializeXML(doc: Document, pretty: boolean = false): string {
  const serializer = new XMLSerializer();
  let xmlString = serializer.serializeToString(doc);

  if (pretty) {
    // Simple pretty printing (not perfect but works for basic cases)
    xmlString = xmlString.replace(/></g, '>\n<');
  }

  return xmlString;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Map a value from one range to another
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

/**
 * Convert BPM to microseconds per quarter note
 */
export function bpmToMicroseconds(bpm: number): number {
  return Math.round(60000000 / bpm);
}

/**
 * Convert microseconds per quarter note to BPM
 */
export function microsecondsToBPM(microseconds: number): number {
  return 60000000 / microseconds;
}

/**
 * Convert MIDI note number to frequency (Hz)
 */
export function midiNoteToFrequency(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/**
 * Convert frequency (Hz) to MIDI note number
 */
export function frequencyToMidiNote(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / 440);
}

/**
 * Read a null-terminated string from ArrayBuffer
 */
export function readNullTerminatedString(
  view: DataView,
  offset: number,
  maxLength?: number
): { value: string; length: number } {
  let length = 0;
  const chars: number[] = [];

  while (true) {
    if (maxLength !== undefined && length >= maxLength) break;
    if (offset + length >= view.byteLength) break;

    const byte = view.getUint8(offset + length);
    length++;

    if (byte === 0) break;
    chars.push(byte);
  }

  const value = String.fromCharCode(...chars);
  return { value, length };
}

/**
 * Read a fixed-length string from ArrayBuffer
 */
export function readFixedString(
  view: DataView,
  offset: number,
  length: number
): string {
  const chars: number[] = [];

  for (let i = 0; i < length; i++) {
    const byte = view.getUint8(offset + i);
    if (byte === 0) break;
    chars.push(byte);
  }

  return String.fromCharCode(...chars);
}

/**
 * Write a null-terminated string to Uint8Array
 */
export function writeNullTerminatedString(
  array: Uint8Array,
  offset: number,
  value: string
): number {
  let length = 0;

  for (let i = 0; i < value.length; i++) {
    array[offset + length] = value.charCodeAt(i);
    length++;
  }

  array[offset + length] = 0; // Null terminator
  length++;

  return length;
}

/**
 * Create a UUID v4
 */
export function createUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Encode a string to Base64
 */
export function encodeBase64(str: string): string {
  return btoa(str);
}

/**
 * Decode a Base64 string
 */
export function decodeBase64(str: string): string {
  return atob(str);
}

/**
 * Convert ArrayBuffer to Base64
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    const context = this;

    if (timeout !== null) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function (this: any, ...args: Parameters<T>) {
    const context = this;

    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

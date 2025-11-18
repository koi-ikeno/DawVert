/**
 * ZIP Utilities for Browser
 *
 * Provides ZIP file reading capabilities using browser-native APIs
 * without external dependencies.
 */

/**
 * Extract a file from a ZIP archive
 * @param zipFile The ZIP file (Blob or File)
 * @param filename The name of the file to extract
 * @returns The extracted file as ArrayBuffer, or null if not found
 */
export async function extractFileFromZip(
  zipFile: Blob | File,
  filename: string
): Promise<ArrayBuffer | null> {
  try {
    // Read the ZIP file as ArrayBuffer
    const buffer = await zipFile.arrayBuffer();
    const view = new DataView(buffer);

    // Simple ZIP file parser (Central Directory)
    // ZIP file structure:
    // - Local file headers + file data
    // - Central directory
    // - End of central directory record

    // Find end of central directory signature (0x06054b50)
    const endSig = 0x06054b50;
    let endOfCentralDirOffset = -1;

    for (let i = buffer.byteLength - 22; i >= 0; i--) {
      if (view.getUint32(i, true) === endSig) {
        endOfCentralDirOffset = i;
        break;
      }
    }

    if (endOfCentralDirOffset === -1) {
      console.error('Invalid ZIP file: End of central directory not found');
      return null;
    }

    // Read central directory offset
    const centralDirOffset = view.getUint32(endOfCentralDirOffset + 16, true);
    const centralDirSize = view.getUint32(endOfCentralDirOffset + 12, true);
    const numEntries = view.getUint16(endOfCentralDirOffset + 10, true);

    // Parse central directory entries
    let offset = centralDirOffset;
    const centralDirSig = 0x02014b50;

    for (let i = 0; i < numEntries; i++) {
      if (view.getUint32(offset, true) !== centralDirSig) {
        break;
      }

      const filenameLength = view.getUint16(offset + 28, true);
      const extraFieldLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localHeaderOffset = view.getUint32(offset + 42, true);

      // Read filename
      const filenameBytes = new Uint8Array(buffer, offset + 46, filenameLength);
      const entryFilename = new TextDecoder().decode(filenameBytes);

      // Check if this is the file we're looking for
      if (entryFilename === filename) {
        // Found it! Now read from local file header
        const localHeaderSig = 0x04034b50;
        if (view.getUint32(localHeaderOffset, true) !== localHeaderSig) {
          console.error('Invalid local file header');
          return null;
        }

        const compressionMethod = view.getUint16(localHeaderOffset + 8, true);
        const compressedSize = view.getUint32(localHeaderOffset + 18, true);
        const uncompressedSize = view.getUint32(localHeaderOffset + 22, true);
        const localFilenameLength = view.getUint16(localHeaderOffset + 26, true);
        const localExtraFieldLength = view.getUint16(localHeaderOffset + 28, true);

        // Calculate file data offset
        const fileDataOffset = localHeaderOffset + 30 + localFilenameLength + localExtraFieldLength;

        // Extract file data
        const fileData = buffer.slice(fileDataOffset, fileDataOffset + compressedSize);

        // If not compressed (stored), return directly
        if (compressionMethod === 0) {
          return fileData;
        }

        // If compressed with DEFLATE (method 8)
        if (compressionMethod === 8) {
          // Use browser's DecompressionStream API
          if ('DecompressionStream' in window) {
            const ds = new DecompressionStream('deflate-raw');
            const writer = ds.writable.getWriter();
            writer.write(new Uint8Array(fileData));
            writer.close();

            const decompressedChunks: Uint8Array[] = [];
            const reader = ds.readable.getReader();

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) decompressedChunks.push(value);
            }

            // Combine chunks
            const totalLength = decompressedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const result = new Uint8Array(totalLength);
            let position = 0;
            for (const chunk of decompressedChunks) {
              result.set(chunk, position);
              position += chunk.length;
            }

            return result.buffer;
          } else {
            throw new Error('DecompressionStream not supported in this browser. Cannot extract compressed files.');
          }
        }

        throw new Error(`Unsupported compression method: ${compressionMethod}`);
      }

      // Move to next entry
      offset += 46 + filenameLength + extraFieldLength + commentLength;
    }

    // File not found
    return null;
  } catch (error) {
    console.error('Error extracting file from ZIP:', error);
    return null;
  }
}

/**
 * List all files in a ZIP archive
 * @param zipFile The ZIP file (Blob or File)
 * @returns Array of filenames in the ZIP
 */
export async function listZipFiles(zipFile: Blob | File): Promise<string[]> {
  try {
    const buffer = await zipFile.arrayBuffer();
    const view = new DataView(buffer);

    // Find end of central directory
    const endSig = 0x06054b50;
    let endOfCentralDirOffset = -1;

    for (let i = buffer.byteLength - 22; i >= 0; i--) {
      if (view.getUint32(i, true) === endSig) {
        endOfCentralDirOffset = i;
        break;
      }
    }

    if (endOfCentralDirOffset === -1) {
      return [];
    }

    const centralDirOffset = view.getUint32(endOfCentralDirOffset + 16, true);
    const numEntries = view.getUint16(endOfCentralDirOffset + 10, true);

    const files: string[] = [];
    let offset = centralDirOffset;
    const centralDirSig = 0x02014b50;

    for (let i = 0; i < numEntries; i++) {
      if (view.getUint32(offset, true) !== centralDirSig) {
        break;
      }

      const filenameLength = view.getUint16(offset + 28, true);
      const extraFieldLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);

      const filenameBytes = new Uint8Array(buffer, offset + 46, filenameLength);
      const filename = new TextDecoder().decode(filenameBytes);

      files.push(filename);

      offset += 46 + filenameLength + extraFieldLength + commentLength;
    }

    return files;
  } catch (error) {
    console.error('Error listing ZIP files:', error);
    return [];
  }
}

/**
 * Check if browser supports DecompressionStream
 */
export function supportsDecompression(): boolean {
  return 'DecompressionStream' in window;
}

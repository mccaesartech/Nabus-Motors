function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function asciiAt(bytes: Uint8Array, offset: number, value: string): boolean {
  if (bytes.length < offset + value.length) return false;
  return [...value].every((char, index) => bytes[offset + index] === char.charCodeAt(0));
}

export function mediaBytesMatchMime(bytes: Uint8Array, mime: string): boolean {
  if (mime === "image/jpeg") {
    return startsWith(bytes, [0xff, 0xd8, 0xff]);
  }
  if (mime === "image/png") {
    return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (mime === "image/webp") {
    return asciiAt(bytes, 0, "RIFF") && asciiAt(bytes, 8, "WEBP");
  }
  if (mime === "video/mp4") {
    return asciiAt(bytes, 4, "ftyp");
  }
  if (mime === "video/webm") {
    return startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
  }
  return false;
}

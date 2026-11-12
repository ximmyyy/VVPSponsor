/** Uploadbeleid fase 5: alleen PDF/PNG/JPEG, inhoud gecontroleerd op signatuur. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const allowedTypes = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46, 0x2d],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "image/jpeg": [0xff, 0xd8, 0xff],
} as const;
export type AllowedType = keyof typeof allowedTypes;

/** Bepaalt het type uit de inhoud; de door de browser gemelde MIME moet overeenkomen. */
export function detectType(bytes: Uint8Array): AllowedType | null {
  for (const [type, signature] of Object.entries(allowedTypes))
    if (signature.every((byte, i) => bytes[i] === byte))
      return type as AllowedType;
  return null;
}

export function validateUpload(
  bytes: Uint8Array,
  declared: string,
): { ok: true; type: AllowedType } | { ok: false; message: string } {
  if (!bytes.length) return { ok: false, message: "Het bestand is leeg." };
  if (bytes.length > MAX_UPLOAD_BYTES)
    return { ok: false, message: "Het bestand is groter dan 8 MB." };
  const type = detectType(bytes);
  if (!type || type !== declared)
    return {
      ok: false,
      message: "Alleen echte PDF-, PNG- of JPEG-bestanden zijn toegestaan.",
    };
  return { ok: true, type };
}

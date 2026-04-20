import crypto from "node:crypto";

/**
 * Constant-time HMAC-SHA256 verification. Used by providers that sign
 * webhook bodies with a shared secret (Nango, GitHub, etc.).
 *
 * Nango: signature is the hex HMAC-SHA256 of `${secret}${raw-body}` per their
 * docs. We support both that digest style and the "pure body" style via the
 * `style` parameter — set it when the provider changes convention.
 */
export function verifyHmacSha256(opts: {
  secret: string;
  rawBody: string;
  signature: string | null;
  style?: "pure" | "secret-prefixed";
}): boolean {
  if (!opts.signature) return false;
  const payload =
    opts.style === "pure"
      ? opts.rawBody
      : `${opts.secret}${opts.rawBody}`;
  const expected = crypto
    .createHmac("sha256", opts.secret)
    .update(payload)
    .digest("hex");
  const provided = opts.signature.replace(/^sha256=/, "").trim();
  if (expected.length !== provided.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(provided, "hex"),
    );
  } catch {
    return false;
  }
}

export function isLocalDesignPreview(
  env: Record<string, string | undefined>,
  host: string | null,
) {
  if (env.NODE_ENV !== "development" || env.APP_ENV !== "local" || env.VERCEL)
    return false;
  if (!host) return false;
  try {
    const url = new URL(`http://${host}`);
    return (
      !url.username &&
      !url.password &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

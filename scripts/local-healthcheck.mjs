// Alleen exact de lokale Auth-probe van de gepinde Supabase CLI ondersteunen.
export function localHealthcheckArgs(args) {
  const copy = [...args];
  const healthIndex = copy.indexOf("--health-cmd");
  const nameIndex = copy.indexOf("--name");
  if (copy[0] === "create" && nameIndex !== -1 &&
      copy[nameIndex + 1]?.startsWith("supabase_auth_") && healthIndex !== -1 &&
      /^wget (?:--no-verbose --tries=1|\-q) --spider http:\/\/127\.0\.0\.1:9999\/health$/.test(copy[healthIndex + 1])) {
    copy[healthIndex + 1] = "wget -Y off -q --spider http://127.0.0.1:9999/health";
  }
  return copy;
}

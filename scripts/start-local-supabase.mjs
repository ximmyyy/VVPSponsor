import { spawnSync } from "node:child_process";
import { resolve, delimiter } from "node:path";

// CLI 3.1.0 gebruikt BusyBox wget voor Auth. Die negeert NO_PROXY.
// Alleen de loopback-healthcheck aanpassen; Docker-config en egress blijven intact.
const docker = spawnSync("which", ["docker"], { encoding: "utf8" });
if (docker.status !== 0) throw new Error("Docker ontbreekt.");
const result = spawnSync("./node_modules/.bin/supabase", ["start", "--output-format", "json"], {
  // De CLI retourneert ook lokale secret keys. Die nooit doorgeven aan logs.
  stdio: ["inherit", "pipe", "inherit"],
  encoding: "utf8",
  env: {
    ...process.env,
    SUPABASE_TELEMETRY_DISABLED: "1",
    VVP_DOCKER_BINARY: docker.stdout.trim(),
    PATH: `${resolve("scripts/docker-bin")}${delimiter}${process.env.PATH}`,
  },
});
if (result.error) throw result.error;
if (result.status === 0) console.log("Lokale Supabase-stack gestart en healthchecks geslaagd.");
else console.error("Lokale Supabase-start mislukt; controleer de foutmelding hierboven.");
process.exit(result.status ?? 1);

import path from "node:path";

// On Vercel (and other serverless hosts) the project filesystem is READ-ONLY —
// only /tmp is writable. Locally we keep data under ./data. This keeps the
// file-backed stores from throwing on writes in production. (Note: /tmp is
// ephemeral per-instance; a database is still the path to durable cloud data.)
export function dataDir(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return "/tmp/sahjony-data";
  }
  return path.join(process.cwd(), "data");
}

export function dataPath(...parts: string[]): string {
  return path.join(dataDir(), ...parts);
}

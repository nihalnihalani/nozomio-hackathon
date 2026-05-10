type EnvLike = Record<string, string | undefined>;

function cleanOrgId(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const cleaned = trimmed
    .replace(/^https?:\/\//, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return cleaned || null;
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function deploymentSeed(env: EnvLike): string {
  return (
    env.TRIAGE_ORG_SEED?.trim() ||
    env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    env.VERCEL_URL?.trim() ||
    env.NEXT_PUBLIC_CONVEX_URL?.trim() ||
    env.CONVEX_CLOUD_URL?.trim() ||
    env.CONVEX_SITE_URL?.trim() ||
    "triage-local"
  );
}

export function generatedOrgId(seed: string): string {
  const cleanedSeed = cleanOrgId(seed) ?? "triage";
  const readable = cleanedSeed.slice(0, 36).toLowerCase();
  return `org_${readable}_${fnv1a(seed)}`;
}

export function resolvePublicOrgId(
  env: EnvLike = process.env
): string | undefined {
  return cleanOrgId(env.NEXT_PUBLIC_TRIAGE_ORG_ID) ?? undefined;
}

export function resolveServerOrgId(env: EnvLike = process.env): string {
  return (
    cleanOrgId(env.TRIAGE_DEFAULT_ORG_ID) ??
    cleanOrgId(env.NEXT_PUBLIC_TRIAGE_ORG_ID) ??
    generatedOrgId(deploymentSeed(env))
  );
}

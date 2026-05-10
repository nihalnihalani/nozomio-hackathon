import { describe, expect, it } from "vitest";
import {
  generatedOrgId,
  resolvePublicOrgId,
  resolveServerOrgId,
} from "@/lib/org";

describe("org id resolution", () => {
  it("uses explicit server org id first", () => {
    expect(
      resolveServerOrgId({
        TRIAGE_DEFAULT_ORG_ID: "org_prod",
        NEXT_PUBLIC_TRIAGE_ORG_ID: "org_public",
      })
    ).toBe("org_prod");
  });

  it("falls back to public org id when the server override is absent", () => {
    expect(
      resolveServerOrgId({
        NEXT_PUBLIC_TRIAGE_ORG_ID: "org_public",
      })
    ).toBe("org_public");
  });

  it("generates a stable deployment org id when no org env is configured", () => {
    const env = { TRIAGE_ORG_SEED: "acme-prod" };
    expect(resolveServerOrgId(env)).toBe(generatedOrgId("acme-prod"));
    expect(resolveServerOrgId(env)).toBe(resolveServerOrgId(env));
    expect(resolveServerOrgId(env)).toMatch(/^org_acme-prod_[a-z0-9]+$/);
  });

  it("does not invent a public browser org id", () => {
    expect(resolvePublicOrgId({ TRIAGE_ORG_SEED: "acme-prod" })).toBeUndefined();
    expect(resolvePublicOrgId({ NEXT_PUBLIC_TRIAGE_ORG_ID: "org_ui" })).toBe(
      "org_ui"
    );
  });
});

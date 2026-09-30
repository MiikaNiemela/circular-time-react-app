import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { accessSecretVersion } = vi.hoisted(() => ({ accessSecretVersion: vi.fn() }));

vi.mock("@google-cloud/secret-manager", () => ({
  SecretManagerServiceClient: class {
    accessSecretVersion = accessSecretVersion;
  },
}));

describe("OAuth client secrets", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects before contacting Secret Manager when no resource is configured", async () => {
    vi.stubEnv("OUTLOOK_CLIENT_SECRET_RESOURCE", "");
    const { getOutlookClientSecret } = await import("./clientSecrets.server");

    await expect(getOutlookClientSecret()).rejects.toThrow(
      "OUTLOOK_CLIENT_SECRET_RESOURCE is not configured"
    );
    expect(accessSecretVersion).not.toHaveBeenCalled();
  });

  it("reads each secret once by resource name and caches the value", async () => {
    vi.stubEnv("GOOGLE_CLIENT_SECRET_RESOURCE", "projects/p/secrets/google/versions/latest");
    accessSecretVersion.mockResolvedValue([{ payload: { data: Buffer.from("google-secret") } }]);
    const { getGoogleClientSecret } = await import("./clientSecrets.server");

    await expect(getGoogleClientSecret()).resolves.toBe("google-secret");
    await expect(getGoogleClientSecret()).resolves.toBe("google-secret");

    expect(accessSecretVersion).toHaveBeenCalledTimes(1);
    expect(accessSecretVersion).toHaveBeenCalledWith({
      name: "projects/p/secrets/google/versions/latest",
    });
  });

  it("retries after a failed read instead of caching the failure", async () => {
    vi.stubEnv("OUTLOOK_CLIENT_SECRET_RESOURCE", "projects/p/secrets/outlook/versions/latest");
    accessSecretVersion
      .mockRejectedValueOnce(new Error("unavailable"))
      .mockResolvedValue([{ payload: { data: Buffer.from("outlook-secret") } }]);
    const { getOutlookClientSecret } = await import("./clientSecrets.server");

    await expect(getOutlookClientSecret()).rejects.toThrow("unavailable");
    await expect(getOutlookClientSecret()).resolves.toBe("outlook-secret");
  });
});

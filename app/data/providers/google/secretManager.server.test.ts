import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { accessSecretVersion, constructed } = vi.hoisted(() => ({
  accessSecretVersion: vi.fn(),
  constructed: vi.fn(),
}));

vi.mock("@google-cloud/secret-manager", () => ({
  SecretManagerServiceClient: class {
    constructor() {
      constructed();
    }

    accessSecretVersion = accessSecretVersion;
  },
}));

describe("getGoogleClientSecret", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.GOOGLE_CLIENT_SECRET_RESOURCE;
  });

  afterEach(() => {
    delete process.env.GOOGLE_CLIENT_SECRET_RESOURCE;
  });

  it("rejects before contacting Secret Manager when no resource is configured", async () => {
    const { getGoogleClientSecret } = await import("./secretManager.server");

    await expect(getGoogleClientSecret()).rejects.toThrow(
      "GOOGLE_CLIENT_SECRET_RESOURCE is not configured"
    );
    expect(constructed).not.toHaveBeenCalled();
  });
});

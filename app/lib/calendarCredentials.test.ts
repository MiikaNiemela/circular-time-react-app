import { describe, it, expect, vi } from "vitest";
import { randomBytes } from "node:crypto";
import {
  CalendarCredentialStore,
  ReconnectRequiredError,
  type CalendarCredentialRepository,
} from "./calendarCredentials";
import { TokenCipher } from "./tokenCipher.server";

const NOW = new Date("2026-10-01T12:00:00Z");
const HOUR = 3_600_000;

function memoryRepository(): CalendarCredentialRepository & { rows: Map<string, string> } {
  const rows = new Map<string, string>();
  return {
    rows,
    save: async (userId, connectionId, ciphertext) =>
      void rows.set(`${userId}/${connectionId}`, ciphertext),
    load: async (userId, connectionId) => rows.get(`${userId}/${connectionId}`) ?? null,
  };
}

function setup() {
  const repository = memoryRepository();
  const cipher = TokenCipher.fromBase64(randomBytes(32).toString("base64"));
  const store = new CalendarCredentialStore(repository, cipher, () => NOW);
  return { repository, cipher, store };
}

const notCalled = vi.fn(async () => {
  throw new Error("refresh must not be called");
});

describe("CalendarCredentialStore", () => {
  it("stores only ciphertext and returns a still-valid access token without refreshing", async () => {
    const { repository, store } = setup();

    await store.save("user-1", "conn-1", {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: NOW.getTime() + HOUR,
    });

    const [ciphertext] = [...repository.rows.values()];
    expect(ciphertext).not.toContain("access-token");
    expect(ciphertext).not.toContain("refresh-token");
    await expect(store.accessToken("user-1", "conn-1", notCalled)).resolves.toBe("access-token");
    expect(notCalled).not.toHaveBeenCalled();
  });

  it("refreshes an expiring token and stores the refreshed credential", async () => {
    const { store } = setup();
    await store.save("user-1", "conn-1", {
      accessToken: "old",
      refreshToken: "refresh-token",
      expiresAt: NOW.getTime() + 30_000,
    });
    const refresh = vi.fn(async () => ({
      accessToken: "new",
      refreshToken: "refresh-token",
      expiresAt: NOW.getTime() + HOUR,
    }));

    await expect(store.accessToken("user-1", "conn-1", refresh)).resolves.toBe("new");
    expect(refresh).toHaveBeenCalledWith("refresh-token");
    await expect(store.accessToken("user-1", "conn-1", notCalled)).resolves.toBe("new");
  });

  it("requires a reconnect when no credential is stored", async () => {
    const { store } = setup();

    await expect(store.accessToken("user-1", "conn-1", notCalled)).rejects.toBeInstanceOf(
      ReconnectRequiredError
    );
  });

  it("requires a reconnect when the token expired and there is no refresh token", async () => {
    const { store } = setup();
    await store.save("user-1", "conn-1", { accessToken: "old", expiresAt: NOW.getTime() - 1 });

    await expect(store.accessToken("user-1", "conn-1", notCalled)).rejects.toThrow(
      "reconnect required"
    );
  });

  it("requires a reconnect when the provider rejects the refresh", async () => {
    const { store } = setup();
    await store.save("user-1", "conn-1", {
      accessToken: "old",
      refreshToken: "revoked",
      expiresAt: NOW.getTime() - 1,
    });
    const refresh = vi.fn(async () => {
      throw new Error("outlook token endpoint failed: 400");
    });

    await expect(store.accessToken("user-1", "conn-1", refresh)).rejects.toBeInstanceOf(
      ReconnectRequiredError
    );
  });

  it("refuses another user's ciphertext copied into this user's row", async () => {
    const { repository, store } = setup();
    await store.save("user-a", "conn-1", {
      accessToken: "a-token",
      expiresAt: NOW.getTime() + HOUR,
    });
    repository.rows.set("user-b/conn-1", repository.rows.get("user-a/conn-1")!);

    await expect(store.accessToken("user-b", "conn-1", notCalled)).rejects.toThrow(
      "unreadable; reconnect required"
    );
  });
});

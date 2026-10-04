/** A calendar provider answered a read with a non-success HTTP status. */
export class ProviderHttpError extends Error {
  constructor(
    readonly provider: string,
    readonly status: number
  ) {
    super(`${provider} Calendar fetch failed: ${status}`);
    this.name = "ProviderHttpError";
  }
}

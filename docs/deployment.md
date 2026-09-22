# Development deployment

This document describes the application release path. It does not contain cloud account identifiers, credentials, or infrastructure state.

## Development

Pull requests run the test suite, static checks, component checks, and a production build. A successful merge to `main` deploys the exact merge commit to the development environment.

The deployment image is tagged with the Git commit SHA. The deployed image therefore identifies the source revision it contains.

The workflow authenticates to the cloud provider using GitHub Actions OpenID Connect and workload identity federation. It uses a short-lived job identity; no cloud service-account key is stored in the repository.

The public OAuth client IDs used by the browser build are stored as GitHub Actions environment secrets. They are bundled into the browser application at build time, but secret storage prevents accidental disclosure through repository configuration and workflow logs. OAuth client secrets, database credentials, session secrets, and cloud-resource configuration remain outside the repository.

## Future production promotion

Production is a separate environment. A production release must promote the immutable image already validated in development rather than rebuild from source. The production deployment will require an explicit approval and use a production-scoped cloud identity.

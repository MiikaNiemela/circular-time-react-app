# Development deployment

This document describes the application release path. It does not contain cloud account identifiers, credentials, or infrastructure state.

## Development

Pull requests run the test suite, static checks, component checks, and a production build. Branch protection admits a change to `main` only through a reviewed pull request that passes this `Test` check.

Every commit on `main` is released to the development environment by a pipeline owned by the private operations repository. The pipeline builds the commit with this repository's `Dockerfile`, tags the image with the Git commit SHA, applies the committed Prisma migrations with `prisma migrate deploy`, and then deploys the image. A failed migration stops the release before deployment.

This repository's workflow therefore needs no cloud identity or environment configuration. The public OAuth client IDs used by the browser build, OAuth client secrets, database credentials, session secrets, and cloud-resource configuration are all supplied by the release pipeline and runtime environment. None of them are stored in this repository.

## Future production promotion

Production is a separate environment. A production release must promote the immutable image already validated in development rather than rebuild from source. The production deployment will require an explicit approval and use a production-scoped cloud identity.

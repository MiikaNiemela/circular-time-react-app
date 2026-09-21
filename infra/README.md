# Infrastructure as Code

GCP infrastructure for this project is defined in [gcp.tf](gcp.tf) using Terraform (HCL).

The configuration covers: enabled APIs, Artifact Registry, Cloud Run, the GitHub Actions service account and its IAM roles, and Workload Identity Federation.

## GCP environment facts

| Item | Value |
|------|-------|
| Project ID | `dev-circular-time` |
| Project number | `683033464752` |
| Region | `europe-north1` |
| Cloud Run service | `circular-time-react-app` |
| Artifact Registry | `europe-north1-docker.pkg.dev/dev-circular-time/cloud-run-source-deploy/` |
| GitHub Actions service account | `github-deploy-sa@dev-circular-time.iam.gserviceaccount.com` |
| Workload Identity pool / provider | `github-pool` / `github-provider` |
| Terraform state bucket | `gs://dev-circular-time-tfstate` (GCS, `europe-north1`) |
| Terraform provider | `hashicorp/google ~> 6.0`, Terraform `>= 1.9` |

Secret Manager entries and the OAuth app registrations that pair with this environment are
documented in [`docs/architecture.md`](../docs/architecture.md#hosting).

### Managed by Terraform

Enabled APIs (run, artifactregistry, iamcredentials), the Artifact Registry repository, the
Cloud Run service, the GitHub deployer service account and its IAM roles (`run.admin`,
`artifactregistry.writer`, `iam.serviceAccountUser`), the Workload Identity pool, its
provider, and the WIF binding.

### Not managed by Terraform

- The state bucket itself — created manually at bootstrap, by necessity.
- GCP APIs beyond the three listed, which the console auto-enables.
- `gs://run-sources-dev-circular-time-europe-north2` — a leftover from an abandoned Cloud
  Build approach. Harmless; safe to delete.

## Terraform version

A `required_version` constraint is set in `gcp.tf` (Terraform >= 1.9). GCP Cloud Shell satisfies this constraint out of the box — no local Terraform install is needed or recommended.

## Normal workflow — manual apply from Cloud Shell

> **Terraform is not wired into CI.** The only workflow in this repository is
> `ci.yml`, which builds, tests, and deploys the application — it contains no
> Terraform steps. Infrastructure changes are applied manually.

Until then, apply infrastructure changes the same way as the bootstrap — from GCP
Cloud Shell, which has `gcloud` and Terraform pre-installed and authenticated:

```bash
cd circular-time-react-app/infra
terraform init
terraform plan   # review before applying
terraform apply
```

Running Terraform from a local machine works but means maintaining a local install
and an authenticated `gcloud`; Cloud Shell avoids both and is the recommended path.

## Bootstrap — new GCP project (day zero)

CI cannot apply Terraform on a blank project because WIF (the auth mechanism CI uses) is itself created by Terraform. Use **GCP Cloud Shell** for the one-time bootstrap — it has both `gcloud` and Terraform pre-installed and is already authenticated as your Google account.

Open Cloud Shell from the GCP Console (top-right terminal icon), then:

```bash
# 1. Clone the repo
git clone https://github.com/MiikaNiemela/circular-time-react-app.git
cd circular-time-react-app/infra

# 2. Create the remote state bucket (once — not managed by Terraform itself)
gcloud storage buckets create gs://dev-circular-time-tfstate \
    --project=dev-circular-time \
    --location=europe-north1 \
    --uniform-bucket-level-access

# 3. Initialise Terraform
terraform init

# 4. Preview what will be created or changed
terraform plan

# 5. Apply
terraform apply
```

After the first apply, CI takes over for all subsequent changes.

## Teardown

Since Terraform manages all resources from initial setup, teardown is straightforward:

```bash
terraform destroy
```

> **Note:** `disable_on_destroy = false` is set on the API resources, so `terraform destroy` will not disable the GCP APIs — only the other resources are removed.

The state bucket is not managed by Terraform. Delete it manually if removing the environment completely:

```bash
gcloud storage rm -r gs://dev-circular-time-tfstate
```

## Known gotchas

Each of these is relevant to operating the current infrastructure.

### Cloud Run `scaling` block drift

GCP auto-populates a `scaling` block with zero values on Cloud Run services. Without it in
the config, Terraform sees drift and tries to update the service — and if the service has a
failed revision, GCP refuses any update, deadlocking the apply. Both the image and the
scaling block are therefore held in `ignore_changes`:

```hcl
lifecycle {
  ignore_changes = [template[0].containers[0].image, scaling]
}
```

### Cloud Run image not found on the first apply

The service is created referencing an image that no CI run has pushed yet, so it enters a
failed revision state. This is expected — it heals on the first CI deploy, and the
`ignore_changes` above stops Terraform from interfering meanwhile.

### WIF pool and provider soft-delete

`terraform destroy` soft-deletes the pool and provider for **30 days**. They cannot be
recreated with the same ID during that window, so the next `apply` fails with a 409
conflict. Undelete and re-import rather than renaming:

```bash
gcloud iam workload-identity-pools undelete github-pool \
    --location=global --project=dev-circular-time

gcloud iam workload-identity-pools providers undelete github-provider \
    --workload-identity-pool=github-pool \
    --location=global --project=dev-circular-time

terraform import google_iam_workload_identity_pool.github_pool \
    "projects/dev-circular-time/locations/global/workloadIdentityPools/github-pool"

terraform import google_iam_workload_identity_pool_provider.github_provider \
    "projects/dev-circular-time/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
```

### Stale state lock

A failed `terraform plan` can leave a lock behind on the state bucket. Release it with the
lock ID printed in the error:

```bash
terraform force-unlock -force <LOCK_ID>
```

### `depends_on` is required for API-gated resources

Nothing references `google_project_service.enabled_apis` directly, so Terraform cannot infer
that the APIs must exist before Cloud Run, Artifact Registry, and the WIF pool are created.
All three carry an explicit `depends_on`.

### Action-version warnings are not about the project's Node version

Node deprecation warnings from GitHub Actions come from the action's own internal runtime.
Fix them by updating action versions, never by adding `actions/setup-node`.

## Commands reference

| Command | Purpose |
|---------|---------|
| `terraform init` | Download provider plugins, configure backend |
| `terraform plan` | Preview changes without applying |
| `terraform apply` | Apply changes |
| `terraform destroy` | Tear down all managed resources |

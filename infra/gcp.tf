terraform {
  required_version = ">= 1.9"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
  backend "gcs" {
    bucket = "dev-circular-time-tfstate"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = "dev-circular-time"
  region  = "europe-north1"
}

# 1. Enabled APIs
resource "google_project_service" "enabled_apis" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "iamcredentials.googleapis.com"
  ])
  service            = each.key
  disable_on_destroy = false
}

# 2. Artifact Registry
resource "google_artifact_registry_repository" "repo" {
  location      = "europe-north1"
  repository_id = "cloud-run-source-deploy"
  format        = "DOCKER"
  depends_on    = [google_project_service.enabled_apis]
}

# 3. Cloud Run v2 Service
# Image is managed by the deploy workflow; Terraform owns the service config only.
resource "google_cloud_run_v2_service" "app" {
  name       = "circular-time-react-app"
  location   = "europe-north1"
  depends_on = [google_project_service.enabled_apis]

  template {
    containers {
      image = "europe-north1-docker.pkg.dev/dev-circular-time/cloud-run-source-deploy/circular-time-react-app:latest"
      ports {
        container_port = 8080
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].containers[0].image, scaling]
  }
}

# 4. Service Account and project-level IAM roles
resource "google_service_account" "github_deployer" {
  account_id   = "github-deploy-sa"
  display_name = "GitHub Actions Deployment Account"
}

resource "google_project_iam_member" "deployer_roles" {
  for_each = toset([
    "roles/run.admin",
    "roles/artifactregistry.writer",
    "roles/iam.serviceAccountUser",
  ])
  project = "dev-circular-time"
  role    = each.key
  member  = "serviceAccount:${google_service_account.github_deployer.email}"
}

# 5. Workload Identity Federation
resource "google_iam_workload_identity_pool" "github_pool" {
  workload_identity_pool_id = "github-pool"
  display_name              = "GitHub Deployment Pool"
  depends_on                = [google_project_service.enabled_apis]
}

resource "google_iam_workload_identity_pool_provider" "github_provider" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github_pool.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub Provider"
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }
  attribute_condition = "assertion.repository == 'MiikaNiemela/circular-time-react-app'"
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# Allow GitHub Actions to impersonate the deployer SA via WIF
resource "google_service_account_iam_member" "wif_binding" {
  service_account_id = google_service_account.github_deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github_pool.name}/attribute.repository/MiikaNiemela/circular-time-react-app"
}

# The single resource needed to map the domain directly to your app
resource "google_cloud_run_domain_mapping" "dev_domain" {
  location = "europe-north1"
  name     = "dev.rjpnt.com"

  metadata {
    namespace = "dev-circular-time" # Must match your Project ID
  }

  spec {
    route_name = "circular-time-react-app"
  }
}

# Output the DNS records you need to add to your registrar (e.g., Namecheap/GoDaddy)
output "dns_records" {
  value = google_cloud_run_domain_mapping.dev_domain.status[0].resource_records
}

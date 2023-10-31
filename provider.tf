terraform {
  required_providers {
    checkpoint = {
      source = "CheckPointSW/checkpoint"
      version = "2.6.0"
    }
  }
}

provider "checkpoint" {
  # Configuration options
    server   = var.CPSERVER
  api_key  = var.CPAPIKEY
  context  = "web_api"
  cloud_mgmt_id = var.CPTENANT
}
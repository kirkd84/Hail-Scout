# Route53 DNS records for HailScout API
# Usage: terraform apply -var="alb_dns_name=xyz.elb.amazonaws.com"

variable "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  type        = string
}

variable "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  type        = string
  default     = "Z35SXDOTRQ7X7K"  # us-east-1
}

variable "root_domain" {
  description = "Root domain name"
  type        = string
  default     = "hailscout.com"
}

# Get the hosted zone for hailscout.com
data "aws_route53_zone" "main" {
  name = var.root_domain
}

# API subdomain: api.hailscout.com -> ALB
resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "api.${var.root_domain}"
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}

# Health check for API
resource "aws_route53_health_check" "api" {
  fqdn              = "api.${var.root_domain}"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 30

  tags = {
    Name = "hailscout-api-health"
  }
}

output "api_endpoint" {
  description = "API endpoint URL"
  value       = "https://api.${var.root_domain}"
}

output "health_check_id" {
  description = "Route53 health check ID"
  value       = aws_route53_health_check.api.id
}

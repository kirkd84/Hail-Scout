# CloudFront distribution for hailscout-tiles S3 bucket
# Serves tiles via https://tiles.hailscout.com/{swaths,historical}/{z}/{x}/{y}.pbf

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "s3_bucket_name" {
  description = "S3 bucket for tiles"
  type        = string
  default     = "hailscout-tiles"
}

variable "domain_name" {
  description = "CloudFront domain (e.g., tiles.hailscout.com)"
  type        = string
  default     = "tiles.hailscout.com"
}

variable "acm_certificate_arn" {
  description = "ARN of ACM certificate for *.hailscout.com"
  type        = string
}

# Origin Access Control (OAC) for S3
resource "aws_cloudfront_origin_access_control" "s3_oac" {
  name                              = "hailscout-tiles-oac"
  description                       = "OAC for hailscout-tiles S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Cache policy for active tiles (short TTL)
resource "aws_cloudfront_cache_policy" "tiles_active" {
  name            = "hailscout-tiles-active"
  comment         = "Cache policy for active swaths (60 seconds)"
  default_ttl     = 60
  max_ttl         = 60
  min_ttl         = 1
  enable_accept_encoding_gzip   = true
  enable_accept_encoding_brotli = true

  parameters_in_cache_key_and_forwarded_headers {
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true

    query_strings {
      behavior = "none"
    }

    headers {
      behavior = "none"
    }

    cookies {
      behavior = "none"
    }
  }
}

# Cache policy for historical tiles (1 year / immutable)
resource "aws_cloudfront_cache_policy" "tiles_historical" {
  name            = "hailscout-tiles-historical"
  comment         = "Cache policy for historical tiles (1 year)"
  default_ttl     = 31536000  # 1 year
  max_ttl         = 31536000
  min_ttl         = 31536000
  enable_accept_encoding_gzip   = true
  enable_accept_encoding_brotli = true

  parameters_in_cache_key_and_forwarded_headers {
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true

    query_strings {
      behavior = "none"
    }

    headers {
      behavior = "none"
    }

    cookies {
      behavior = "none"
    }
  }
}

# CloudFront distribution
resource "aws_cloudfront_distribution" "tiles" {
  origin {
    domain_name              = "${var.s3_bucket_name}.s3.${var.aws_region}.amazonaws.com"
    origin_id                = "s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3_oac.id
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = ""

  # Default cache behavior (fallback)
  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "s3"
    compress                   = true
    cache_policy_id            = aws_cloudfront_cache_policy.tiles_active.id
    viewer_protocol_policy     = "https-only"
  }

  # Cache behavior for active swaths
  cache_behavior {
    path_pattern               = "/swaths/*"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "s3"
    compress                   = true
    cache_policy_id            = aws_cloudfront_cache_policy.tiles_active.id
    viewer_protocol_policy     = "https-only"
  }

  # Cache behavior for historical tiles
  cache_behavior {
    path_pattern               = "/historical/*"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "s3"
    compress                   = true
    cache_policy_id            = aws_cloudfront_cache_policy.tiles_historical.id
    viewer_protocol_policy     = "https-only"
  }

  # Custom domain and SSL
  viewer_certificate {
    acm_certificate_arn            = var.acm_certificate_arn
    ssl_support_method             = "sni-only"
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  aliases = [var.domain_name]

  # Logging (optional)
  logging_config {
    include_cookies = false
    bucket          = "${var.s3_bucket_name}-logs.s3.amazonaws.com"
    prefix          = "cloudfront-logs"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Name        = "hailscout-tiles"
    Environment = "production"
  }
}

output "distribution_id" {
  value       = aws_cloudfront_distribution.tiles.id
  description = "CloudFront distribution ID"
}

output "domain_name" {
  value       = aws_cloudfront_distribution.tiles.domain_name
  description = "CloudFront domain name"
}

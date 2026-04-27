"""CloudFront cache invalidation helper."""

import logging

import boto3

logger = logging.getLogger(__name__)


def invalidate_cloudfront(distribution_id: str, pattern: str) -> str:
    """Invalidate CloudFront cache for a given path pattern.

    Args:
        distribution_id: CloudFront distribution ID
        pattern: Path pattern to invalidate (e.g., "/swaths/*")

    Returns:
        Invalidation ID (for tracking)
    """
    client = boto3.client("cloudfront")

    logger.info(f"Invalidating CloudFront distribution {distribution_id}: {pattern}")

    response = client.create_invalidation(
        DistributionId=distribution_id,
        InvalidationBatch={
            "Paths": {
                "Quantity": 1,
                "Items": [pattern],
            },
            "CallerReference": str(__import__("time").time()),
        },
    )

    invalidation_id = response["Invalidation"]["Id"]
    logger.info(f"Created invalidation {invalidation_id}")

    return invalidation_id

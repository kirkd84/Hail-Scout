"""Request/response schemas."""

from __future__ import annotations

from hailscout_api.schemas.ai import (
    ClaimLetterRequest,
    ClaimLetterResponse,
    DamageTriageRequest,
    DamageTriageResponse,
    NaturalLanguageQueryRequest,
    NaturalLanguageQueryResponse,
    StormScoreRequest,
    StormScoreResponse,
)
from hailscout_api.schemas.contact import (
    BulkContactExportRequest,
    BulkContactExportResponse,
    ContactEnrichRequest,
    ContactEnrichResponse,
)
from hailscout_api.schemas.hail import (
    AddressInfo,
    HailAtAddressResponse,
    HailImpactRecord,
)
from hailscout_api.schemas.marker import MarkerCreate, MarkerResponse, MarkerUpdate
from hailscout_api.schemas.me import (
    MeResponse,
    OrganizationResponse,
    SeatResponse,
    UserResponse,
)
from hailscout_api.schemas.monitored_address import (
    MonitoredAddressCreate,
    MonitoredAddressResponse,
)
from hailscout_api.schemas.report import (
    BrandingInfo,
    HailImpactReportCreate,
    HailImpactReportResponse,
)
from hailscout_api.schemas.storm import (
    NexradFrameResponse,
    StormDetailResponse,
    StormReplayResponse,
    StormResponse,
    StormsListResponse,
)

__all__ = [
    # Me
    "MeResponse",
    "UserResponse",
    "OrganizationResponse",
    "SeatResponse",
    # Storms
    "StormResponse",
    "StormsListResponse",
    "StormDetailResponse",
    "NexradFrameResponse",
    "StormReplayResponse",
    # Hail
    "HailAtAddressResponse",
    "AddressInfo",
    "HailImpactRecord",
    # Markers
    "MarkerCreate",
    "MarkerUpdate",
    "MarkerResponse",
    # Monitored addresses
    "MonitoredAddressCreate",
    "MonitoredAddressResponse",
    # Reports
    "HailImpactReportCreate",
    "HailImpactReportResponse",
    "BrandingInfo",
    # Contacts
    "ContactEnrichRequest",
    "ContactEnrichResponse",
    "BulkContactExportRequest",
    "BulkContactExportResponse",
    # AI
    "StormScoreRequest",
    "StormScoreResponse",
    "DamageTriageRequest",
    "DamageTriageResponse",
    "NaturalLanguageQueryRequest",
    "NaturalLanguageQueryResponse",
    "ClaimLetterRequest",
    "ClaimLetterResponse",
]

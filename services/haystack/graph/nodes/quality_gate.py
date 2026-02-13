"""Quality Gate node: rule-based validation and three-way routing."""

import structlog

from config import MIN_CONFIDENCE_SCORE
from graph.state import PipelineState
from utils.reliability import get_tier_config

logger = structlog.get_logger()

# Risk flags that always require human review
HIGH_RISK_FLAGS = {
    "minor_involved",
    "allegation_or_crime_accusation",
    "high_defamation_risk",
    "medical_or_public_health_claim",
}


async def quality_gate_node(state: PipelineState) -> dict:
    """Apply rule-based quality gate to enriched articles.

    Three-way routing:
    - APPROVED: confidence >= threshold, no high-risk flags -> create field note
    - FLAGGED: has high-risk flags, low confidence, or yellow_press source -> moderation queue
    - REJECTED: missing critical data or too low quality -> archive only

    Source reliability tiers affect routing:
    - yellow_press: always flagged for moderation, higher confidence bar
    - official: uses standard thresholds
    - standard: uses standard thresholds
    """
    enriched = state.get("enriched_articles", [])

    if not enriched:
        return {"approved_articles": [], "flagged_articles": []}

    approved = []
    flagged = []
    rejected_count = 0

    for article in enriched:
        confidence = article.get("confidence_score", 0)
        risk_flags = article.get("risk_flags", [])
        what = article.get("what", "")
        raw = article["classified"]["raw"]

        # Get source reliability tier config
        source_metadata = raw.get("raw_metadata", {})
        reliability_tier = source_metadata.get("reliability_tier", "standard")
        tier_config = get_tier_config(reliability_tier)

        # Determine effective confidence threshold
        min_confidence = tier_config.get("min_confidence_override") or MIN_CONFIDENCE_SCORE

        # Check for high-risk flags
        has_high_risk = any(
            flag.get("type") in HIGH_RISK_FLAGS
            for flag in risk_flags
        )

        # Reject: missing critical data or very low confidence
        if not what or confidence < 10:
            rejected_count += 1
            logger.info(
                "quality_gate.rejected",
                title=raw["title"][:60],
                confidence=confidence,
                reason="missing_data" if not what else "very_low_confidence",
            )
            continue

        # Flag for review: high risk, low confidence, yellow press, or force_moderation
        if has_high_risk or confidence < min_confidence or tier_config.get("force_moderation"):
            flagged.append(article)
            flag_reason = (
                "high_risk" if has_high_risk
                else "yellow_press" if tier_config.get("force_moderation")
                else "low_confidence"
            )
            logger.info(
                "quality_gate.flagged",
                title=raw["title"][:60],
                confidence=confidence,
                has_high_risk=has_high_risk,
                tier=reliability_tier,
                reason=flag_reason,
            )
            continue

        # Approved: good confidence and no high risk
        approved.append(article)
        logger.info(
            "quality_gate.approved",
            title=raw["title"][:60],
            confidence=confidence,
            tier=reliability_tier,
        )

    logger.info(
        "quality_gate.done",
        approved=len(approved),
        flagged=len(flagged),
        rejected=rejected_count,
    )

    return {
        "approved_articles": approved,
        "flagged_articles": flagged,
        "stats": {
            **state.get("stats", {}),
            "approved_count": len(approved),
            "flagged_count": len(flagged),
            "quality_rejected_count": rejected_count,
        },
    }

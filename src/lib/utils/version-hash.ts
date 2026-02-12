import { createHash } from "crypto";
import type { ContentBlock, SourceEntry, RiskFlag } from "../db/schema";

export function generateVersionHash(
  contentBlocks: ContentBlock[],
  sourceLog: SourceEntry[],
  riskFlags: RiskFlag[]
): string {
  const payload = JSON.stringify({
    contentBlocks,
    sourceLog,
    riskFlags,
  });
  return createHash("sha256").update(payload).digest("hex");
}

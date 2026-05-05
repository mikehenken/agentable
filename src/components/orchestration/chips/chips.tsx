import * as React from "react";
import { Pill, type PillTone } from "../../general/pill";
import type { IntentPriority, IntentStatus } from "../types";

const PRIORITY_TONE: Record<IntentPriority, PillTone> = {
  critical: "negative",
  high: "warn",
  medium: "info",
  low: "neutral",
};

export const PriorityChip: React.FC<{ p: IntentPriority }> = ({ p }) => (
  <Pill tone={PRIORITY_TONE[p] ?? "neutral"}>{p}</Pill>
);

const STATUS_TONE: Record<IntentStatus, PillTone> = {
  verified: "positive",
  paraphrased: "warn",
  "needs-clarification": "negative",
};

export const StatusChip: React.FC<{ s: IntentStatus }> = ({ s }) => (
  <Pill tone={STATUS_TONE[s] ?? "neutral"}>{s}</Pill>
);

const CATEGORY_TONE: Record<string, PillTone> = {
  experience: "accent",
  compliance: "warn",
  integration: "info",
  branding: "neutral",
  operational: "neutral",
  analytics: "neutral",
};

export const CategoryChip: React.FC<{ c: string }> = ({ c }) => (
  <Pill tone={CATEGORY_TONE[c] ?? "neutral"} mono={false}>
    {c}
  </Pill>
);

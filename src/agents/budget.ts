/**
 * Shared agent budget signal: spend counters and costClass checks
 * so job-class starts can surface a warning approval note when expensive.
 */
import type { ToolCostClass } from '../panels/tools';

export interface AgentBudgetLimits {
  /** Soft remaining units before expensive jobs warn. */
  warnBelow?: number;
  /** Hard ceiling; starts above this are refused. */
  hardCap?: number;
}

export interface BudgetSpendRecord {
  agentId: string;
  capability: string;
  costClass: ToolCostClass;
  units: number;
  at: number;
}

export type BudgetCheckResult =
  | { ok: true; remaining: number; warning?: string }
  | { ok: false; remaining: number; reason: 'hard_cap'; message: string };

export interface AgentBudgetSignal {
  readonly spent: number;
  remaining(): number;
  record(spend: Omit<BudgetSpendRecord, 'at'> & { at?: number }): BudgetSpendRecord;
  /**
   * Check whether a capability of the given costClass may start.
   * Expensive capabilities warn when remaining is below warnBelow.
   */
  checkCostClass(costClass: ToolCostClass, units?: number): BudgetCheckResult;
  history(limit?: number): readonly BudgetSpendRecord[];
  reset(): void;
  setLimits(limits: AgentBudgetLimits): void;
}

export const DEFAULT_BUDGET_HARD_CAP = 1_000;
export const DEFAULT_BUDGET_WARN_BELOW = 100;
export const EXPENSIVE_DEFAULT_UNITS = 50;
export const CHEAP_DEFAULT_UNITS = 1;

export function createAgentBudget(options?: {
  limits?: AgentBudgetLimits;
  now?: () => number;
  initialSpent?: number;
}): AgentBudgetSignal {
  const now = options?.now ?? (() => Date.now());
  let spent = options?.initialSpent ?? 0;
  let limits: Required<AgentBudgetLimits> = {
    warnBelow: options?.limits?.warnBelow ?? DEFAULT_BUDGET_WARN_BELOW,
    hardCap: options?.limits?.hardCap ?? DEFAULT_BUDGET_HARD_CAP,
  };
  const records: BudgetSpendRecord[] = [];

  const remaining = (): number => Math.max(0, limits.hardCap - spent);

  return {
    get spent(): number {
      return spent;
    },

    remaining,

    record(spend): BudgetSpendRecord {
      const entry: BudgetSpendRecord = {
        agentId: spend.agentId,
        capability: spend.capability,
        costClass: spend.costClass,
        units: spend.units,
        at: spend.at ?? now(),
      };
      spent += spend.units;
      records.push(entry);
      return { ...entry };
    },

    checkCostClass(costClass: ToolCostClass, units?: number): BudgetCheckResult {
      const requested =
        units ??
        (costClass === 'expensive' ? EXPENSIVE_DEFAULT_UNITS : CHEAP_DEFAULT_UNITS);
      const left = remaining();
      if (requested > left) {
        return {
          ok: false,
          remaining: left,
          reason: 'hard_cap',
          message: `Insufficient budget for ${costClass} capability (need ${requested}, remaining ${left}).`,
        };
      }
      if (costClass === 'expensive' && left - requested < limits.warnBelow) {
        return {
          ok: true,
          remaining: left,
          warning: `Expensive capability would leave budget at ${left - requested} (warn below ${limits.warnBelow}).`,
        };
      }
      return { ok: true, remaining: left };
    },

    history(limit?: number): readonly BudgetSpendRecord[] {
      const slice = limit === undefined ? records : records.slice(-limit);
      return slice.map((entry) => ({ ...entry }));
    },

    reset(): void {
      spent = 0;
      records.length = 0;
    },

    setLimits(next: AgentBudgetLimits): void {
      limits = {
        warnBelow: next.warnBelow ?? limits.warnBelow,
        hardCap: next.hardCap ?? limits.hardCap,
      };
    },
  };
}

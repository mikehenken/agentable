/**

 * Budget spend telemetry bridge ( costClass ).

 */

import type { AgentBudgetSignal, BudgetSpendRecord } from '../agents/budget';

import { buildCostTelemetryEvent, type TelemetryEmit } from './emit';



export function wrapBudgetWithTelemetry(

  budget: AgentBudgetSignal,

  emit: TelemetryEmit): AgentBudgetSignal {

  return {...budget,

    record(spend: Omit<BudgetSpendRecord, 'at'> & { at?: number }): BudgetSpendRecord {

      const entry = budget.record(spend);

      emit(

        buildCostTelemetryEvent({

          outcome: 'recorded',

          agentId: entry.agentId,

          capability: entry.capability,

          costClass: entry.costClass,

          units: entry.units,

        }));

      return entry;

    },

    checkCostClass(costClass, units) {

      const result = budget.checkCostClass(costClass, units);

      if (!result.ok && result.reason === 'hard_cap') {

        emit(

          buildCostTelemetryEvent({

            outcome: 'refused',

            agentId: 'unknown',

            capability: costClass,

            costClass,

            units: units ?? 0,

            errorCodes: ['BUDGET_HARD_CAP'],

          }));

      }

      return result;

    },

  };

}



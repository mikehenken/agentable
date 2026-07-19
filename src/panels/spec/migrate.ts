import type { PanelSpec, SpecMigration } from '../types';
import { CURRENT_SPEC_VERSION } from './constants';

export interface MigrateSpecResult {
  spec: PanelSpec;
  /** `from` versions whose migrations were applied, in order. */
  applied: number[];
}

export class SpecMigrationError extends Error {
  readonly fromVersion: number;
  readonly targetVersion: number;

  constructor(message: string, fromVersion: number, targetVersion: number) {
    super(message);
    this.name = 'SpecMigrationError';
    this.fromVersion = fromVersion;
    this.targetVersion = targetVersion;
  }
}

/**
 * Applies ordered migrations until `spec.v` reaches `targetVersion`.
 * Migrations must form a contiguous chain from the spec's current version.
 */
export function migrateSpec(
  spec: PanelSpec,
  migrations: readonly SpecMigration[],
  targetVersion: number = CURRENT_SPEC_VERSION,
): MigrateSpecResult {
  let current: PanelSpec = {
    ...spec,
    nodes: { ...spec.nodes },
    ...(spec.actions !== undefined ? { actions: { ...spec.actions } } : {}),
    ...(spec.sources !== undefined ? { sources: { ...spec.sources } } : {}),
    ...(spec.state !== undefined ? { state: { ...spec.state } } : {}),
  };
  const applied: number[] = [];

  if (current.v >= targetVersion) {
    return { spec: current, applied };
  }

  if (current.v > targetVersion) {
    throw new SpecMigrationError(
      `Spec version ${current.v} is newer than target ${targetVersion}`,
      current.v,
      targetVersion,
    );
  }

  const ordered = [...migrations].sort((a, b) => a.from - b.from);

  while (current.v < targetVersion) {
    const step = ordered.find((migration) => migration.from === current.v);
    if (step === undefined) {
      throw new SpecMigrationError(
        `No migration from version ${current.v} to reach ${targetVersion}`,
        current.v,
        targetVersion,
      );
    }
    if (step.to <= step.from) {
      throw new SpecMigrationError(
        `Migration from ${step.from} must increase version (got to=${step.to})`,
        step.from,
        targetVersion,
      );
    }
    current = step.up(current);
    applied.push(step.from);
    if (current.v !== step.to) {
      throw new SpecMigrationError(
        `Migration from ${step.from} to ${step.to} returned v=${current.v}`,
        step.from,
        targetVersion,
      );
    }
  }

  return { spec: current, applied };
}

/**
 * Returns true when migrations exist to bring `spec.v` up to `targetVersion`.
 */
export function canMigrateSpec(
  spec: PanelSpec,
  migrations: readonly SpecMigration[],
  targetVersion: number = CURRENT_SPEC_VERSION,
): boolean {
  try {
    migrateSpec(spec, migrations, targetVersion);
    return true;
  } catch {
    return false;
  }
}

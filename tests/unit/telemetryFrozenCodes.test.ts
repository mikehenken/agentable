/**

 * frozen telemetry error codes.

 * Automated check: canonical sorted snapshot of all telemetry error codes.

 */

import { describe, it, expect } from 'vitest';

import { FROZEN_REPAIR_ERROR_CODES } from '../../src/panels/spec/repairVocabulary';

import {

  FROZEN_TELEMETRY_ERROR_CODES,
  TELEMETRY_COST_ERROR_CODES,
  TELEMETRY_EMBED_ERROR_CODES,
  TELEMETRY_TOOL_ERROR_CODES,
  TELEMETRY_VOICE_ERROR_CODES,
  isFrozenTelemetryErrorCode,

} from '../../src/telemetry/frozenErrorCodes';



describe('frozen telemetry error codes', () => {

  it('matches the canonical sorted snapshot', () => {

    expect([...FROZEN_TELEMETRY_ERROR_CODES].sort()).toMatchSnapshot();

  });



  it('extends the repair vocabulary without dropping codes', () => {

    for (const code of FROZEN_REPAIR_ERROR_CODES) {

      expect(isFrozenTelemetryErrorCode(code)).toBe(true);

    }

  });



  it('includes tool, voice, cost, and embed layer codes', () => {
    for (const code of TELEMETRY_TOOL_ERROR_CODES) {
      expect(isFrozenTelemetryErrorCode(code)).toBe(true);
    }
    for (const code of TELEMETRY_VOICE_ERROR_CODES) {
      expect(isFrozenTelemetryErrorCode(code)).toBe(true);
    }
    for (const code of TELEMETRY_COST_ERROR_CODES) {
      expect(isFrozenTelemetryErrorCode(code)).toBe(true);
    }
    for (const code of TELEMETRY_EMBED_ERROR_CODES) {
      expect(isFrozenTelemetryErrorCode(code)).toBe(true);
    }
  });

});



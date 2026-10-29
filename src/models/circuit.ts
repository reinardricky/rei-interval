import { Preset, newId } from './preset';
import { CircuitStep } from './timeline';

/** Which kind of tab the setup screen is showing, and so what Start plays. */
export type Mode = 'presets' | 'circuits';

/**
 * A named run of presets played back to back as one session. Steps reference
 * presets by id rather than copying them, so tuning a preset retunes every
 * circuit that uses it. The same preset may appear more than once.
 */
export type Circuit = {
  id: string;
  name: string;
  presetIds: string[];
  /** Wait for a tap before each exercise after the first. */
  pauseBetween: boolean;
};

export function createCircuit(name: string, presetIds: string[] = []): Circuit {
  return { id: newId(), name, presetIds, pauseBetween: false };
}

/** The presets a circuit runs, in order. A step whose preset is gone is skipped. */
export function resolveSteps(circuit: Circuit, presets: Preset[]): CircuitStep[] {
  const out: CircuitStep[] = [];
  for (const id of circuit.presetIds) {
    const preset = presets.find((p) => p.id === id);
    if (preset) out.push({ name: preset.name, config: preset.config });
  }
  return out;
}

/** How many circuits would lose a step if this preset were deleted. */
export function circuitsUsing(circuits: Circuit[], presetId: string): number {
  return circuits.filter((c) => c.presetIds.includes(presetId)).length;
}

/** Moves the step at `index` by `delta`, clamped to the ends of the list. */
export function moveStep(circuit: Circuit, index: number, delta: number): Circuit {
  const target = index + delta;
  if (target < 0 || target >= circuit.presetIds.length) return circuit;
  const presetIds = [...circuit.presetIds];
  [presetIds[index], presetIds[target]] = [presetIds[target], presetIds[index]];
  return { ...circuit, presetIds };
}

/** Skips malformed records rather than dropping the whole list. */
export function parseCircuits(raw: unknown): Circuit[] {
  if (!Array.isArray(raw)) return [];
  const out: Circuit[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { id, name, presetIds, pauseBetween } = item as Record<string, unknown>;
    if (typeof id !== 'string' || typeof name !== 'string') continue;
    out.push({
      id,
      name,
      presetIds: Array.isArray(presetIds)
        ? presetIds.filter((p): p is string => typeof p === 'string')
        : [],
      pauseBetween: pauseBetween === true,
    });
  }
  return out;
}

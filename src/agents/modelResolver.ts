/**
 * Host-supplied model resolver registry and fallback resolution (D49).
 */
import type {
  CapabilityNote,
  ModelCapabilities,
  ModelResolveContext,
  ModelResolver,
  ProviderBinding,
  ResolvedModelBinding,
} from './types';
import { ModelResolveError } from './types';

let activeResolver: ModelResolver | null = null;

export function registerModelResolver(resolver: ModelResolver): () => void {
  activeResolver = resolver;
  return () => {
    if (activeResolver === resolver) {
      activeResolver = null;
    }
  };
}

export function getRegisteredModelResolver(): ModelResolver | null {
  return activeResolver;
}

export function clearModelResolverForTests(): void {
  activeResolver = null;
}

function bindingAvailable(binding: ProviderBinding): boolean {
  return binding.available !== false;
}

function meetsRequiredCaps(
  caps: ModelCapabilities,
  required?: Partial<ModelCapabilities>,
): boolean {
  if (!required) return true;
  if (required.vision === true && !caps.vision) return false;
  if (required.tools === true && !caps.tools) return false;
  if (required.streaming === true && !caps.streaming) return false;
  if (
    typeof required.contextTokens === 'number' &&
    caps.contextTokens < required.contextTokens
  ) {
    return false;
  }
  return true;
}

function enqueueFallbacks(
  queue: string[],
  visited: Set<string>,
  binding: ProviderBinding,
): void {
  for (const alias of binding.fallback ?? []) {
    if (!visited.has(alias)) {
      visited.add(alias);
      queue.push(alias);
    }
  }
}

/**
 * Resolve an alias through the registered resolver, walking each binding's
 * ordered `fallback` chain on unavailable bindings or capability mismatch.
 */
export async function resolveModelBinding(
  alias: string,
  ctx: ModelResolveContext,
  options?: { requiredCaps?: Partial<ModelCapabilities> },
): Promise<ResolvedModelBinding> {
  const resolver = activeResolver;
  if (!resolver) {
    throw new ModelResolveError(
      'NO_RESOLVER',
      'No model resolver registered; host must call registerModelResolver before creating sessions.',
    );
  }

  const notes: CapabilityNote[] = [];
  const visited = new Set<string>();
  const queue: string[] = [];

  const seed = alias.trim();
  if (!seed) {
    throw new ModelResolveError('RESOLVE_EXHAUSTED', 'Model alias must be a non-empty string.');
  }

  visited.add(seed);
  queue.push(seed);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;

    let binding: ProviderBinding;
    try {
      binding = await resolver(current, ctx);
    } catch (err: unknown) {
      notes.push({
        code: 'MODEL_UNAVAILABLE',
        alias: current,
        message:
          err instanceof Error
            ? err.message
            : `Resolver failed for alias "${current}".`,
      });
      continue;
    }

    if (!bindingAvailable(binding)) {
      notes.push({
        code: 'MODEL_UNAVAILABLE',
        alias: current,
        message: `Binding for alias "${current}" is marked unavailable.`,
      });
      enqueueFallbacks(queue, visited, binding);
      continue;
    }

    if (!meetsRequiredCaps(binding.caps, options?.requiredCaps)) {
      notes.push({
        code: 'CAPABILITY_MISMATCH',
        alias: current,
        message: `Binding for alias "${current}" does not satisfy required capabilities.`,
      });
      enqueueFallbacks(queue, visited, binding);
      continue;
    }

    return {
      resolvedAlias: current,
      requestedAlias: seed,
      binding,
      fallbackUsed: current !== seed,
      notes,
    };
  }

  throw new ModelResolveError(
    'RESOLVE_EXHAUSTED',
    `Could not resolve model alias "${seed}"; all fallbacks exhausted.`,
  );
}

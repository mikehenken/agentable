/**

 * Trusted asset resolution for insert_image.

 *

 * Model output never supplies URLs or markup. Hosts bind resolvers that map

 * asset ids and generation prompts to framework-controlled image assets.

 */

import {

  AUTHORING_MARKUP_REJECTED_CODE,
  type AuthoringResolvedImageAsset,

} from '../engine/authoringToolkitTypes';

import { validateAssetId } from '../security/codeExecutionBoundary';



export type AuthoringAssetResolver = (

  assetId: string) => AuthoringResolvedImageAsset | Promise<AuthoringResolvedImageAsset>;



export type AuthoringImageGenerator = (

  prompt: string) => AuthoringResolvedImageAsset | Promise<AuthoringResolvedImageAsset>;



let boundAssetResolver: AuthoringAssetResolver | null = null;

let boundImageGenerator: AuthoringImageGenerator | null = null;



export { isUrlLike } from '../security/codeExecutionBoundary';



export function bindAuthoringAssetResolver(resolver: AuthoringAssetResolver): () => void {

  boundAssetResolver = resolver;

  return () => {

    if (boundAssetResolver === resolver) {

      boundAssetResolver = null;

    }

  };

}



export function bindAuthoringImageGenerator(generator: AuthoringImageGenerator): () => void {

  boundImageGenerator = generator;

  return () => {

    if (boundImageGenerator === generator) {

      boundImageGenerator = null;

    }

  };

}



export function resetAuthoringAssetBridgeForTests(): void {

  boundAssetResolver = null;

  boundImageGenerator = null;

}



/** Reject model-supplied markup, URLs, and ambiguous image fields (G4). */

export function rejectUntrustedImageFields(args: Record<string, unknown>): string | undefined {

  const forbidden = ['url', 'src', 'html', 'markup', 'href', 'imageUrl'] as const;

  for (const key of forbidden) {

    if (key in args && args[key] !== undefined) {

      return `${AUTHORING_MARKUP_REJECTED_CODE}: "${key}" is not accepted; use assetId or generatePrompt only`;

    }

  }

  return undefined;

}



export async function resolveAuthoringImageAsset(

  request: { assetId?: string; generatePrompt?: string }): Promise<AuthoringResolvedImageAsset> {

  const hasAssetId = typeof request.assetId === 'string' && request.assetId.length > 0;

  const hasPrompt =

    typeof request.generatePrompt === 'string' && request.generatePrompt.length > 0;



  if (hasAssetId && hasPrompt) {

    throw new Error('pass either assetId or generatePrompt, not both');

  }

  if (!hasAssetId && !hasPrompt) {

    throw new Error('assetId or generatePrompt is required');

  }



  if (hasAssetId) {

    const assetId = request.assetId!;

    const validated = validateAssetId(assetId);

    if (!validated.ok) {

      throw new Error(`${AUTHORING_MARKUP_REJECTED_CODE}: ${validated.reason}`);

    }

    if (boundAssetResolver === null) {

      throw new Error('asset resolver is not configured for insert_image');

    }

    return boundAssetResolver(validated.assetId);

  }



  const prompt = request.generatePrompt!;

  if (boundImageGenerator === null) {

    throw new Error('image generation is not configured for insert_image');

  }

  return boundImageGenerator(prompt);

}



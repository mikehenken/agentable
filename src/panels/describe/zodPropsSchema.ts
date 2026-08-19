/**
 * Derives a JSON-schema-style props description from catalog Zod schemas
 * for agent introspection ( describe_panel).
 */
import { z } from 'zod';
import type { PropsSchemaDescription } from './types';

function describeZodType(schema: z.ZodType): PropsSchemaDescription {
  if (schema instanceof z.ZodOptional) {
    const inner = describeZodType(schema.unwrap as z.ZodType);
    return {...inner, optional: true };
  }

  if (schema instanceof z.ZodNullable) {
    const inner = describeZodType(schema.unwrap as z.ZodType);
    return {...inner, nullable: true };
  }

  if (schema instanceof z.ZodString) {
    return { type: 'string' };
  }

  if (schema instanceof z.ZodNumber) {
    return { type: 'number' };
  }

  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }

  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: describeZodType(schema.element as z.ZodType),
    };
  }

  if (schema instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: schema.options as readonly string[],
    };
  }

  if (schema instanceof z.ZodRecord) {
    return {
      type: 'object',
      additionalProperties: true,
    };
  }

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodType>;
    const properties: Record<string, PropsSchemaDescription> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = describeZodType(value);
      if (!(value instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    const description: PropsSchemaDescription = {
      type: 'object',
      properties,
    };
    if ('isStrict' in schema && typeof schema.isStrict === 'function' && schema.isStrict) {
      description.additionalProperties = false;
    }
    if (required.length > 0) {
      description.required = required;
    }
    return description;
  }

  return { type: 'unknown' };
}

export function describeCatalogPropsSchema(schema: z.ZodType): PropsSchemaDescription {
  return describeZodType(schema);
}

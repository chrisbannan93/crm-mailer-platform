import { defineField } from 'twenty-sdk';

export const fieldForObject = <T extends Record<string, unknown>>(
  objectUniversalIdentifier: string,
  config: T,
): T => {
  const result = defineField({
    objectUniversalIdentifier,
    ...config,
  });

  if (!result.success) {
    throw new Error(result.errors.join('; '));
  }

  return result.config as T;
};

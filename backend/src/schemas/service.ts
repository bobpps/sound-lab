import { Type, type Static } from '@sinclair/typebox';

export const GenerateDialogBody = Type.Object({
  providerId: Type.String(),
  model: Type.String(),
  language: Type.String(),
  prompt: Type.String({ minLength: 1 }),
  messageCount: Type.Integer({ minimum: 2, maximum: 50 }),
}, { additionalProperties: false });
export type GenerateDialogBody = Static<typeof GenerateDialogBody>;

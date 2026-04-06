import { Type, type Static } from '@sinclair/typebox';

export const GenerateDialogBody = Type.Object({
  providerId: Type.String(),
  model: Type.String(),
  language: Type.String(),
  prompt: Type.String({ minLength: 1 }),
  messageCount: Type.Integer({ minimum: 2, maximum: 50 }),
}, { additionalProperties: false });
export type GenerateDialogBody = Static<typeof GenerateDialogBody>;

export const EditDialogBody = Type.Object({
  dialogId: Type.Integer(),
  providerId: Type.String(),
  model: Type.String(),
  instructions: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
export type EditDialogBody = Static<typeof EditDialogBody>;

export const AutoAnnotateBody = Type.Object({
  dialogId: Type.Integer(),
  providerId: Type.String(),
  model: Type.String(),
  annotationPromptId: Type.Integer(),
  ttsProviderId: Type.String(),
  title: Type.String(),
}, { additionalProperties: false });
export type AutoAnnotateBody = Static<typeof AutoAnnotateBody>;

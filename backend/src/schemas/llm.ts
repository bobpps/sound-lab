import { Type, type Static } from '@sinclair/typebox';

export const LLMProviderIdParam = Type.Object({
  providerId: Type.String(),
});
export type LLMProviderIdParam = Static<typeof LLMProviderIdParam>;

export const LLMMessage = Type.Object({
  role: Type.Union([
    Type.Literal('system'),
    Type.Literal('user'),
    Type.Literal('assistant'),
  ]),
  content: Type.String(),
});
export type LLMMessage = Static<typeof LLMMessage>;

export const CompleteBody = Type.Object({
  messages: Type.Array(LLMMessage, { minItems: 1 }),
  model: Type.String(),
}, { additionalProperties: false });
export type CompleteBody = Static<typeof CompleteBody>;

export const CompleteResponse = Type.Object({
  text: Type.String(),
});
export type CompleteResponse = Static<typeof CompleteResponse>;

export const ModelsResponse = Type.Array(Type.String());
export type ModelsResponse = Static<typeof ModelsResponse>;

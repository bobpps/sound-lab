import { Type, type Static } from '@sinclair/typebox';

export const ProviderIdParam = Type.Object({
  providerId: Type.String(),
});
export type ProviderIdParam = Static<typeof ProviderIdParam>;

export const Voice = Type.Object({
  id: Type.String(),
  name: Type.String(),
  language: Type.String(),
  gender: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  previewUrl: Type.Optional(Type.String()),
  providerMeta: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type Voice = Static<typeof Voice>;

export const SynthesizeBody = Type.Object({
  voiceId: Type.String(),
  text: Type.String({ minLength: 1 }),
  speed: Type.Optional(Type.Number()),
  temperature: Type.Optional(Type.Number()),
  format: Type.Optional(Type.String()),
  sampleRate: Type.Optional(Type.Number()),
  model: Type.Optional(Type.String()),
}, { additionalProperties: false });
export type SynthesizeBody = Static<typeof SynthesizeBody>;

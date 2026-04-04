import { Type, type Static } from '@sinclair/typebox';

export const ProviderType = Type.Union([
  Type.Literal('tts'),
  Type.Literal('llm'),
  Type.Literal('realtime'),
]);
export type ProviderType = Static<typeof ProviderType>;

export const Provider = Type.Object({
  id: Type.String(),
  name: Type.String(),
  type: ProviderType,
  enabled: Type.Boolean(),
  created_at: Type.String(),
});
export type Provider = Static<typeof Provider>;

export const CreateProvider = Type.Object({
  id: Type.String(),
  name: Type.String(),
  type: ProviderType,
});
export type CreateProvider = Static<typeof CreateProvider>;

export const UpdateProvider = Type.Object({
  name: Type.Optional(Type.String()),
  type: Type.Optional(ProviderType),
  enabled: Type.Optional(Type.Boolean()),
});
export type UpdateProvider = Static<typeof UpdateProvider>;

export const SetKeyBody = Type.Object({
  key: Type.String(),
});
export type SetKeyBody = Static<typeof SetKeyBody>;

export const ProviderTypeQuery = Type.Object({
  type: Type.Optional(ProviderType),
});
export type ProviderTypeQuery = Static<typeof ProviderTypeQuery>;

import { Type, type Static } from '@sinclair/typebox';

export const AnnotationPrompt = Type.Object({
  id: Type.Integer(),
  title: Type.String(),
  provider_id: Type.String(),
  language: Type.String(),
  prompt: Type.String(),
  created_by: Type.Union([Type.String(), Type.Null()]),
  created_at: Type.String(),
});
export type AnnotationPrompt = Static<typeof AnnotationPrompt>;

export const CreateAnnotationPrompt = Type.Object({
  title: Type.String(),
  provider_id: Type.String(),
  language: Type.String(),
  prompt: Type.String(),
}, { additionalProperties: false });
export type CreateAnnotationPrompt = Static<typeof CreateAnnotationPrompt>;

export const UpdateAnnotationPrompt = Type.Object({
  title: Type.Optional(Type.String()),
  provider_id: Type.Optional(Type.String()),
  language: Type.Optional(Type.String()),
  prompt: Type.Optional(Type.String()),
}, { additionalProperties: false });
export type UpdateAnnotationPrompt = Static<typeof UpdateAnnotationPrompt>;

export const AgentPrompt = Type.Object({
  id: Type.Integer(),
  title: Type.String(),
  provider_id: Type.String(),
  language: Type.String(),
  prompt: Type.String(),
  created_by: Type.Union([Type.String(), Type.Null()]),
  created_at: Type.String(),
});
export type AgentPrompt = Static<typeof AgentPrompt>;

export const CreateAgentPrompt = Type.Object({
  title: Type.String(),
  provider_id: Type.String(),
  language: Type.String(),
  prompt: Type.String(),
}, { additionalProperties: false });
export type CreateAgentPrompt = Static<typeof CreateAgentPrompt>;

export const UpdateAgentPrompt = Type.Object({
  title: Type.Optional(Type.String()),
  provider_id: Type.Optional(Type.String()),
  language: Type.Optional(Type.String()),
  prompt: Type.Optional(Type.String()),
}, { additionalProperties: false });
export type UpdateAgentPrompt = Static<typeof UpdateAgentPrompt>;

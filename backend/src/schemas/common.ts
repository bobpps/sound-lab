import { Type, type Static } from '@sinclair/typebox';

export const IdParam = Type.Object({
  id: Type.Integer(),
});
export type IdParam = Static<typeof IdParam>;

export const StringIdParam = Type.Object({
  id: Type.String(),
});
export type StringIdParam = Static<typeof StringIdParam>;

export const ErrorResponse = Type.Object({
  statusCode: Type.Integer(),
  error: Type.String(),
  message: Type.String(),
});
export type ErrorResponse = Static<typeof ErrorResponse>;

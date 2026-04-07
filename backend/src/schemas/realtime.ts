import { Type, type Static } from '@sinclair/typebox';

export const RealtimeProviderIdParam = Type.Object({
  providerId: Type.String(),
});
export type RealtimeProviderIdParam = Static<typeof RealtimeProviderIdParam>;

export const RealtimeModelsResponse = Type.Array(Type.String());
export type RealtimeModelsResponse = Static<typeof RealtimeModelsResponse>;

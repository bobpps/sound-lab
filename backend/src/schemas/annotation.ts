import { Type, type Static } from '@sinclair/typebox';

export const AnnotatedDialog = Type.Object({
  id: Type.Number(),
  dialog_id: Type.Number(),
  provider_id: Type.String(),
  title: Type.String(),
  created_by: Type.Union([Type.String(), Type.Null()]),
  created_at: Type.String(),
});
export type AnnotatedDialog = Static<typeof AnnotatedDialog>;

export const AnnotatedMessage = Type.Object({
  id: Type.Number(),
  annotated_dialog_id: Type.Number(),
  dialog_message_id: Type.Number(),
  text: Type.String(),
});
export type AnnotatedMessage = Static<typeof AnnotatedMessage>;

export const AnnotatedDialogWithMessages = Type.Intersect([
  AnnotatedDialog,
  Type.Object({
    messages: Type.Array(AnnotatedMessage),
  }),
]);
export type AnnotatedDialogWithMessages = Static<typeof AnnotatedDialogWithMessages>;

export const CreateAnnotatedDialog = Type.Object({
  dialog_id: Type.Number(),
  provider_id: Type.String(),
  title: Type.String(),
});
export type CreateAnnotatedDialog = Static<typeof CreateAnnotatedDialog>;

export const CreateAnnotatedMessage = Type.Object({
  dialog_message_id: Type.Number(),
  text: Type.String(),
});
export type CreateAnnotatedMessage = Static<typeof CreateAnnotatedMessage>;

export const UpdateAnnotatedMessage = Type.Object({
  text: Type.String(),
});
export type UpdateAnnotatedMessage = Static<typeof UpdateAnnotatedMessage>;

export const AnnotationIdParam = Type.Object({
  id: Type.Number(),
});
export type AnnotationIdParam = Static<typeof AnnotationIdParam>;

export const AnnotationMessageIdParam = Type.Object({
  id: Type.Number(),
  messageId: Type.Number(),
});
export type AnnotationMessageIdParam = Static<typeof AnnotationMessageIdParam>;

export const DialogAnnotationsParam = Type.Object({
  dialogId: Type.Number(),
});
export type DialogAnnotationsParam = Static<typeof DialogAnnotationsParam>;

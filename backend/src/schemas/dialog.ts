import { Type, type Static } from '@sinclair/typebox';

export const DialogMessage = Type.Object({
  id: Type.Integer(),
  dialog_id: Type.Integer(),
  order: Type.Integer(),
  character: Type.Union([Type.Literal(1), Type.Literal(2)]),
  text: Type.String(),
});
export type DialogMessage = Static<typeof DialogMessage>;

export const Dialog = Type.Object({
  id: Type.Integer(),
  title: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  language: Type.String(),
  created_by: Type.Union([Type.String(), Type.Null()]),
  created_at: Type.String(),
});
export type Dialog = Static<typeof Dialog>;

export const DialogWithMessages = Type.Intersect([
  Dialog,
  Type.Object({
    messages: Type.Array(DialogMessage),
  }),
]);
export type DialogWithMessages = Static<typeof DialogWithMessages>;

export const CreateDialog = Type.Object({
  title: Type.String(),
  description: Type.Optional(Type.String()),
  language: Type.String(),
});
export type CreateDialog = Static<typeof CreateDialog>;

export const UpdateDialog = Type.Object({
  title: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  language: Type.Optional(Type.String()),
});
export type UpdateDialog = Static<typeof UpdateDialog>;

export const CreateDialogMessage = Type.Object({
  order: Type.Integer(),
  character: Type.Union([Type.Literal(1), Type.Literal(2)]),
  text: Type.String(),
});
export type CreateDialogMessage = Static<typeof CreateDialogMessage>;

export const UpdateDialogMessage = Type.Object({
  character: Type.Optional(Type.Union([Type.Literal(1), Type.Literal(2)])),
  text: Type.Optional(Type.String()),
});
export type UpdateDialogMessage = Static<typeof UpdateDialogMessage>;

export const DialogIdParam = Type.Object({
  dialogId: Type.Integer(),
});
export type DialogIdParam = Static<typeof DialogIdParam>;

export const MessageIdParam = Type.Object({
  dialogId: Type.Integer(),
  messageId: Type.Integer(),
});
export type MessageIdParam = Static<typeof MessageIdParam>;

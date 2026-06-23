import { z } from 'zod';

export const InboundMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('auth'),
    token: z.string(),
  }),
  z.object({
    type: z.literal('command'),
    payload: z.string(),
  }),
  z.object({
    type: z.literal('resize'),
    cols: z.number(),
    rows: z.number(),
  }),
  z.object({
    type: z.literal('signal'),
    signal: z.enum(['SIGINT', 'SIGTERM', 'SIGKILL']),
  }),
  z.object({
    type: z.literal('confirm'),
    phrase: z.string(),
  }),
]);

export type InboundMessage = z.infer<typeof InboundMessageSchema>;

export const OutboundMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('auth_ok'),
    user: z.object({
      userId: z.string(),
      tenantId: z.string(),
      role: z.string(),
    }),
  }),
  z.object({
    type: z.literal('auth_fail'),
    reason: z.string(),
  }),
  z.object({
    type: z.literal('output'),
    data: z.string(),
  }),
  z.object({
    type: z.literal('exit'),
    code: z.number(),
  }),
  z.object({
    type: z.literal('error'),
    message: z.string(),
  }),
  z.object({
    type: z.literal('policy_violation'),
    message: z.string(),
  }),
  z.object({
    type: z.literal('confirm_required'),
    command: z.string(),
    phrase: z.string(),
  }),
]);

export type OutboundMessage = z.infer<typeof OutboundMessageSchema>;

export function parseInboundMessage(data: string): InboundMessage {
  return InboundMessageSchema.parse(JSON.parse(data));
}

export function formatOutboundMessage(msg: OutboundMessage): string {
  return JSON.stringify(msg);
}

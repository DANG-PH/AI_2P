export type Language = 'vi' | 'en';

export type SttPartialEvent = {
  type: 'stt.partial';
  text: string;
  speaker: Language;
  clientId: string;
  utteranceId: string;
};

export type SttFinalEvent = {
  type: 'stt.final';
  text: string;
  speaker: Language;
  clientId: string;
  utteranceId: string;
};

export type TranslateTokenEvent = {
  type: 'translate.token';
  token: string;
  reset?: boolean;
  clientId: string;
  utteranceId: string;
};

export type TranslateDoneEvent = {
  type: 'translate.done';
  fullText: string;
  sourceText: string;
  speaker: Language;
  clientId: string;
  utteranceId: string;
};

export type ErrorEvent = {
  type: 'error';
  code: string;
  message: string;
  clientId?: string;
};

export type AiEvent =
  | SttPartialEvent
  | SttFinalEvent
  | TranslateTokenEvent
  | TranslateDoneEvent
  | ErrorEvent;

export type AiWorkerEvent =
  | Omit<SttPartialEvent, 'clientId'>
  | Omit<SttFinalEvent, 'clientId'>
  | Omit<TranslateTokenEvent, 'clientId'>
  | Omit<TranslateDoneEvent, 'clientId'>
  | Omit<ErrorEvent, 'clientId'>;

type WithPipelineContext<T> = T extends unknown
  ? T & { sessionId: string; clientId: string }
  : never;

/**
 * Internal NestJS event. The AI worker does not decide participant identity;
 * the bridge attaches it from the WebSocket pipeline that produced the event.
 */
export type AiEventPayload = WithPipelineContext<AiWorkerEvent>;

import type { ExternalMessage } from "../_shared/integrations/types.ts";

const MAX_MESSAGES_PER_MODEL_CALL = 30;
const MAX_SENDER_CHARS = 120;
const MAX_SUBJECT_CHARS = 160;
const MAX_SNIPPET_CHARS = 600;
const MAX_PROMPT_CHARS = 12_000;

function truncate(value: string, maxChars: number): string {
  return value.length > maxChars ? `${value.slice(0, maxChars)}...` : value;
}

export function prepareMessagesForTaskExtraction(messages: ExternalMessage[]): {
  selectedCount: number;
  text: string;
} {
  const selected = messages.slice(0, MAX_MESSAGES_PER_MODEL_CALL);
  const text = selected
    .map((message, index) => {
      const sender = truncate(message.sender ?? "unknown", MAX_SENDER_CHARS);
      const subject = message.subject ? ` | Subject: ${truncate(message.subject, MAX_SUBJECT_CHARS)}` : "";
      const snippet = truncate(message.snippet, MAX_SNIPPET_CHARS);
      return `[${index + 1}] From: ${sender}${subject}\n${snippet}`;
    })
    .join("\n\n");

  return {
    selectedCount: selected.length,
    text: truncate(text, MAX_PROMPT_CHARS),
  };
}

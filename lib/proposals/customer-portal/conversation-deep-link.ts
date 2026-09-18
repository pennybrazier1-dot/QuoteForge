export const CONVERSATION_VIEW_PARAM = "view";
export const CONVERSATION_VIEW_VALUE = "conversation";
export const CONVERSATION_HASH_ID = "proposal-conversation";
export const CONVERSATION_LATEST_ID = "proposal-conversation-latest";

export function isConversationDeepLink(
  view: string | null | undefined
): boolean {
  return view?.trim().toLowerCase() === CONVERSATION_VIEW_VALUE;
}

/** Adds ?view=conversation#proposal-conversation without creating a new token. */
export function appendConversationDeepLink(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return `#${CONVERSATION_HASH_ID}`;
  }

  const [withoutHash] = trimmed.split("#");
  const alreadyHasView = /[?&]view=conversation(?:&|$)/i.test(withoutHash);
  if (alreadyHasView) {
    return `${withoutHash}#${CONVERSATION_HASH_ID}`;
  }

  const joiner = withoutHash.includes("?") ? "&" : "?";
  return `${withoutHash}${joiner}${CONVERSATION_VIEW_PARAM}=${CONVERSATION_VIEW_VALUE}#${CONVERSATION_HASH_ID}`;
}

/** The marker that stands in for Jordan's support text (issue #45). Remove it when the text is written. */
export const SUPPORT_PLACEHOLDER = '[[SUPPORT-PLACEHOLDER]]';
export const SUPPORT_PATH = '/support';
export const SUPPORT_LINK_TEXT = 'If you need more support';
export const SUPPORT_PENDING_TEXT = 'This page is being written';

export function isSupportPlaceholder(text: string): boolean {
  return text.includes(SUPPORT_PLACEHOLDER);
}

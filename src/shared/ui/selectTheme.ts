import type { UiTheme } from './theme.js';

export function selectColors(theme: UiTheme) {
  return {
    backgroundColor: theme.transparent,
    focusedBackgroundColor: theme.transparent,
    selectedBackgroundColor: theme.transparent,
    selectedTextColor: theme.brand,
    selectedDescriptionColor: theme.muted,
  };
}

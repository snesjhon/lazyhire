/** @jsxImportSource @opentui/react */
import type { UiTheme } from '../ui/theme.js';

const HERO_LOGO = [
  '██╗      █████╗ ███████╗██╗   ██╗██╗  ██╗██╗██████╗ ███████╗',
  '██║     ██╔══██╗╚══███╔╝╚██╗ ██╔╝██║  ██║██║██╔══██╗██╔════╝',
  '██║     ███████║  ███╔╝  ╚████╔╝ ███████║██║██████╔╝█████╗  ',
  '██║     ██╔══██║ ███╔╝    ╚██╔╝  ██╔══██║██║██╔══██╗██╔══╝  ',
  '███████╗██║  ██║███████╗   ██║   ██║  ██║██║██║  ██║███████╗',
  '╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚══════╝',
] as const;

function centerLine(line: string, width: number): string {
  const padding = Math.max(0, Math.floor((width - line.length) / 2));
  return `${' '.repeat(padding)}${line}`;
}

interface Props {
  theme: UiTheme;
  variant?: 'hero' | 'compact';
  width?: number;
}

export default function BrandLogo({
  theme,
  variant = 'compact',
  width = 0,
}: Props) {
  if (variant === 'compact') {
    return <text fg={theme.brand} content="lazyhire" />;
  }

  const contentWidth = Math.max(0, width);
  const logoWidth = Math.max(...HERO_LOGO.map((line) => line.length));
  const centered = HERO_LOGO.map((line) =>
    centerLine(line, Math.max(contentWidth, logoWidth)),
  ).join('\n');

  return <text fg={theme.info} content={centered} />;
}

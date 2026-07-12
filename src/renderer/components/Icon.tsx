interface IconProps {
  name: keyof typeof ICONS;
  size?: number;
  style?: React.CSSProperties;
  className?: string;
}

const ICONS = {
  jobs: "M3.5 7.5h17v12a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-12zM8 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 16 5.5v2M3.5 12h17",
  docs: "M6 3.5h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1zM14 3.5v4h4M8.5 13h7M8.5 16.5h7",
  answers: "M4 5.5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9l-4 3.5V16.5H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z",
  check: "M5 12.5l4.5 4.5L19 7",
  minus: "M6 12h12",
  download: "M12 3.5v11m0 0l-4-4m4 4l4-4M4.5 19.5h15",
  open: "M14 4.5h5.5V10M19 5l-8 8M9 5H5.5A1.5 1.5 0 0 0 4 6.5v12A1.5 1.5 0 0 0 5.5 20h12a1.5 1.5 0 0 0 1.5-1.5V15",
  plus: "M12 5v14M5 12h14",
  sun: "M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM12 1.5v2M12 20.5v2M3.5 12h-2M22.5 12h-2M5.6 5.6L4.2 4.2M19.8 19.8l-1.4-1.4M18.4 5.6l1.4-1.4M4.2 19.8l1.4-1.4",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z",
  arrow: "M5 12h14m0 0l-6-6m6 6l-6 6",
  clock: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  scan: "M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-4 3.6-7 8-7s8 3 8 7",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  trash: "M4 7h16M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7m2 0v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7h12zM10 11v6M14 11v6",
  sidebarToggle: null as unknown as string,
} as const;

const MULTI_PATH_ICONS: Record<string, string[]> = {
  sidebarToggle: [
    "M4.5 5.5h15a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16V7a1.5 1.5 0 0 1 1.5-1.5z",
    "M9.5 5.5v13",
  ],
};

export default function Icon({ name, size = 16, style, className }: IconProps) {
  const paths = MULTI_PATH_ICONS[name as string];
  const singlePath = ICONS[name] as string | null;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
    >
      {paths
        ? paths.map((d, i) => <path key={i} d={d} />)
        : singlePath
          ? <path d={singlePath} />
          : null}
    </svg>
  );
}

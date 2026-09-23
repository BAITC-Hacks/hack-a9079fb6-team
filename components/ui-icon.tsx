const paths: Record<string, string> = {
  globe: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM2 12h20M12 2c6 5 6 15 0 20-6-5-6-15 0-20Z",
  calendar: "M4 5h16v16H4ZM8 2v6m8-6v6M4 11h16",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  back: "M20 12H4m6-6-6 6 6 6",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M6 18 18 6",
  chat: "M21 11a9 9 0 0 1-9 9H4l-3 2 1-7a9 9 0 1 1 19-4ZM7 10h10M7 14h6",
  pin: "M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0ZM14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  plane: "m22 2-7 20-4-9-9-4L22 2Zm-11 11L22 2",
  spark: "m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z",
  heart: "M20 4c-3-3-6-1-8 1-2-2-5-4-8-1-6 6 8 16 8 16S26 10 20 4Z",
  people:
    "M12 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0M2 21v-3a7 7 0 0 1 14 0v3m0-17a3 3 0 0 1 0 6m3 4a7 7 0 0 1 3 6",
  mic: "M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0ZM5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8",
  camera: "M3 7h4l2-3h6l2 3h4v13H3ZM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  venue: "m3 9 9-6 9 6M3 21h18M5 10v8m7-8v8m7-8v8M2 9h20",
  flower:
    "M12 12c-11 1-9-9-4-7 0-7 9-5 7 0 7-2 10 7 2 8 6 5-2 10-5 4-4 7-11 0-5-4m5 4v6",
};
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.spark} />
    </svg>
  );
}

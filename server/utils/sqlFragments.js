// CONVERT_TZ wrapper for AUTO timestamps (stored UTC) -> Colombia local time.
export const tzColombia = (column) =>
    `CONVERT_TZ(${column}, '+00:00', '-05:00')`;

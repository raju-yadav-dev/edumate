export function formatBytes(value) {
    const size = Number(value || 0);

    if (!size) {
        return "—";
    }

    if (size >= 1024 * 1024 * 1024) {
        return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }

    if (size >= 1024 * 1024) {
        return `${Math.round(size / (1024 * 1024))} MB`;
    }

    if (size >= 1024) {
        return `${Math.round(size / 1024)} KB`;
    }

    return `${size} B`;
}

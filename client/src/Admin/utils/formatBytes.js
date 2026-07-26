export function formatBytes(value) {
    if (value === null || value === undefined || isNaN(Number(value))) {
        return "—";
    }

    const size = Number(value);

    if (size === 0) {
        return "0 B";
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

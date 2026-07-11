const LOCAL_API_ROOT = "http://localhost:5000/api/v1";

function isLocalhost(hostname) {
	return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function getApiRootUrl() {
	const configuredApiRoot = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;

	if (configuredApiRoot) {
		return configuredApiRoot.replace(/\/$/, "");
	}

	if (typeof window === "undefined") {
		return LOCAL_API_ROOT;
	}

	if (isLocalhost(window.location.hostname)) {
		return LOCAL_API_ROOT;
	}

	return `${window.location.origin}/api/v1`;
}
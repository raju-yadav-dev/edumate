const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/auth";

async function request(path, options = {}) {
	const response = await fetch(`${API_BASE_URL}${path}`, {
		headers: {
			"Content-Type": "application/json",
			...(options.headers || {})
		},
		...options
	});

	const payload = await response.json().catch(() => ({}));

	if (!response.ok) {
		throw new Error(payload.message || "Request failed.");
	}

	return payload;
}

export async function registerUser(data) {
	return request("/register", {
		method: "POST",
		body: JSON.stringify(data)
	});
}

export async function loginUser(data) {
	return request("/login", {
		method: "POST",
		body: JSON.stringify(data)
	});
}

export async function forgotPassword(data) {
	return request("/forgot-password", {
		method: "POST",
		body: JSON.stringify(data)
	});
}

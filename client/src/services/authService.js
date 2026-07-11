import { getApiRootUrl } from "./apiConfig";

const API_ROOT = getApiRootUrl();
const API_BASE_URL = import.meta.env.VITE_AUTH_API_URL || import.meta.env.VITE_API_URL || `${API_ROOT}/auth`;
const USER_API_BASE_URL = import.meta.env.VITE_USER_API_URL || `${API_ROOT}/users`;

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
		const validationDetails = Array.isArray(payload.errors) ? ` ${payload.errors.join(" ")}` : "";
		throw new Error(`${payload.message || "Request failed."}${validationDetails}`);
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

export async function updateProfileAvatar(userId, file) {
	const formData = new FormData();
	formData.append("avatar", file);
	const token = localStorage.getItem("edumate-access-token");

	const response = await fetch(`${USER_API_BASE_URL}/${userId}/avatar`, {
		method: "PUT",
		headers: token ? {
			Authorization: `Bearer ${token}`
		} : {},
		body: formData
	});

	const payload = await response.json().catch(() => ({}));

	if (!response.ok) {
		const validationDetails = Array.isArray(payload.errors) ? ` ${payload.errors.join(" ")}` : "";
		throw new Error(`${payload.message || "Unable to update profile photo."}${validationDetails}`);
	}

	return payload;
}

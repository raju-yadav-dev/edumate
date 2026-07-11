const ADMIN_USER_KEY = "edumate-admin-user";
const ADMIN_TOKEN_KEY = "edumate-admin-access-token";

function readStoredAdminUser() {
	const storedUser = localStorage.getItem(ADMIN_USER_KEY);

	if (!storedUser) {
		return null;
	}

	try {
		return JSON.parse(storedUser);
	} catch {
		return null;
	}
}

export function getAdminUser() {
	return readStoredAdminUser();
}

export function getAdminAccessToken() {
	return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function saveAdminSession(user, token) {
	if (user) {
		localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
	} else {
		localStorage.removeItem(ADMIN_USER_KEY);
	}

	if (token) {
		localStorage.setItem(ADMIN_TOKEN_KEY, token);
	} else {
		localStorage.removeItem(ADMIN_TOKEN_KEY);
	}
}

export function clearAdminSession() {
	localStorage.removeItem(ADMIN_USER_KEY);
	localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function isAdminSession(user, token) {
	return Boolean(token && user && ["admin", "super_admin"].includes(user.role));
}
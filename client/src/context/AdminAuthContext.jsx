import { createContext, useEffect, useState } from "react";

import {
	clearAdminSession,
	getAdminAccessToken,
	getAdminUser,
	isAdminSession,
	saveAdminSession
} from "../services/adminSession";

export const AdminAuthContext = createContext();

function AdminAuthProvider({ children }) {
	const [adminUser, setAdminUser] = useState(() => getAdminUser());
	const [adminAccessToken, setAdminAccessToken] = useState(() => getAdminAccessToken());

	useEffect(() => {
		saveAdminSession(adminUser, adminAccessToken);
	}, [adminUser, adminAccessToken]);

	const loginAdmin = (userData, token) => {
		setAdminUser(userData);
		setAdminAccessToken(token || null);
	};

	const logoutAdmin = () => {
		setAdminUser(null);
		setAdminAccessToken(null);
		clearAdminSession();
	};

	return (
		<AdminAuthContext.Provider
			value={{
				adminUser,
				adminAccessToken,
				loginAdmin,
				logoutAdmin,
				isAdminAuthenticated: isAdminSession(adminUser, adminAccessToken)
			}}
		>
			{children}
		</AdminAuthContext.Provider>
	);
}

export default AdminAuthProvider;
import { useEffect, useState } from "react";
import {
	clearAdminSession,
	getAdminAccessToken,
	getAdminUser,
	isAdminSession,
	saveAdminSession
} from "../services/adminSession";
import { AdminAuthContext } from "./contexts";

function AdminAuthProvider({ children }) {
	const [adminUser, setAdminUser] = useState(() => getAdminUser());
	const [adminAccessToken, setAdminAccessToken] = useState(() => getAdminAccessToken());

	useEffect(() => {
		saveAdminSession(adminUser, adminAccessToken);
	}, [adminUser, adminAccessToken]);

	const loginAdmin = (userData, token) => {
		saveAdminSession(userData, token || null);
		setAdminUser(userData);
		setAdminAccessToken(token || null);
	};

	const logoutAdmin = () => {
		clearAdminSession();
		setAdminUser(null);
		setAdminAccessToken(null);
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
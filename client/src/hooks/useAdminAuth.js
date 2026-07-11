import { useContext } from "react";

import { AdminAuthContext } from "../context/AdminAuthContext";

function useAdminAuth() {
	const context = useContext(AdminAuthContext);

	if (!context) {
		throw new Error("useAdminAuth must be used within AdminAuthProvider");
	}

	return context;
}

export default useAdminAuth;
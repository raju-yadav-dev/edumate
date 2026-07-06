import "./Navbar.css";

import { useRef, useState } from "react";

import { Link, useNavigate } from "react-router-dom";
import ThemeToggle from "../ThemeToggle/ThemeToggle";
import { Camera, LogOut, UserCircle2 } from "lucide-react";

import useAuth from "../../hooks/useAuth";
import { updateProfileAvatar } from "../../services/authService";

function Navbar() {

    const { user, isAuthenticated, logout, updateAvatar } = useAuth();
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const navigate = useNavigate();

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];

        if (!file || !user?.id) {
            return;
        }

        setUploading(true);

        try {
            const response = await updateProfileAvatar(user.id, file);

            if (response.data?.avatar) {
                updateAvatar(response.data.avatar);
            }
        } finally {
            setUploading(false);
            event.target.value = "";
        }
    };

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    const avatarInitial = user?.fullName?.charAt(0)?.toUpperCase() || "U";

    return (

        <nav className="navbar">

            <div className="logo">
                EduMate
            </div>

            <ul className="nav-links">

                <li>
                    <a href="#home">Home</a>
                </li>

                <li>
                    <a href="#features">Features</a>
                </li>

                <li>
                    <a href="#about">About</a>
                </li>

                <li>
                    <a href="#faq">FAQ</a>
                </li>

                <li>
                    <a href="#contact">Contact</a>
                </li>

            </ul>

            <div className="nav-buttons">

                <ThemeToggle />

                {isAuthenticated ? (
                    <div className="profile-actions">
                        <button className="profile-button" type="button" onClick={handleAvatarClick} disabled={uploading}>
                            {user?.avatar ? (
                                <img className="profile-avatar" src={user.avatar} alt="Profile" />
                            ) : (
                                <div className="profile-avatar profile-avatar-placeholder">
                                    <UserCircle2 size={26} />
                                    <span>{avatarInitial}</span>
                                </div>
                            )}
                            <span className="profile-upload-badge">
                                <Camera size={14} />
                            </span>
                        </button>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="profile-file-input"
                            onChange={handleFileChange}
                        />

                        <button className="logout-btn" type="button" onClick={handleLogout}>
                            <LogOut size={18} />
                        </button>
                    </div>
                ) : (
                    <Link to="/login">
                        <button className="login-btn">
                            Login
                        </button>
                    </Link>
                )}

            </div>

        </nav>

    );

}

export default Navbar;
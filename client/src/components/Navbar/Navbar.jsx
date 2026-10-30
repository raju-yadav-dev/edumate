import "./Navbar.css";

import { useEffect, useRef, useState } from "react";

import { Link, useNavigate } from "react-router-dom";
import ThemeToggle from "../ThemeToggle/ThemeToggle";
import { LogOut, User, Users, Database } from "lucide-react";

import useAuth from "../../hooks/useAuth";

function Navbar() {

    const { user, isAuthenticated, logout } = useAuth();
    const menuRef = useRef(null);
    const closeTimerRef = useRef(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const navigate = useNavigate();

    const openMenu = () => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }

        setMenuOpen(true);
    };

    const closeMenu = () => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
        }

        closeTimerRef.current = setTimeout(() => {
            setMenuOpen(false);
            closeTimerRef.current = null;
        }, 150);
    };

    useEffect(() => {
        const handlePointerDown = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                if (closeTimerRef.current) {
                    clearTimeout(closeTimerRef.current);
                    closeTimerRef.current = null;
                }

                setMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handlePointerDown);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
        };
    }, []);

    const handleProfileClick = () => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }

        setMenuOpen(false);
        navigate("/profile");
    };

    const handleLogout = () => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }

        setMenuOpen(false);
        logout();
        navigate("/login");
    };

    const avatarInitial = user?.fullName?.trim()?.charAt(0)?.toUpperCase() || "U";

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

                {isAuthenticated && (user?.role === "admin" || user?.role === "super_admin") && (
                    <>
                        <li>
                            <Link to="/users">Users</Link>
                        </li>
                        <li>
                            <Link to="/studio" style={{ color: "var(--primary)" }}>
                                Studio ⚡
                            </Link>
                        </li>
                    </>
                )}

            </ul>

            <div className="nav-buttons">

                <ThemeToggle />

                {isAuthenticated ? (
                    <div
                        className="profile-actions"
                        ref={menuRef}
                        onMouseEnter={openMenu}
                        onMouseLeave={closeMenu}
                        onFocus={openMenu}
                        onBlur={(event) => {
                            if (menuRef.current && !menuRef.current.contains(event.relatedTarget)) {
                                if (closeTimerRef.current) {
                                    clearTimeout(closeTimerRef.current);
                                    closeTimerRef.current = null;
                                }

                                setMenuOpen(false);
                            }
                        }}
                    >
                        <Link
                            className="profile-button"
                            to="/profile"
                            aria-label="Open profile page"
                            onClick={() => setMenuOpen(false)}
                        >
                            {user?.avatar ? (
                                <img className="profile-avatar" src={user.avatar} alt="Profile" />
                            ) : (
                                <div className="profile-avatar profile-avatar-placeholder">
                                    <span>{avatarInitial}</span>
                                </div>
                            )}
                        </Link>

                        {menuOpen ? (
                            <div
                                className="profile-dropdown"
                                role="menu"
                                aria-label="Profile menu"
                                onMouseEnter={openMenu}
                                onMouseLeave={closeMenu}
                            >
                                <button className="profile-dropdown-item" type="button" onClick={handleProfileClick}>
                                    <User size={16} />
                                    <span>Profile</span>
                                </button>

                                {(user?.role === "admin" || user?.role === "super_admin") && (
                                    <>
                                        <button
                                            className="profile-dropdown-item"
                                            type="button"
                                            onClick={() => {
                                                setMenuOpen(false);
                                                navigate("/users");
                                            }}
                                        >
                                            <Users size={16} />
                                            <span>User Management</span>
                                        </button>

                                        <button
                                            className="profile-dropdown-item"
                                            type="button"
                                            onClick={() => {
                                                setMenuOpen(false);
                                                navigate("/studio");
                                            }}
                                        >
                                            <Database size={16} />
                                            <span>Knowledge Studio</span>
                                        </button>
                                    </>
                                )}

                                <button className="profile-dropdown-item" type="button" onClick={handleLogout}>
                                    <LogOut size={16} />
                                    <span>Logout</span>
                                </button>
                            </div>
                        ) : null}
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
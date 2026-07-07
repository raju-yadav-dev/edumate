import "./Profile.css";

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, LogOut, ShieldCheck, User } from "lucide-react";

import useAuth from "../../hooks/useAuth";
import { updateProfileAvatar } from "../../services/authService";

function Profile() {
    const { user, isAuthenticated, logout, updateAvatar } = useAuth();
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (!isAuthenticated) {
            navigate("/login", { replace: true });
        }
    }, [isAuthenticated, navigate]);

    const avatarInitial = user?.fullName?.trim()?.charAt(0)?.toUpperCase() || "U";

    const handleAvatarUpload = () => {
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

    return (
        <main className="profile-page">
            <section className="profile-panel">
                <div className="profile-hero">
                    {user?.avatar ? (
                        <img className="profile-page-avatar" src={user.avatar} alt="Profile" />
                    ) : (
                        <div className="profile-page-avatar profile-page-avatar-placeholder" aria-hidden="true">
                            <span>{avatarInitial}</span>
                        </div>
                    )}

                    <div className="profile-hero-copy">
                        <p className="profile-eyebrow">Your account</p>
                        <h1>{user?.fullName || "User profile"}</h1>
                        <p>
                            Manage your profile photo, review your account details, and jump back into EduMate.
                        </p>
                    </div>
                </div>

                <div className="profile-actions-row">
                    <button className="profile-primary-btn" type="button" onClick={handleAvatarUpload} disabled={uploading}>
                        <Camera size={16} />
                        <span>{uploading ? "Uploading..." : "Update photo"}</span>
                    </button>

                    <button className="profile-secondary-btn" type="button" onClick={() => navigate("/") }>
                        <User size={16} />
                        <span>Back to home</span>
                    </button>

                    <button className="profile-secondary-btn" type="button" onClick={handleLogout}>
                        <LogOut size={16} />
                        <span>Logout</span>
                    </button>
                </div>

                <div className="profile-details-grid">
                    <article className="profile-card">
                        <ShieldCheck size={18} />
                        <div>
                            <h2>Account details</h2>
                            <p><strong>Name:</strong> {user?.fullName || "Not set"}</p>
                            <p><strong>Email:</strong> {user?.email || "Not set"}</p>
                            <p><strong>Role:</strong> {user?.role || "Member"}</p>
                        </div>
                    </article>

                    <article className="profile-card profile-card-compact">
                        <p className="profile-card-label">Profile menu</p>
                        <p>Use the avatar menu in the navbar for quick access to your profile or logout.</p>
                    </article>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="profile-file-input"
                    onChange={handleFileChange}
                />
            </section>
        </main>
    );
}

export default Profile;

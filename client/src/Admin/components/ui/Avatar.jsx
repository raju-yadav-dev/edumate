function Avatar({ name = "Admin", src, size = "md" }) {
    const initial = String(name || "A").slice(0, 1).toUpperCase();

    return (
        <span className={`ui-avatar ui-avatar-${size}`}>
            {src ? <img src={src} alt={name} /> : initial}
        </span>
    );
}

export default Avatar;

import React, { useState, useEffect } from "react";
import { Save, Trash2, RotateCcw, Check } from "lucide-react";
import { recordActivityLog } from "../../../services/activityLogService";

const SETTINGS_STORAGE_KEY = "edumate_general_settings";

export default function GeneralSettingsTab({ adminTheme, onToggleTheme }) {
    // Form state
    const [platformName, setPlatformName] = useState("EduMate");
    const [language, setLanguage] = useState("English");
    const [timezone, setTimezone] = useState("(UTC+05:30) Asia/Kolkata");
    const [dateFormat, setDateFormat] = useState("DD MMM YYYY");
    const [timeFormat, setTimeFormat] = useState("12 Hour (AM/PM)");

    // Appearance State
    const [selectedTheme, setSelectedTheme] = useState(adminTheme || "dark");
    const [primaryColor, setPrimaryColor] = useState("#f59e0b");
    const [sidebarStyle, setSidebarStyle] = useState("Compact");

    // System Preferences Switches
    const [preferences, setPreferences] = useState({
        autoRefresh: true,
        welcomeTooltip: true,
        compressFiles: true,
        enableAnalytics: false,
        allowRegistrations: true,
        maintainHistory: true,
        defaultDarkMode: true
    });

    // File Upload Settings
    const [maxFileSize, setMaxFileSize] = useState("100 MB");
    const [allowedTypes, setAllowedTypes] = useState(["PDF", "TXT", "DOCX", "PPTX"]);
    const [maxFilesPerUpload, setMaxFilesPerUpload] = useState(10);

    // Email Settings
    const [smtpProvider, setSmtpProvider] = useState("SendGrid");
    const [fromEmail, setFromEmail] = useState("noreply@edumate.ai");
    const [fromName, setFromName] = useState("EduMate Admin");

    // Toast Notice State
    const [savedSection, setSavedSection] = useState("");

    // Live DOM Helpers
    const applyThemeToDOM = (themeMode) => {
        let mode = themeMode;
        if (themeMode === "system") {
            mode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        }
        document.documentElement.setAttribute("data-theme", mode);
        document.body.classList.remove("light-theme", "dark-theme");
        document.body.classList.add(`${mode}-theme`);
    };

    const applyPrimaryColorToDOM = (hex) => {
        document.documentElement.style.setProperty("--admin-gold", hex);
        document.documentElement.style.setProperty("--admin-primary", hex);
        document.documentElement.style.setProperty("--admin-accent", hex);
    };

    const applySidebarStyleToDOM = (styleMode) => {
        const sidebarEl = document.querySelector(".admin-left");
        if (sidebarEl) {
            if (styleMode === "Compact") {
                sidebarEl.classList.add("collapsed");
            } else {
                sidebarEl.classList.remove("collapsed");
            }
        }
        document.documentElement.setAttribute("data-sidebar-style", styleMode.toLowerCase());
    };

    // Load persistent settings on mount and apply DOM effects
    useEffect(() => {
        try {
            const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (stored) {
                const p = JSON.parse(stored);
                if (p.platformName) setPlatformName(p.platformName);
                if (p.language) setLanguage(p.language);
                if (p.timezone) setTimezone(p.timezone);
                if (p.dateFormat) setDateFormat(p.dateFormat);
                if (p.timeFormat) setTimeFormat(p.timeFormat);
                if (p.selectedTheme) {
                    setSelectedTheme(p.selectedTheme);
                    applyThemeToDOM(p.selectedTheme);
                }
                if (p.primaryColor) {
                    setPrimaryColor(p.primaryColor);
                    applyPrimaryColorToDOM(p.primaryColor);
                }
                if (p.sidebarStyle) {
                    setSidebarStyle(p.sidebarStyle);
                    applySidebarStyleToDOM(p.sidebarStyle);
                }
                if (p.preferences) setPreferences(p.preferences);
                if (p.maxFileSize) setMaxFileSize(p.maxFileSize);
                if (p.maxFilesPerUpload) setMaxFilesPerUpload(p.maxFilesPerUpload);
                if (p.smtpProvider) setSmtpProvider(p.smtpProvider);
                if (p.fromEmail) setFromEmail(p.fromEmail);
                if (p.fromName) setFromName(p.fromName);
            }
        } catch (e) {
            console.warn("Could not load stored settings:", e);
        }
    }, []);

    const saveSettingsToStorage = (updatedFields = {}) => {
        try {
            const currentObj = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
            const merged = {
                ...currentObj,
                platformName,
                language,
                timezone,
                dateFormat,
                timeFormat,
                selectedTheme,
                primaryColor,
                sidebarStyle,
                preferences,
                maxFileSize,
                maxFilesPerUpload,
                smtpProvider,
                fromEmail,
                fromName,
                ...updatedFields
            };
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
        } catch (e) {
            console.warn("Could not save settings:", e);
        }
    };

    const handleSave = (sectionName) => {
        saveSettingsToStorage();
        setSavedSection(sectionName);
        recordActivityLog({
            action: "Updated Settings",
            service: "Settings",
            resource: sectionName,
            details: `${sectionName} parameters updated successfully`,
            status: "Success"
        });
        setTimeout(() => setSavedSection(""), 2500);
    };

    const handleThemeChange = (themeMode) => {
        setSelectedTheme(themeMode);
        applyThemeToDOM(themeMode);
        saveSettingsToStorage({ selectedTheme: themeMode });
        if (onToggleTheme) onToggleTheme();
    };

    const handleColorChange = (hex) => {
        setPrimaryColor(hex);
        applyPrimaryColorToDOM(hex);
        saveSettingsToStorage({ primaryColor: hex });
    };

    const handleSidebarStyleChange = (styleMode) => {
        setSidebarStyle(styleMode);
        applySidebarStyleToDOM(styleMode);
        saveSettingsToStorage({ sidebarStyle: styleMode });
    };

    const togglePref = (key) => {
        setPreferences((prev) => {
            const next = { ...prev, [key]: !prev[key] };
            saveSettingsToStorage({ preferences: next });
            return next;
        });
    };

    const handleResetSystem = () => {
        setPlatformName("EduMate");
        setLanguage("English");
        setTimezone("(UTC+05:30) Asia/Kolkata");
        setDateFormat("DD MMM YYYY");
        setTimeFormat("12 Hour (AM/PM)");
        handleThemeChange("dark");
        handleColorChange("#f59e0b");
        handleSidebarStyleChange("Compact");
        setPreferences({
            autoRefresh: true,
            welcomeTooltip: true,
            compressFiles: true,
            enableAnalytics: false,
            allowRegistrations: true,
            maintainHistory: true,
            defaultDarkMode: true
        });
        setMaxFileSize("100 MB");
        setMaxFilesPerUpload(10);
        setSmtpProvider("SendGrid");
        setFromEmail("noreply@edumate.ai");
        setFromName("EduMate Admin");
        try {
            localStorage.removeItem(SETTINGS_STORAGE_KEY);
        } catch {}
        handleSave("System Reset to Default");
    };

    const colorSwatches = [
        { name: "Gold", hex: "#f59e0b" },
        { name: "Emerald", hex: "#10b981" },
        { name: "Blue", hex: "#3b82f6" },
        { name: "Purple", hex: "#a855f7" },
        { name: "Pink", hex: "#ec4899" },
        { name: "Orange", hex: "#f97316" },
        { name: "Cyan", hex: "#06b6d4" }
    ];

    return (
        <div className="settings-tab-content">
            {savedSection && (
                <div className="settings-toast-banner">
                    <Check size={16} /> {savedSection} saved successfully!
                </div>
            )}

            <div className="settings-six-grid">
                {/* 1. General Settings Card */}
                <div className="settings-card">
                    <div className="settings-card-head">
                        <div className="head-title-row">
                            <span className="card-icon">⚙️</span>
                            <h3>General Settings</h3>
                        </div>
                        <p>Manage basic platform configuration.</p>
                    </div>

                    <div className="settings-card-body">
                        <div className="form-group">
                            <label>Platform Name</label>
                            <input
                                type="text"
                                className="settings-input"
                                value={platformName}
                                onChange={(e) => setPlatformName(e.target.value)}
                            />
                        </div>

                        <div className="form-row-two">
                            <div className="form-group">
                                <label>Default Language</label>
                                <select className="settings-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
                                    <option value="English">English</option>
                                    <option value="Spanish">Spanish</option>
                                    <option value="French">French</option>
                                    <option value="Hindi">Hindi</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Timezone</label>
                                <select className="settings-select" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                                    <option value="(UTC+05:30) Asia/Kolkata">(UTC+05:30) Asia/Kolkata</option>
                                    <option value="(UTC+00:00) UTC">(UTC+00:00) UTC</option>
                                    <option value="(UTC-05:00) America/New_York">(UTC-05:00) America/New_York</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-row-two">
                            <div className="form-group">
                                <label>Date Format</label>
                                <select className="settings-select" value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
                                    <option value="DD MMM YYYY">DD MMM YYYY</option>
                                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Time Format</label>
                                <select className="settings-select" value={timeFormat} onChange={(e) => setTimeFormat(e.target.value)}>
                                    <option value="12 Hour (AM/PM)">12 Hour (AM/PM)</option>
                                    <option value="24 Hour">24 Hour</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="settings-card-foot">
                        <button type="button" className="settings-gold-btn" onClick={() => handleSave("General Settings")}>
                            <Save size={14} /> Save Changes
                        </button>
                    </div>
                </div>

                {/* 2. Appearance Card */}
                <div className="settings-card">
                    <div className="settings-card-head">
                        <div className="head-title-row">
                            <span className="card-icon">🎨</span>
                            <h3>Appearance</h3>
                        </div>
                        <p>Customize the look and feel of the admin panel.</p>
                    </div>

                    <div className="settings-card-body">
                        {/* Theme Picker */}
                        <div className="form-group">
                            <label>Theme</label>
                            <div className="theme-options-grid">
                                <button
                                    type="button"
                                    className={`theme-option-box ${selectedTheme === "dark" ? "selected" : ""}`}
                                    onClick={() => handleThemeChange("dark")}
                                >
                                    <span className="theme-icon">🌙</span>
                                    <span>Dark</span>
                                    {selectedTheme === "dark" && <Check size={12} className="theme-check" />}
                                </button>
                                <button
                                    type="button"
                                    className={`theme-option-box ${selectedTheme === "light" ? "selected" : ""}`}
                                    onClick={() => handleThemeChange("light")}
                                >
                                    <span className="theme-icon">☀️</span>
                                    <span>Light</span>
                                    {selectedTheme === "light" && <Check size={12} className="theme-check" />}
                                </button>
                                <button
                                    type="button"
                                    className={`theme-option-box ${selectedTheme === "system" ? "selected" : ""}`}
                                    onClick={() => handleThemeChange("system")}
                                >
                                    <span className="theme-icon">💻</span>
                                    <span>System</span>
                                    {selectedTheme === "system" && <Check size={12} className="theme-check" />}
                                </button>
                            </div>
                        </div>

                        {/* Primary Color Swatches */}
                        <div className="form-group">
                            <label>Primary Color</label>
                            <div className="color-swatches-row">
                                {colorSwatches.map((c) => (
                                    <button
                                        key={c.hex}
                                        type="button"
                                        className={`color-swatch-circle ${primaryColor === c.hex ? "selected" : ""}`}
                                        style={{ backgroundColor: c.hex }}
                                        onClick={() => handleColorChange(c.hex)}
                                        title={c.name}
                                    >
                                        {primaryColor === c.hex && <Check size={12} color={c.hex === "#f59e0b" ? "#0b0f17" : "#fff"} />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Sidebar Style */}
                        <div className="form-group">
                            <label>Sidebar Style</label>
                            <div className="toggle-segment-group">
                                <button
                                    type="button"
                                    className={`segment-btn ${sidebarStyle === "Compact" ? "selected" : ""}`}
                                    onClick={() => handleSidebarStyleChange("Compact")}
                                >
                                    Compact
                                </button>
                                <button
                                    type="button"
                                    className={`segment-btn ${sidebarStyle === "Full Width" ? "selected" : ""}`}
                                    onClick={() => handleSidebarStyleChange("Full Width")}
                                >
                                    Full Width
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="settings-card-foot">
                        <button type="button" className="settings-gold-btn" onClick={() => handleSave("Appearance Settings")}>
                            <Save size={14} /> Save Changes
                        </button>
                    </div>
                </div>

                {/* 3. System Preferences Card */}
                <div className="settings-card">
                    <div className="settings-card-head">
                        <div className="head-title-row">
                            <span className="card-icon">💻</span>
                            <h3>System Preferences</h3>
                        </div>
                        <p>Configure system-wide preferences.</p>
                    </div>

                    <div className="settings-card-body">
                        <div className="toggle-switches-list">
                            <div className="switch-row">
                                <span>Auto refresh data</span>
                                <button
                                    type="button"
                                    className={`switch-btn ${preferences.autoRefresh ? "active" : ""}`}
                                    onClick={() => togglePref("autoRefresh")}
                                >
                                    <span className="switch-slider"></span>
                                </button>
                            </div>

                            <div className="switch-row">
                                <span>Show welcome tooltip</span>
                                <button
                                    type="button"
                                    className={`switch-btn ${preferences.welcomeTooltip ? "active" : ""}`}
                                    onClick={() => togglePref("welcomeTooltip")}
                                >
                                    <span className="switch-slider"></span>
                                </button>
                            </div>

                            <div className="switch-row">
                                <span>Compress uploaded files</span>
                                <button
                                    type="button"
                                    className={`switch-btn ${preferences.compressFiles ? "active" : ""}`}
                                    onClick={() => togglePref("compressFiles")}
                                >
                                    <span className="switch-slider"></span>
                                </button>
                            </div>

                            <div className="switch-row">
                                <span>Enable analytics</span>
                                <button
                                    type="button"
                                    className={`switch-btn ${preferences.enableAnalytics ? "active" : ""}`}
                                    onClick={() => togglePref("enableAnalytics")}
                                >
                                    <span className="switch-slider"></span>
                                </button>
                            </div>

                            <div className="switch-row">
                                <span>Allow user registrations</span>
                                <button
                                    type="button"
                                    className={`switch-btn ${preferences.allowRegistrations ? "active" : ""}`}
                                    onClick={() => togglePref("allowRegistrations")}
                                >
                                    <span className="switch-slider"></span>
                                </button>
                            </div>

                            <div className="switch-row">
                                <span>Maintain conversation history</span>
                                <button
                                    type="button"
                                    className={`switch-btn ${preferences.maintainHistory ? "active" : ""}`}
                                    onClick={() => togglePref("maintainHistory")}
                                >
                                    <span className="switch-slider"></span>
                                </button>
                            </div>

                            <div className="switch-row">
                                <span>Enable dark mode by default</span>
                                <button
                                    type="button"
                                    className={`switch-btn ${preferences.defaultDarkMode ? "active" : ""}`}
                                    onClick={() => togglePref("defaultDarkMode")}
                                >
                                    <span className="switch-slider"></span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="settings-card-foot">
                        <button type="button" className="settings-gold-btn" onClick={() => handleSave("System Preferences")}>
                            <Save size={14} /> Save Changes
                        </button>
                    </div>
                </div>

                {/* 4. File Upload Settings Card */}
                <div className="settings-card">
                    <div className="settings-card-head">
                        <div className="head-title-row">
                            <span className="card-icon">⬆️</span>
                            <h3>File Upload Settings</h3>
                        </div>
                        <p>Configure file upload preferences and limits.</p>
                    </div>

                    <div className="settings-card-body">
                        <div className="form-group">
                            <label>Max File Size</label>
                            <select className="settings-select" value={maxFileSize} onChange={(e) => setMaxFileSize(e.target.value)}>
                                <option value="50 MB">50 MB</option>
                                <option value="100 MB">100 MB</option>
                                <option value="250 MB">250 MB</option>
                                <option value="500 MB">500 MB</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Allowed File Types</label>
                            <div className="file-tags-wrap">
                                {allowedTypes.map((type) => (
                                    <span key={type} className="file-type-chip">{type}</span>
                                ))}
                                <span className="file-type-chip extra">+2 v</span>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Max Files Per Upload</label>
                            <input
                                type="number"
                                className="settings-input"
                                value={maxFilesPerUpload}
                                onChange={(e) => setMaxFilesPerUpload(Number(e.target.value))}
                            />
                        </div>
                    </div>

                    <div className="settings-card-foot">
                        <button type="button" className="settings-gold-btn" onClick={() => handleSave("File Upload Settings")}>
                            <Save size={14} /> Save Changes
                        </button>
                    </div>
                </div>

                {/* 5. Email Settings Card */}
                <div className="settings-card">
                    <div className="settings-card-head">
                        <div className="head-title-row">
                            <span className="card-icon">✉️</span>
                            <h3>Email Settings</h3>
                        </div>
                        <p>Configure email settings for system notifications.</p>
                    </div>

                    <div className="settings-card-body">
                        <div className="form-group">
                            <label>SMTP Provider</label>
                            <select className="settings-select" value={smtpProvider} onChange={(e) => setSmtpProvider(e.target.value)}>
                                <option value="SendGrid">SendGrid</option>
                                <option value="AWS SES">AWS SES</option>
                                <option value="Mailgun">Mailgun</option>
                                <option value="SMTP Relay">SMTP Relay</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>From Email</label>
                            <input
                                type="email"
                                className="settings-input"
                                value={fromEmail}
                                onChange={(e) => setFromEmail(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label>From Name</label>
                            <input
                                type="text"
                                className="settings-input"
                                value={fromName}
                                onChange={(e) => setFromName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="settings-card-foot">
                        <button type="button" className="settings-gold-btn" onClick={() => handleSave("Email Settings")}>
                            <Save size={14} /> Save Changes
                        </button>
                    </div>
                </div>

                {/* 6. Danger Zone Card */}
                <div className="settings-card danger-zone-card">
                    <div className="settings-card-head">
                        <div className="head-title-row">
                            <span className="card-icon red-text">🛡️</span>
                            <h3 className="red-text">Danger Zone</h3>
                        </div>
                        <p>Irreversible and sensitive system actions.</p>
                    </div>

                    <div className="settings-card-body danger-actions-list">
                        <div className="danger-action-box">
                            <div className="danger-text">
                                <strong>Clear Cache</strong>
                                <p>Clear application cache and temporary files.</p>
                            </div>
                            <button
                                type="button"
                                className="danger-outline-btn"
                                onClick={() => handleSave("Application Cache Cleared")}
                            >
                                <Trash2 size={13} /> Clear Cache
                            </button>
                        </div>

                        <div className="danger-action-box">
                            <div className="danger-text">
                                <strong>Reset System</strong>
                                <p>Reset all system settings to default.</p>
                            </div>
                            <button
                                type="button"
                                className="danger-outline-btn"
                                onClick={handleResetSystem}
                            >
                                <RotateCcw size={13} /> Reset System
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

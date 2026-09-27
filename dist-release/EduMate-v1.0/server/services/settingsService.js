const Setting = require("../models/Setting");

const API_KEYS_SETTING = "provider_api_keys";

const maskSecret = (secret) => {
    if (!secret) {
        return "";
    }

    if (secret.length <= 8) {
        return "********";
    }

    return `${secret.slice(0, 4)}********${secret.slice(-4)}`;
};

const saveApiKeys = async ({ groqApiKeys = [], openRouteServiceApiKey = "", user }) => {
    const sanitizedGroqKeys = groqApiKeys
        .map((key) => String(key || "").trim())
        .filter(Boolean);

    const value = {
        groqApiKeys: sanitizedGroqKeys,
        openRouteServiceApiKey: String(openRouteServiceApiKey || "").trim()
    };

    const setting = await Setting.findOneAndUpdate(
        { key: API_KEYS_SETTING },
        {
            key: API_KEYS_SETTING,
            value,
            visibility: "private",
            updatedBy: user._id
        },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        }
    );

    return {
        groqApiKeys: setting.value.groqApiKeys.map(maskSecret),
        openRouteServiceApiKey: maskSecret(setting.value.openRouteServiceApiKey)
    };
};

const getApiKeys = async () => {
    const setting = await Setting.findOne({ key: API_KEYS_SETTING }).lean();

    return setting?.value || {
        groqApiKeys: [],
        openRouteServiceApiKey: ""
    };
};

const saveSettings = async ({ key, value, user }) => {
    const setting = await Setting.findOneAndUpdate(
        { key },
        {
            key,
            value,
            visibility: "private",
            updatedBy: user?._id || null
        },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        }
    );
    return setting.value;
};

const getSettings = async ({ key, defaultValue = {} }) => {
    const setting = await Setting.findOne({ key }).lean();
    return setting?.value || defaultValue;
};

module.exports = {
    saveApiKeys,
    getApiKeys,
    saveSettings,
    getSettings
};

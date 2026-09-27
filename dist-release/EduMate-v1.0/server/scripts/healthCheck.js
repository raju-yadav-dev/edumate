const dns = require("dns");
const colors = require("./colors");

/**
 * Checks if general internet connectivity is available by resolving a popular domain
 * @returns {Promise<boolean>}
 */
const checkInternet = () => {
    return new Promise((resolve) => {
        dns.lookup("google.com", (err) => {
            if (err) {
                console.log(colors.yellow("⚠️ Warning: Internet connection check failed. You may have connectivity issues."));
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
};

module.exports = {
    checkInternet
};

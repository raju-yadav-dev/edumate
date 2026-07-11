const dns = require("dns");

dns.setServers(["1.1.1.1", "8.8.8.8"]);

require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

const startServer = async () => {

    try {

        console.clear();

        console.log(`
============================================================
 _____    _       __  __       _
| ____|__| |_   _|  \\/  | __ _| |_ ___
|  _| / _\` | | | | |\\/| |/ _\` | __/ _ \\
| |__| (_| | |_| | |  | | (_| | ||  __/
|_____\\__,_|\\__,_|_|  |_|\\__,_|\\__\\___|

============================================================

              AI Powered Campus Assistant
`);

        await connectDB();

        app.listen(PORT, () => {

            console.log(`
+==========================================================+
|             ✓ Server Started Successfully                |
|                                                          |
| Environment : ${process.env.NODE_ENV || "development"}
| Port        : ${PORT}
| API         : http://localhost:${PORT}
| Started     : ${new Date().toLocaleString()}
|                                                          |
| Ready to accept requests                                 |
+==========================================================+

============================================================
`);

        });

    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

startServer();
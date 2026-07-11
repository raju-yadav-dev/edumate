const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);

        console.log(`
+==========================================================_+
|                   ✓ MongoDB Connected                    |
|                                                          |
| Host        : ${conn.connection.host}
| Database    : ${conn.connection.name}
| Version     : ${mongoose.version}
| Status      : ONLINE
+==========================================================_+
`);

        return conn;

    } catch (error) {

        console.log(`
+==========================================================_+
|                ✗ MongoDB Connection Failed               |
+==========================================================_+

${error.message}

`);

        process.exit(1);
    }
};

module.exports = connectDB;
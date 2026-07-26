const multer = require("multer");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {

    const allowedTypes = [

        "application/pdf",

        "application/msword",

        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

        "text/plain"

    ];

    if (allowedTypes.includes(file.mimetype)) {

        cb(null, true);

    } else {

        cb(new Error("Unsupported file type."), false);

    }

};

const upload = multer({

    storage,

    limits: {

        fileSize: 25 * 1024 * 1024 // 25 MB

    },

    fileFilter

});

module.exports = upload;
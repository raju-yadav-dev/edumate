const multer = require("multer");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {

    const allowedTypes = [

        "application/pdf",

        "application/msword",

        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

        "text/plain",
        "image/jpeg",
        "image/jpg",
        "image/pjpeg",
        "image/png",
        "image/webp"

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

        fileSize: Number(process.env.MAX_FILE_SIZE)

    },

    fileFilter

});

module.exports = upload;
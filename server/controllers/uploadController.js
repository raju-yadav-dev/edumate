const crypto = require("crypto");
const path = require("path");

const Document = require("../models/Document");
const supabase = require("../config/supabase");

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || process.env.SUPABASE_BUCKET || "documents";

const uploadDocument = async (req, res) => {
    try {

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded."
            });
        }

        const {
            category,
            institution = "",
            department = ""
        } = req.body;

        if (!category) {
            return res.status(400).json({
                success: false,
                message: "Category is required."
            });
        }

        const file = req.file;

        const extension = path.extname(file.originalname);

        const uniqueName =
            `${Date.now()}-${crypto.randomUUID()}${extension}`;

        const storagePath =
            `${category}/${uniqueName}`;

        //------------------------------------------
        // Upload to Supabase
        //------------------------------------------

        const isImage = file.mimetype && file.mimetype.startsWith("image/");
        const uploadMimeType = isImage ? "application/pdf" : file.mimetype;

        const { error } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, file.buffer, {
                contentType: uploadMimeType,
                upsert: false
            });

        if (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        //------------------------------------------
        // Save metadata
        //------------------------------------------

        const checksum = crypto
            .createHash("sha256")
            .update(file.buffer)
            .digest("hex");

        const document = await Document.create({

            originalName: file.originalname,

            storedName: uniqueName,

            category,

            institution,

            department,

            mimeType: file.mimetype,

            fileSize: file.size,

            checksum,

            storagePath,

            createdBy: req.user._id,

            updatedBy: req.user._id,

            metadata: {}

        });

        return res.status(201).json({

            success: true,

            message: "Document uploaded successfully.",

            data: document

        });

    }

    catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }
};

module.exports = {

    uploadDocument

};
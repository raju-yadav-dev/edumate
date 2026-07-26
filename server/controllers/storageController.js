const {
    getCombinedStorage
} = require("../services/storageService");

const getStorageOverview = async (req, res) => {

    try {

        const stats = await getCombinedStorage();

        return res.status(200).json({

            success: true,

            data: stats

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

    getStorageOverview

};
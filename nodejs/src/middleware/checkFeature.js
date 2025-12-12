const pool = require('../config/database');

exports.checkFeature = async(userId, featureName) => {
    try {
        const globalFeatureRes = await pool.query(
            `SELECT is_enabled, reason FROM feature_access WHERE user_id IS NULL AND feature_name = $1 LIMIT 1`,
            [featureName]
        );
        let feature = globalFeatureRes.rows[0];

        if(!feature || !feature.is_enabled) {
            return false;
        }

        if (userId) {
            const userFeatureRes = await pool.query(
                `SELECT is_enabled, reason FROM feature_access WHERE user_id = $1 AND feature_name = $2 LIMIT 1`,
                [userId, featureName]
            );
            feature = userFeatureRes.rows[0];
            if(!feature || !feature.is_enabled) {
                return false;
            }
        }

        return true;
    } catch (err) {
        console.error('Feature check error:', err);
        return false;
    }
};
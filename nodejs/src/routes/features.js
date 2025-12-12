const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const verifyJWT = require('../middleware/verifyJWTUser');

router.get('/:featureName', verifyJWT, async (req, res) => {
    const featureName = req.params.featureName;
    const userId = req.user.userId;
    console.log("Ini user id:");
    console.log(userId);

    try {
        const globalFeatureRes = await pool.query(
            `SELECT is_enabled, reason FROM feature_access WHERE user_id IS NULL AND feature_name = $1 LIMIT 1`,
            [featureName]
        );
        let feature = globalFeatureRes.rows[0];

        if(!feature || !feature.is_enabled) {
            res.json({ enabled: false, reason: feature?.reason || "Feature is disabled"});
            console.log("falsefalsefalse");
            return;
        }

        if (userId) {
            const userFeatureRes = await pool.query(
                `SELECT is_enabled, reason FROM feature_access WHERE user_id = $1 AND feature_name = $2 LIMIT 1`,
                [userId, featureName]
            );
            feature = userFeatureRes.rows[0];
            if(!feature || !feature.is_enabled) {
                res.json({ enabled: false, reason: feature?.reason || "Feature is disabled"});
                console.log("falsefalsefalse");
                return;
            }
        }
        res.json({ enabled: true, reason: null});
        console.log("truetruetrue");
    } catch (err) {
        console.error('Feature API error:', err);
        res.status(500).json({ enabled: false, reason: feature?.reason || "Feature is disabled"});
    }
});

module.exports = router;

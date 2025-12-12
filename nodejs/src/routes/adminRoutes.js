const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const verifyJWT = require("../middleware/verifyJWT");

router.post("/login", adminController.login);

router.get("/dashboard", verifyJWT, (req, res) => {
    res.json({ message: "Authenticated", admin: req.admin });
});

// // deprecated
// router.get("/:id", verifyJWT, async (req, res) => {
//     const adminId = req.params.id;

//     try {
//         const result = await adminController.getAdminById(adminId);
//         if (!result) return res.status(404).json({ message: "Admin not found" });

//         res.json({ admin: result });
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ message: "Server error" });
//     }
// });

// Ambil user dan featurenya
router.get("/users", verifyJWT, async (req, res) => {
    // pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const offset = (page-1)*limit;

    // search and filter
    const search = req.query.search || "";
    let roles = req.query.roles || "";
    roles = roles ? roles.split(",") : [];

    try {
        const globalFeatures = await adminController.getGlobalFeatures();
        const { users, total } = await adminController.getAllUsersWithFeatures(limit, offset, search, roles);
        res.json({ users, page, limit, total, globalFeatures });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/update-features", adminController.updateFeatures);

module.exports = router;
const bcrypt = require("bcrypt");
const db = require("../config/database");
const { generateToken } = require("../services/jwtService");

exports.login = async (req, res) => {
    try{
        const { email, password } = req.body;

        const result = await db.query(
            'SELECT * FROM users WHERE email = $1 LIMIT 1',
            [email]
        );

        const rows =  result.rows;

        if (rows.length === 0 || rows[0].role !== "ADMIN") {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const admin = rows[0];

        // console.log(password);
        // console.log(admin.password);
        // console.log(admin.name);
        const match = await bcrypt.compare(password, admin.password);
        if (!match) return res.status(401).json({ message: "Invalid credentials" });

        const token = generateToken(admin);

        return res.json({ 
            token,
            user: {
                id: admin.user_id,
                email: admin.email,
                role: admin.role,
                name: admin.name,
            }
         });
    } catch(err) {
        console.error(err);
        res.status(500).json({message: "Server error!!"});
    }
};

exports.getAdminById = async (user_id) => {
    const result = await db.query(
        'SELECT user_id, email, role, name, address, balance FROM users WHERE user_id = $1',
        [user_id]
    );

    if (result.rows.length === 0) return null;
    return result.rows[0];
};

// Untuk dashboard
exports.getAllUsersWithFeatures = async (limit, offset, search="", roles = []) => {
    const params = [];
    let whereClause = ["u.role <> 'ADMIN'"];

    if (search) {
        params.push(`%${search}%`, `%${search}%`);
        const nameIndex = params.length - 1;
        const emailIndex = params.length;
        whereClause.push(`(u.name ILIKE $${nameIndex} OR u.email ILIKE $${emailIndex})`);
    }
    
    if (roles.length > 0) {
        const startIndex = params.length + 1;
        const rolePlaceholders = roles
            .map((_, i) => `$${startIndex + i}`)
            .join(", ");

        params.push(...roles);
        whereClause.push(`u.role IN (${rolePlaceholders})`);
    }
    
    const whereQuery = whereClause.length ? "WHERE " + whereClause.join(" AND ") : "";

    const countResult = await db.query(`
        SELECT COUNT(*) AS total FROM users u ${whereQuery}
    `, params);
    const total = parseInt(countResult.rows[0].total, 10);

        const paginatedUsersSQL = `
        SELECT u.user_id, u.email, u.name, u.role, u.address, u.balance, u.created_at, u.updated_at
        FROM users u
        ${whereQuery}
        ORDER BY u.user_id
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
    `;

    const paginatedParams = [...params, limit, offset];
    const usersResult = await db.query(paginatedUsersSQL, paginatedParams);

    if (usersResult.rows.length === 0) {
        return { users: [], total };
    }

    const userIds = usersResult.rows.map(u => u.user_id);

    const featureParams = userIds;
    const featurePlaceholders = userIds
        .map((_, i) => `$${i + 1}`)
        .join(", ");

    const featuresResult = await db.query(
        `
        SELECT user_id, feature_name, is_enabled, reason, updated_at AS feature_updated_at
        FROM feature_access
        WHERE user_id IN (${featurePlaceholders})
        ORDER BY user_id, feature_name
        `,
        featureParams
    );

    const featuresByUser = {};
    featuresResult.rows.forEach(row => {
        if (!featuresByUser[row.user_id]) {
            featuresByUser[row.user_id] = [];
        }
        featuresByUser[row.user_id].push({
            name: row.feature_name,
            is_enabled: row.is_enabled,
            reason: row.reason,
            updated_at: row.feature_updated_at
        });
    });

    const finalUsers = usersResult.rows.map(u => ({
        ...u,
        features: featuresByUser[u.user_id] || []
    }));

    return { users: finalUsers, total };
};

exports.getGlobalFeatures = async() => {
    const result = await db.query(`
        SELECT feature_name, is_enabled, reason, updated_at
        FROM feature_access
        WHERE user_id IS NULL
        ORDER BY feature_name
    `);
    return result.rows;
};

exports.updateFeatures = async (req, res) => {
    const client = await db.connect();

    try {
        const { user_id, features } = req.body;

        if (!Array.isArray(features)) {
            return res.status(400).json({ error: "Invalid payload: features must be an array" });
        }

        await client.query("BEGIN");

        for (const f of features) {
            // sanitasisanitasi
            const safeReason = (f.reason || "").replace(/[<>]/g, "");

            await client.query(
                `SELECT 1 FROM feature_access
                WHERE (user_id = $1 OR ($1 IS NULL AND user_id IS NULL))
                AND feature_name = $2
                FOR UPDATE`,
                [user_id, f.feature_name]
            );

            await client.query(`
            UPDATE feature_access
            SET 
                is_enabled = $3,
                reason = $4,
                updated_at = NOW()
            WHERE 
                ($1::INT IS NULL AND user_id IS NULL OR user_id = $1)
                AND feature_name = $2
            `, [
                user_id,
                f.feature_name,
                f.is_enabled,
                safeReason
            ]);
        }

        await client.query("COMMIT");

        res.json({ success: true });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error(err);
        res.status(500).json({ error: "Failed to update features" });
    } finally {
        client.release();
    }
};
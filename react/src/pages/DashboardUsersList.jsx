import { useEffect, useState } from "react";

export default function UsersList() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 5;
    
    const [search, setSearch] = useState("");
    const [roles, setRoles] = useState([]);

    const [globalFeatures, setGlobalFeatures]  = useState([]);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingTarget, setEditingTarget] = useState(null); // null = global
    const [featureEdits, setFeatureEdits] = useState([]);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const [toast, setToast] = useState("");
    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(""), 2000);
    };

    // alternatif agar tidak instal svg dsb :D
    const featureIcons = {
        Checkout: "🛒",
        Auction: "🏷️",
        Chat: "💬",
    };

    const statusEmoji = {
        enabled: "🟢",
        disabled: "🔴"
    };

    const fetchUsers = async (page, search="", roles=[]) => {
        setLoading(true);
        setError("");

        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = "/login";
            return;
        }

        try {
            const roleQuery = roles.join(",");
            const res = await fetch(`http://localhost:3001/admin/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&roles=${roleQuery}`, {
                headers: { Authorization: "Bearer " + token }
            });

            if (!res.ok) throw new Error("Failed to fetch users");

            const data = await res.json();
            setUsers(data.users);
            setGlobalFeatures(data.globalFeatures || []);
            // await new Promise(r => setTimeout(r, 1000)); // proof for loading skeleton

            // Calculate total pages
            setTotalPages(Math.ceil(data.total / limit));
        } catch (err) {
            console.error(err);
            setError("Failed to fetch users");
        } finally {
            setLoading(false);
        }
    };


    // for modal and feature management
    const handleSubmitFeatureChanges = async () => {
        // validasi
        for (const f of featureEdits) {
            if (!f.is_enabled && (!f.reason || f.reason.trim() === "" || f.reason.length < 10)) {
                alert(`Reason required for disabling: ${f.feature_name}`);
                return;
            }
        }

        const token = localStorage.getItem("token");

        const payload = {
            user_id: editingTarget, // note: null -> global
            features: featureEdits
        };

        try {
            const res = await fetch("http://localhost:3001/admin/update-features", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + token
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Update failed");

            setModalOpen(false);
            showToast("Feature updated successfully!");
            fetchUsers(page, search, roles); // refresh page
        } catch (err) {
            alert("Failed to update features");
            console.error(err);
        }
    };

    // 500ms debounce for search and filter
    useEffect(()=>{
        const handler = setTimeout(() => {
            setPage(1);
            fetchUsers(1, search, roles);
        }, 500);
        return ()=> clearTimeout(handler);
    }, [search, roles]);

    useEffect(() => {
        fetchUsers(page);
    }, [page]);

    const toggleRole = (role) => {
        setRoles(prev =>
            prev.includes(role) ? prev.filter(e => e !== role) : [...prev, role]
        );
    };

    const nextPage = () => setPage(prev => Math.min(prev + 1, totalPages));
    const prevPage = () => setPage(prev => Math.max(prev - 1, 1));

    if (loading) return (
        <div className="user-grid">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="user-card skeleton-card">
                    <div className="skeleton skeleton-title"></div>
                    <div className="skeleton skeleton-line"></div>
                    <div className="skeleton skeleton-line"></div>
                    <div className="skeleton skeleton-line short"></div>
                </div>
            ))}
        </div>
    );
    if (error) return <p>{error}</p>;

    const noUsers = users.length === 0;

    return (
        <>
            {toast && (
                <div className="toast success-toast">
                    {toast}
                </div>
            )}
            {globalFeatures.length > 0 && (
                <div className="global-features">
                    <h4>Global Feature Flags - ⚠️ Proceed with Caution ⚠️</h4>
                    <ul className="feature-list">
                        {globalFeatures.map(f => {
                            const icon = featureIcons[f.feature_name] || "⚙️";
                            const stateEmoji = f.is_enabled ? statusEmoji.enabled : statusEmoji.disabled;

                            return (
                                <li key={f.feature_name}>
                                    {icon} {(f.feature_name).replace(/_enabled$/, "").replace(/\b\w/g, c => c.toUpperCase())} - {stateEmoji} 
                                    <span className={f.is_enabled ? "feature-enabled" : "feature-disabled"}>
                                        {f.is_enabled ? "Enabled" : "Disabled"}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                    <button 
                        onClick={() => {
                            setEditingTarget(null); 
                            setFeatureEdits(globalFeatures.map(f => ({
                                feature_name: f.feature_name,
                                is_enabled: f.is_enabled,
                                reason: f.reason || ""
                            })));
                            setModalOpen(true);
                        }}
                    >
                        Edit Features
                    </button>
                </div>
            )}
            <div className="filter-bar">
                <input
                    type="text"
                    placeholder="Search name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <div className="role-filters">
                    <label>
                        <input
                            type="checkbox"
                            checked={roles.includes("BUYER")}
                            onChange={() => toggleRole("BUYER")}
                        /> Buyer
                    </label>
                </div>
                <label>
                    <input
                        type="checkbox"
                        checked={roles.includes("SELLER")}
                        onChange={() => toggleRole("SELLER")}
                    /> Seller
                </label>
            </div>

            {noUsers ? (
                <p>User not found</p>
            ) : (
                <div className="user-grid">
                {users.map(user => (
                    <div
                        key={user.user_id}
                    >
                        <div className="user-card">

                            <h3>{user.name} ({user.role})</h3>
                            <p>Email: {user.email}</p>
                            <p>Address: {user.address || "-"}</p>
                            <p>Balance: ${user.balance}</p>
                            <p>Created At: {new Date(user.created_at).toLocaleString()}</p>
                            <p>Updated At: {new Date(user.updated_at).toLocaleString()}</p>

                            <h4>Features:</h4>
                            <ul className="feature-list">
                                {user.features.map(f => {
                                    const icon = featureIcons[f.name] || "⚙️";
                                    const stateEmoji = f.is_enabled ? statusEmoji.enabled : statusEmoji.disabled;

                                    return (
                                        <li key={f.name}>
                                            {icon} {(f.name).replace(/_enabled$/, "").replace(/\b\w/g, c => c.toUpperCase())} - {stateEmoji} 
                                            <span className={f.is_enabled ? "feature-enabled" : "feature-disabled"}>
                                                {f.is_enabled ? "Enabled" : "Disabled"}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                            <button
                                onClick={() => {
                                    setEditingTarget(user.user_id);
                                    setFeatureEdits(user.features.map(f => ({
                                        feature_name: f.name,
                                        is_enabled: f.is_enabled,
                                        reason: f.reason || ""
                                    })));
                                    setModalOpen(true);
                                }}
                            >
                                Edit Features
                            </button>
                        </div>
                    </div>
                ))}
                <div className="pagination">
                    <button onClick={prevPage} disabled={page === 1}>Previous</button>
                    <span>Page {page} of {totalPages}</span>
                    <button onClick={nextPage} disabled={page === totalPages}>Next</button>
                </div>

                <div className={`modal-overlay ${modalOpen ? "open" : ""}`}>
                    {modalOpen && (
                        <div className="modal-box">
                            <h3>{editingTarget === null ? "Edit Global Features" : "Edit User Features"}</h3>

                            <div>
                                {featureEdits.map((f, i) => (
                                    <div key={f.feature_name}>
                                        <label>
                                            <input 
                                                type="checkbox"
                                                checked={f.is_enabled}
                                                onChange={() => {
                                                    const updated = [...featureEdits];
                                                    updated[i].is_enabled = !updated[i].is_enabled;

                                                    // Auto-clear textbox when enabled
                                                    if (updated[i].is_enabled) updated[i].reason = "";

                                                    setFeatureEdits(updated);
                                                }}
                                            />{" "}
                                            {f.feature_name}
                                        </label>

                                        <textarea
                                            disabled={f.is_enabled}
                                            placeholder="Enter reason for disabling"
                                            value={f.reason}
                                            onChange={(e) => {
                                                const updated = [...featureEdits];
                                                
                                                // Basic sanitize (strip < >)
                                                const safeValue = e.target.value.replace(/[<>]/g, "");

                                                updated[i].reason = safeValue;
                                                setFeatureEdits(updated);
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="modal-actions">
                                <button onClick={() => setModalOpen(false)}>Cancel</button>
                                <button 
                                    onClick={() => setConfirmOpen(true)}
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            )}
            {confirmOpen && (
                <div className="modal-overlay open">
                    <div className="modal-box">
                        <h3>Confirm Changes</h3>
                        <p>Are you sure you want to {editingTarget === null ? "update global features" : "update user features"}?</p>
                        <div className="modal-actions">
                            <button onClick={() => setConfirmOpen(false)}>Cancel</button>
                            <button
                                onClick={() => {
                                    setConfirmOpen(false);
                                    handleSubmitFeatureChanges();
                                }}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

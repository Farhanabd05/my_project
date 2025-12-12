import { useEffect, useState } from "react";
import Header from "./DashboardHeader";
import UsersList from "./DashboardUsersList";
import './Dashboard.css';

export default function Dashboard() {
    const [admin, setAdmin] = useState(null);
    const [loading, setLoading] = useState(true);

    function isTokenExpired(token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp * 1000 < Date.now();
        } catch {
            return true;
        }
    }

    useEffect(() => {
        const token = localStorage.getItem("token");
        const user = JSON.parse(localStorage.getItem("user"));

        // redirect
        if (!token || !user || isTokenExpired(token)) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "/login";
            return;
        }

        // aman
        setAdmin(user);
        setLoading(false);
    }, []);

    // small ui ux stuff
    if (loading) return null;

    return (
        <div className="dashboard">
            <h1>Admin Dashboard</h1>
            <Header admin={admin} />
            <UsersList />
        </div>
    );
}

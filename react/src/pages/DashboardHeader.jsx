export default function Header({ admin }) {
    if (!admin) return null;

    const handleLogout = () => {
        // Remove JWT
        localStorage.removeItem("token");

        // Redirect to login page
        window.location.href = "/login";
    };

    return (
        <header className="dashboard-header">
            <div>
                <h2>Welcome, {admin.name}!</h2>
                <p>Email: {admin.email} | Role: {admin.role}</p>
            </div>

            <button 
                className="logout-btn" 
                onClick={handleLogout}
            >
                Logout
            </button>
        </header>
    );
}
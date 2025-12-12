import { useEffect, useState } from "react";
import '../style/login.css';

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        const token = localStorage.getItem("token");

        if (token) {
            window.location.href = "/dashboard";
            return;
        } 
        
        setLoading(false);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage("");

        try {
            const res = await fetch("http://localhost:3001/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (!res.ok) {
                setErrorMessage(data.message || "Login gagal");
                return;
            }

            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));
            window.location.href = "/dashboard";
        } catch (err) {
            setErrorMessage("Server error!");
            console.log(err);
        }
    };

    if (loading) return null;

    return (
        <div className="page-container">
            <h1 className="main-title">Nimonspedia</h1>
            <div className="login-wrapper">
                <div className="login-illustration">
                    <img src="/image/tes4.png" alt="Ilustrasi Login" />
                    <h2>Jual Beli Murah Hanya di Nimonspedia</h2>
                    <p>Gabung dan rasakan kemudahan bertansaksi di Nimonspedia.</p>
                </div>
                <div className="login-content">
                    <div className="auth-container">
                        <h2>Login ADMIN ke Nimonspedia</h2>
                        <form id="login-form" onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label htmlFor="email">Email:</label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="password">Password:</label>
                                <input
                                    type="password"
                                    id="password"
                                    name="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            <div id="error-message">
                                {errorMessage}
                            </div>
                            <button type="submit" id="submit-button">
                                Login
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
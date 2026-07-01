const API_URL = "http://localhost:3000/api";
const AUTH_KEY = "oechsle_session";
const TOKEN_KEY = "authToken";

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");

    if (!loginForm) return;

    const session = getSession();
    const token = getToken();

    if (session && token) {
        window.location.href = "dashboard.html";
        return;
    }

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("email").value.trim().toLowerCase();
        const password = document.getElementById("password").value.trim();

        if (!email || !password) {
            showLoginMessage("Ingrese correo y contraseña.");
            return;
        }

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                showLoginMessage(data.message || "Credenciales incorrectas.");
                return;
            }

            if (!data.token) {
                showLoginMessage("El servidor no devolvió token de autenticación.");
                return;
            }

            const user = {
                id_usuario: data.user.id_usuario,
                name: data.user.nombres,
                email: data.user.correo,
                role: data.user.perfil,
                sede: data.user.sede
            };

            localStorage.setItem(AUTH_KEY, JSON.stringify(user));
            localStorage.setItem(TOKEN_KEY, data.token);

            window.location.href = "dashboard.html";

        } catch (error) {
            console.error(error);
            showLoginMessage("No se pudo conectar con el servidor Node.js.");
        }
    });
});

function showLoginMessage(message) {
    const loginMessage = document.getElementById("loginMessage");

    if (loginMessage) {
        loginMessage.textContent = message;
    }
}

function getSession() {
    try {
        return JSON.parse(localStorage.getItem(AUTH_KEY));
    } catch (error) {
        return null;
    }
}

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function requireAuth() {
    const session = getSession();
    const token = getToken();

    if (!session || !token) {
        logout();
        return null;
    }

    return session;
}

function logout() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "index.html";
}
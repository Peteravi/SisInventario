const AUTH_KEY = "iav_session";

const demoUser = {
    email: "admin@inventario.com",
    password: "admin123",
    name: "Administrador"
};

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const loginMessage = document.getElementById("loginMessage");

    if (loginForm) {
        const currentSession = getSession();

        if (currentSession) {
            window.location.href = "dashboard.html";
            return;
        }

        loginForm.addEventListener("submit", (event) => {
            event.preventDefault();

            const email = document.getElementById("email").value.trim();
            const password = document.getElementById("password").value.trim();

            if (email === demoUser.email && password === demoUser.password) {
                const session = {
                    email: demoUser.email,
                    name: demoUser.name,
                    loginAt: new Date().toISOString()
                };

                localStorage.setItem(AUTH_KEY, JSON.stringify(session));
                window.location.href = "dashboard.html";
            } else {
                loginMessage.textContent = "Credenciales incorrectas. Verifique el correo y la contraseña.";
            }
        });
    }
});

function getSession() {
    try {
        return JSON.parse(localStorage.getItem(AUTH_KEY));
    } catch (error) {
        return null;
    }
}

function requireAuth() {
    const session = getSession();

    if (!session) {
        window.location.href = "index.html";
        return null;
    }

    return session;
}

function logout() {
    localStorage.removeItem(AUTH_KEY);
    window.location.href = "index.html";
}
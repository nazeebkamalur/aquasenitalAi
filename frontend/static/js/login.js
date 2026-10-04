const API_URL = "http://127.0.0.1:8000";

async function login() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const role = document.getElementById("role").value;

    const button = document.getElementById("loginButton");
    const message = document.getElementById("message");

    message.textContent = "";
    message.className = "message";

    if (!email || !password) {
        message.textContent =
            "Please enter your email and password.";
        message.className = "message error";
        return;
    }

    if (!role) {
        message.textContent =
            "Please select your login role.";
        message.className = "message error";
        return;
    }

    button.disabled = true;
    button.textContent = "Signing in...";

    try {
        const response = await fetch(
            `${API_URL}/api/auth/login`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: email,
                    password: password,
                    role: role
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            let errorMessage = "Login failed.";

            if (Array.isArray(data.detail)) {
                errorMessage = data.detail
                    .map(error => error.msg)
                    .join(", ");
            } else if (data.detail) {
                errorMessage = data.detail;
            }

            throw new Error(errorMessage);
        }

        if (!data.access_token) {
            throw new Error(
                "No access token received from server."
            );
        }

        if (!data.user) {
            throw new Error(
                "User information was not received."
            );
        }

        localStorage.setItem(
            "access_token",
            data.access_token
        );

        localStorage.setItem(
            "user",
            JSON.stringify(data.user)
        );

        localStorage.setItem(
            "role",
            data.user.role
        );

        message.textContent =
            "Login successful. Opening dashboard...";

        message.className =
            "message success";

        /*
         * Redirect according to the authenticated role.
         */

        if (data.user.role === "USER") {
            window.location.href =
                "http://127.0.0.1:5500/templates/user_dashboard.html";
        }

        else if (data.user.role === "GOVERNMENT") {
            window.location.href =
                "http://127.0.0.1:5500/templates/government_dashboard.html";
        }

        else if (data.user.role === "ADMIN") {
            window.location.href =
                "http://127.0.0.1:5500/templates/admin_dashboard.html";
        }

        else {
            throw new Error(
                "Unknown user role: " + data.user.role
            );
        }

    } catch (error) {
        console.error(
            "AquaSentinel login error:",
            error
        );

        message.textContent =
            error.message ||
            "Unable to connect to backend.";

        message.className =
            "message error";

        button.disabled = false;
        button.textContent = "Sign In";
    }
}
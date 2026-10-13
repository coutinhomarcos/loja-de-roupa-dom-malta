document.addEventListener("DOMContentLoaded", function () {

    let themeToggleBtn = document.getElementById("theme-toggle");

    // Cria o botão automaticamente nas páginas que ainda não possuem um.
    if (!themeToggleBtn) {
        themeToggleBtn = document.createElement("button");
        themeToggleBtn.id = "theme-toggle";
        themeToggleBtn.className = "theme-button";
        document.body.appendChild(themeToggleBtn);
    }

    const currentTheme = localStorage.getItem("theme") || "dark";

    function aplicarTema(theme) {
        if (theme === "light") {
            document.body.classList.add("light-theme");
            themeToggleBtn.textContent = "🌙 Modo Escuro";
        } else {
            document.body.classList.remove("light-theme");
            themeToggleBtn.textContent = "☀️ Modo Claro";
        }
    }

    aplicarTema(currentTheme);

    themeToggleBtn.addEventListener("click", function () {
        const novoTema =
            document.body.classList.contains("light-theme")
                ? "dark"
                : "light";

        localStorage.setItem("theme", novoTema);
        aplicarTema(novoTema);
    });

});

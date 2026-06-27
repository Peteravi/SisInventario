const PRODUCTS_KEY = "iav_products";
const HISTORY_KEY = "iav_history";

const STATES = [
    "Disponible",
    "Servicio Técnico",
    "Dañado",
    "Empaque Deteriorado",
    "Exhibición"
];

const PAGE_META = {
    inicio: { title: "Inicio", subtitle: "Resumen general del inventario" },
    registro: { title: "Registrar producto", subtitle: "Complete la información del nuevo producto" },
    productos: { title: "Productos", subtitle: "Busque y gestione el estado de los productos" },
    historial: { title: "Historial de cambios", subtitle: "Registro de modificaciones de estado" },
    reportes: { title: "Reportes", subtitle: "Resumen por estado del inventario" }
};

let products = [];
let history = [];
let selectedProductId = null;
let currentUser = null;

document.addEventListener("DOMContentLoaded", () => {
    currentUser = requireAuth();
    if (!currentUser) return;

    initLayout();
    initData();
    initForm();
    initFilters();
    initModal();
    renderAll();
});

function initLayout() {
    const userName = document.getElementById("userName");
    const userAvatar = document.getElementById("userAvatar");
    const logoutBtn = document.getElementById("logoutBtn");
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    const sidebar = document.getElementById("sidebar");
    const sidebarOverlay = document.getElementById("sidebarOverlay");
    const navLinks = document.querySelectorAll(".nav-link");

    userName.textContent = currentUser.name;
    userAvatar.textContent = currentUser.name.charAt(0).toUpperCase();

    logoutBtn.addEventListener("click", logout);

    mobileMenuBtn.addEventListener("click", () => {
        sidebar.classList.toggle("open");
        sidebarOverlay.classList.toggle("show");
    });

    sidebarOverlay.addEventListener("click", () => {
        sidebar.classList.remove("open");
        sidebarOverlay.classList.remove("show");
    });

    navLinks.forEach((button) => {
        button.addEventListener("click", () => {
            const target = button.dataset.target;
            showSection(target);
            sidebar.classList.remove("open");
            sidebarOverlay.classList.remove("show");
        });
    });
}

function showSection(sectionId) {
    document.querySelectorAll(".page-section").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".nav-link").forEach(b => b.classList.remove("active"));

    document.getElementById(sectionId).classList.add("active");
    document.querySelector(`[data-target="${sectionId}"]`).classList.add("active");

    // Update topbar title
    const meta = PAGE_META[sectionId];
    if (meta) {
        document.getElementById("pageTitle").textContent = meta.title;
        document.getElementById("pageSubtitle").textContent = meta.subtitle;
    }
}

function initData() {
    const storedProducts = localStorage.getItem(PRODUCTS_KEY);
    const storedHistory = localStorage.getItem(HISTORY_KEY);

    if (!storedProducts) {
        products = [
            {
                id: createId(),
                codigo: "PRD-001",
                nombre: "Laptop de alto rendimiento",
                categoria: "Tecnología",
                marca: "HP",
                modelo: "Pavilion 15",
                serie: "SN-LAP-001",
                precio: 2800,
                ubicacion: "Almacén principal",
                estado: "Disponible",
                observacion: "Producto apto para entrega.",
                fechaRegistro: new Date().toISOString(),
                ultimaActualizacion: new Date().toISOString()
            },
            {
                id: createId(),
                codigo: "PRD-002",
                nombre: "Smart TV 55 pulgadas",
                categoria: "Electrodomésticos",
                marca: "Samsung",
                modelo: "Crystal UHD",
                serie: "SN-TV-002",
                precio: 3200,
                ubicacion: "Zona de exhibición",
                estado: "Exhibición",
                observacion: "Producto asignado a sala de exhibición.",
                fechaRegistro: new Date().toISOString(),
                ultimaActualizacion: new Date().toISOString()
            },
            {
                id: createId(),
                codigo: "PRD-003",
                nombre: "Consola de videojuegos",
                categoria: "Tecnología",
                marca: "Sony",
                modelo: "PlayStation 5",
                serie: "SN-PS5-003",
                precio: 3500,
                ubicacion: "Servicio técnico",
                estado: "Servicio Técnico",
                observacion: "Pendiente de revisión técnica.",
                fechaRegistro: new Date().toISOString(),
                ultimaActualizacion: new Date().toISOString()
            }
        ];

        history = products.map((product) => ({
            id: createId(),
            productId: product.id,
            codigo: product.codigo,
            producto: product.nombre,
            estadoAnterior: "Registro inicial",
            estadoNuevo: product.estado,
            usuario: currentUser.name,
            comentario: product.observacion || "Producto registrado en el sistema.",
            fecha: product.fechaRegistro
        }));

        saveData();
    } else {
        products = safeParse(storedProducts, []);
        history = safeParse(storedHistory, []);
    }
}

function initForm() {
    const productForm = document.getElementById("productForm");

    productForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const codigo = getValue("codigo").toUpperCase();
        const codeExists = products.some(p => p.codigo.toUpperCase() === codigo);

        if (codeExists) {
            showToast("Ya existe un producto con ese código.", "error");
            return;
        }

        const now = new Date().toISOString();
        const product = {
            id: createId(),
            codigo,
            nombre: getValue("nombre"),
            categoria: getValue("categoria"),
            marca: getValue("marca"),
            modelo: getValue("modelo"),
            serie: getValue("serie"),
            precio: Number(getValue("precio")) || 0,
            ubicacion: getValue("ubicacion"),
            estado: getValue("estado"),
            observacion: getValue("observacion"),
            fechaRegistro: now,
            ultimaActualizacion: now
        };

        products.unshift(product);
        history.unshift({
            id: createId(),
            productId: product.id,
            codigo: product.codigo,
            producto: product.nombre,
            estadoAnterior: "Registro inicial",
            estadoNuevo: product.estado,
            usuario: currentUser.name,
            comentario: product.observacion || "Producto registrado en el sistema.",
            fecha: now
        });

        saveData();
        productForm.reset();
        renderAll();
        showToast("Producto registrado correctamente.");
        showSection("productos");
    });
}

function initFilters() {
    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");
    const clearFilters = document.getElementById("clearFilters");

    searchInput.addEventListener("input", renderProducts);
    statusFilter.addEventListener("change", renderProducts);

    clearFilters.addEventListener("click", () => {
        searchInput.value = "";
        statusFilter.value = "";
        renderProducts();
    });
}

function initModal() {
    const statusModal = document.getElementById("statusModal");

    document.getElementById("closeModal").addEventListener("click", closeStatusModal);
    document.getElementById("cancelStatusChange").addEventListener("click", closeStatusModal);
    document.getElementById("saveStatusChange").addEventListener("click", saveStatusChangeHandler);

    statusModal.addEventListener("click", (e) => {
        if (e.target === statusModal) closeStatusModal();
    });
}

function openStatusModal(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) { showToast("Producto no encontrado.", "error"); return; }

    selectedProductId = productId;
    document.getElementById("modalProductName").textContent = `${product.codigo} — ${product.nombre}`;
    document.getElementById("modalCurrentStatus").value = product.estado;
    document.getElementById("newStatus").value = product.estado;
    document.getElementById("changeComment").value = "";

    const modal = document.getElementById("statusModal");
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
}

function closeStatusModal() {
    selectedProductId = null;
    const modal = document.getElementById("statusModal");
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
}

function saveStatusChangeHandler() {
    const product = products.find(p => p.id === selectedProductId);
    if (!product) { showToast("Producto no encontrado.", "error"); return; }

    const newStatus = document.getElementById("newStatus").value;
    const comment = document.getElementById("changeComment").value.trim();

    if (newStatus === product.estado) {
        showToast("El estado seleccionado es igual al actual.");
        return;
    }

    const previousStatus = product.estado;
    const now = new Date().toISOString();

    product.estado = newStatus;
    product.ultimaActualizacion = now;

    history.unshift({
        id: createId(),
        productId: product.id,
        codigo: product.codigo,
        producto: product.nombre,
        estadoAnterior: previousStatus,
        estadoNuevo: newStatus,
        usuario: currentUser.name,
        comentario: comment || "Cambio de estado sin comentario adicional.",
        fecha: now
    });

    saveData();
    closeStatusModal();
    renderAll();
    showToast("Estado actualizado correctamente.");
}

function renderAll() {
    renderKpis();
    renderProducts();
    renderHistory();
    renderReports();
}

function renderKpis() {
    const total = products.length;
    const disponibles = products.filter(p => p.estado === "Disponible").length;
    const noDisponibles = total - disponibles;

    animateNumber("kpiTotal", total);
    animateNumber("kpiDisponible", disponibles);
    animateNumber("kpiNoDisponibles", noDisponibles);
    animateNumber("kpiHistorial", history.length);
}

function animateNumber(id, target) {
    const el = document.getElementById(id);
    const start = parseInt(el.textContent) || 0;
    const duration = 500;
    const startTime = performance.now();

    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(start + (target - start) * eased);
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

function renderProducts() {
    const tbody = document.getElementById("productsTableBody");
    const emptyMessage = document.getElementById("emptyProducts");
    const searchValue = document.getElementById("searchInput").value.trim().toLowerCase();
    const statusValue = document.getElementById("statusFilter").value;

    const filtered = products.filter(p => {
        const text = [p.codigo, p.nombre, p.categoria, p.marca, p.modelo, p.serie, p.ubicacion, p.estado]
            .join(" ").toLowerCase();
        return text.includes(searchValue) && (statusValue ? p.estado === statusValue : true);
    });

    tbody.innerHTML = "";

    if (filtered.length === 0) {
        emptyMessage.style.display = "flex";
        return;
    }
    emptyMessage.style.display = "none";

    filtered.forEach((product) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${escapeHtml(product.codigo)}</strong></td>
            <td>
                <span class="product-title">${escapeHtml(product.nombre)}</span>
                <span class="product-subtitle">
                    ${escapeHtml(product.modelo || "Sin modelo")} &middot; ${escapeHtml(product.serie || "Sin serie")}
                </span>
            </td>
            <td>${escapeHtml(product.categoria)}</td>
            <td>${escapeHtml(product.marca)}</td>
            <td>${escapeHtml(product.ubicacion)}</td>
            <td><span class="badge ${getStatusClass(product.estado)}">${escapeHtml(product.estado)}</span></td>
            <td>${formatDate(product.ultimaActualizacion)}</td>
            <td>
                <button class="btn btn-ghost" data-open-status="${product.id}" style="font-size:0.8rem;padding:7px 12px">
                    Cambiar estado
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll("[data-open-status]").forEach(btn => {
        btn.addEventListener("click", () => openStatusModal(btn.dataset.openStatus));
    });
}

function renderHistory() {
    const tbody = document.getElementById("historyTableBody");
    const emptyMessage = document.getElementById("emptyHistory");

    tbody.innerHTML = "";

    if (history.length === 0) {
        emptyMessage.style.display = "flex";
        return;
    }
    emptyMessage.style.display = "none";

    history.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${formatDate(item.fecha)}</td>
            <td><strong>${escapeHtml(item.codigo)}</strong></td>
            <td>${escapeHtml(item.producto)}</td>
            <td><span class="badge ${getStatusClass(item.estadoAnterior)}">${escapeHtml(item.estadoAnterior)}</span></td>
            <td><span class="badge ${getStatusClass(item.estadoNuevo)}">${escapeHtml(item.estadoNuevo)}</span></td>
            <td>${escapeHtml(item.usuario)}</td>
            <td>${escapeHtml(item.comentario)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderReports() {
    const reportCards = document.getElementById("reportCards");
    const reportTableBody = document.getElementById("reportTableBody");
    const total = products.length;

    reportCards.innerHTML = "";
    reportTableBody.innerHTML = "";

    STATES.forEach((state, i) => {
        const items = products.filter(p => p.estado === state);
        const count = items.length;
        const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
        const totalValue = items.reduce((sum, p) => sum + Number(p.precio || 0), 0);

        const card = document.createElement("article");
        card.className = "report-card content-card";
        card.style.animationDelay = `${i * 0.06}s`;
        card.innerHTML = `
            <h3>${escapeHtml(state)}</h3>
            <strong>${count}</strong>
            <div class="progress"><span style="width:${percentage}%"></span></div>
            <p>${percentage}% del inventario</p>
        `;
        reportCards.appendChild(card);

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><span class="badge ${getStatusClass(state)}">${escapeHtml(state)}</span></td>
            <td><strong>${count}</strong></td>
            <td>${formatMoney(totalValue)}</td>
            <td>${percentage}%</td>
        `;
        reportTableBody.appendChild(tr);
    });
}

function saveData() {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function getValue(id) {
    return document.getElementById(id).value.trim();
}

function createId() {
    return window.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function safeParse(value, fallback) {
    try { return JSON.parse(value); } catch { return fallback; }
}

function formatDate(isoDate) {
    if (!isoDate) return "Sin fecha";
    return new Intl.DateTimeFormat("es-PE", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit"
    }).format(new Date(isoDate));
}

function formatMoney(value) {
    return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(Number(value || 0));
}

function getStatusClass(status) {
    return "estado-" + String(status).toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function showToast(message) {
    const toast = document.getElementById("toast");
    const text = document.getElementById("toastText");
    text.textContent = message;
    toast.classList.remove("show");
    void toast.offsetWidth;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3200);
}
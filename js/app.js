const APP_API_URL = "http://localhost:3000/api";

let currentUser = null;
let products = [];
let history = [];
let reportByState = [];
let reportByCategory = [];
let inventoryMovements = [];
let academicIndicators = [];
let improvementIndicators = null;
let selectedProductId = null;

const pageInfo = {
    inicio: {
        title: "Inicio",
        subtitle: "Resumen general del inventario de productos de alto valor"
    },
    registro: {
        title: "Registrar producto",
        subtitle: "Ingreso de nuevos productos al inventario"
    },
    productos: {
        title: "Productos",
        subtitle: "Consulta, búsqueda y actualización de productos"
    },
    historial: {
        title: "Historial",
        subtitle: "Registro de cambios de estado"
    },
    reportes: {
        title: "Reportes",
        subtitle: "Indicadores por estado y categoría"
    }
};

const estados = [
    "Disponible",
    "En exhibición",
    "En servicio técnico",
    "Defectuoso",
    "Dañado",
    "Empaque deteriorado",
    "En tránsito",
    "Vendido",
    "De baja"
];

const ROLES_REGISTRO_PRODUCTOS = [
    "Supervisor de Almacén",
    "Administrador de Tienda"
];

function normalizeText(text) {
    return String(text || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function canRegisterProducts() {
    return ROLES_REGISTRO_PRODUCTOS
        .map(normalizeText)
        .includes(normalizeText(currentUser?.role));
}

document.addEventListener("DOMContentLoaded", async () => {
    currentUser = requireAuth();

    if (!currentUser) return;

    initLayout();
    applyRolePermissions();
    initNavigation();
    initForm();
    initFilters();
    initModal();

    await loadData();
});

function getAuthHeaders() {
    const token = localStorage.getItem("authToken");

    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

async function handleUnauthorized(response) {
    if (response.status === 401) {
        showToast("Sesión expirada. Inicie sesión nuevamente.", "error");

        setTimeout(() => {
            logout();
        }, 1200);

        return true;
    }

    if (response.status === 403) {
        showToast("No tienes permisos para realizar esta acción.", "error");
        return true;
    }

    return false;
}

async function loadData() {
    await Promise.all([
        loadProducts(),
        loadHistory(),
        loadReportData()
    ]);

    renderAll();
}

async function loadProducts() {
    try {
        const response = await fetch(`${APP_API_URL}/productos`, {
            headers: getAuthHeaders()
        });

        if (await handleUnauthorized(response)) return;

        products = await response.json();

        if (!Array.isArray(products)) {
            products = [];
        }

    } catch (error) {
        console.error(error);
        showToast("Error al cargar productos desde MySQL.", "error");
        products = [];
    }
}

async function loadHistory() {
    try {
        const response = await fetch(`${APP_API_URL}/historial`, {
            headers: getAuthHeaders()
        });

        if (await handleUnauthorized(response)) return;

        history = await response.json();

        if (!Array.isArray(history)) {
            history = [];
        }

    } catch (error) {
        console.error(error);
        showToast("Error al cargar historial desde MySQL.", "error");
        history = [];
    }
}

async function loadReportData() {
    try {
        const [
            stateResponse,
            categoryResponse,
            movementsResponse,
            indicatorsResponse,
            improvementResponse
        ] = await Promise.all([
            fetch(`${APP_API_URL}/reportes/estado`, { headers: getAuthHeaders() }),
            fetch(`${APP_API_URL}/reportes/categoria`, { headers: getAuthHeaders() }),
            fetch(`${APP_API_URL}/reportes/movimientos`, { headers: getAuthHeaders() }),
            fetch(`${APP_API_URL}/reportes/indicadores`, { headers: getAuthHeaders() }),
            fetch(`${APP_API_URL}/reportes/mejora`, { headers: getAuthHeaders() })
        ]);

        if (await handleUnauthorized(stateResponse)) return;
        if (await handleUnauthorized(categoryResponse)) return;
        if (await handleUnauthorized(movementsResponse)) return;
        if (await handleUnauthorized(indicatorsResponse)) return;
        if (await handleUnauthorized(improvementResponse)) return;

        reportByState = await stateResponse.json();
        reportByCategory = await categoryResponse.json();
        inventoryMovements = await movementsResponse.json();
        academicIndicators = await indicatorsResponse.json();
        improvementIndicators = await improvementResponse.json();

        if (!Array.isArray(reportByState)) reportByState = [];
        if (!Array.isArray(reportByCategory)) reportByCategory = [];
        if (!Array.isArray(inventoryMovements)) inventoryMovements = [];
        if (!Array.isArray(academicIndicators)) academicIndicators = [];

    } catch (error) {
        console.error(error);
        showToast("Error al cargar reportes académicos.", "error");

        reportByState = [];
        reportByCategory = [];
        inventoryMovements = [];
        academicIndicators = [];
        improvementIndicators = null;
    }
}

function applyRolePermissions() {
    const canCreate = canRegisterProducts();
    const registerLink = document.querySelector('.nav-link[data-target="registro"]');
    const registerSection = document.getElementById("registro");

    if (!canCreate) {
        if (registerLink) {
            registerLink.remove();
        }

        if (registerSection) {
            registerSection.remove();
        }
    }
}

function initLayout() {
    const userName = document.getElementById("userName");
    const userAvatar = document.getElementById("userAvatar");
    const logoutBtn = document.getElementById("logoutBtn");
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    const sidebar = document.getElementById("sidebar");
    const sidebarOverlay = document.getElementById("sidebarOverlay");

    if (userName) {
        userName.textContent = `${currentUser.name} · ${currentUser.role}`;
    }

    if (userAvatar) {
        userAvatar.textContent = currentUser.name.charAt(0).toUpperCase();
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", logout);
    }

    if (mobileMenuBtn && sidebar && sidebarOverlay) {
        mobileMenuBtn.addEventListener("click", () => {
            sidebar.classList.add("open");
            sidebarOverlay.classList.add("show");
        });

        sidebarOverlay.addEventListener("click", () => {
            sidebar.classList.remove("open");
            sidebarOverlay.classList.remove("show");
        });
    }
}

function initNavigation() {
    const navLinks = document.querySelectorAll(".nav-link");
    const sections = document.querySelectorAll(".page-section");
    const pageTitle = document.getElementById("pageTitle");
    const pageSubtitle = document.getElementById("pageSubtitle");

    navLinks.forEach(link => {
        link.addEventListener("click", () => {
            const target = link.dataset.target;

            navLinks.forEach(item => item.classList.remove("active"));
            link.classList.add("active");

            sections.forEach(section => {
                section.classList.toggle("active", section.id === target);
            });

            if (pageInfo[target]) {
                pageTitle.textContent = pageInfo[target].title;
                pageSubtitle.textContent = pageInfo[target].subtitle;
            }

            if (sidebar && sidebarOverlay) {
                sidebar.classList.remove("open");
                sidebarOverlay.classList.remove("show");
            }
        });
    });
}

function initForm() {
    const form = document.getElementById("productForm");

    if (!form) return;

    if (!canRegisterProducts()) {
        form.querySelectorAll("input, select, textarea, button").forEach(element => {
            element.disabled = true;
        });

        return;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const codigo = getValue("codigo").toUpperCase();
        const serie = getValue("serie").toUpperCase();

        const skuRegex = /^SKU-[A-Z]{3}-\d{3}$/;
        const serieRegex = /^SER-[A-Z]{3}-[A-Z0-9]+-\d{4}$/;

        if (!codigo || !serie || !getValue("nombre") || !getValue("categoria") || !getValue("marca") || !getValue("proveedor") || !getValue("ubicacion")) {
            showToast("Complete todos los campos obligatorios.", "error");
            return;
        }

        if (!skuRegex.test(codigo)) {
            showToast("El SKU debe tener el formato SKU-LAP-001.", "error");
            return;
        }

        if (!serieRegex.test(serie)) {
            showToast("La serie debe tener el formato SER-LAP-HP15-2026.", "error");
            return;
        }

        if (getValue("marca").length < 2 || getValue("marca").length > 80) {
            showToast("La marca debe tener entre 2 y 80 caracteres.", "error");
            return;
        }

        if (getValue("modelo") && (getValue("modelo").length < 2 || getValue("modelo").length > 100)) {
            showToast("El modelo debe tener entre 2 y 100 caracteres.", "error");
            return;
        }

        if (getValue("ubicacion").length < 3 || getValue("ubicacion").length > 120) {
            showToast("La ubicación debe tener entre 3 y 120 caracteres.", "error");
            return;
        }

        if (getValue("observacion").length > 500) {
            showToast("La observación no debe superar 500 caracteres.", "error");
            return;
        }

        const product = {
            codigo,
            serie,
            nombre: getValue("nombre"),
            categoria: getValue("categoria"),
            marca: getValue("marca"),
            modelo: getValue("modelo"),
            proveedor: getValue("proveedor"),
            estado: getValue("estado"),
            precio: Number(getValue("precio")) || 0,
            ubicacion: getValue("ubicacion"),
            observacion: getValue("observacion")
        };

        try {
            const response = await fetch(`${APP_API_URL}/productos`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(product)
            });

            if (await handleUnauthorized(response)) return;

            const data = await response.json();

            if (!response.ok) {
                showToast(data.message || "No se pudo registrar el producto.", "error");
                return;
            }

            form.reset();

            await loadData();

            showToast("Producto registrado correctamente.", "success");
            goToSection("productos");

        } catch (error) {
            console.error(error);
            showToast("Error al conectar con el servidor.", "error");
        }
    });
}

function initFilters() {
    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");
    const clearFilters = document.getElementById("clearFilters");

    if (searchInput) {
        searchInput.addEventListener("input", renderProducts);
    }

    if (statusFilter) {
        statusFilter.addEventListener("change", renderProducts);
    }

    if (clearFilters) {
        clearFilters.addEventListener("click", () => {
            searchInput.value = "";
            statusFilter.value = "";
            renderProducts();
        });
    }
}

function initModal() {
    const closeModal = document.getElementById("closeModal");
    const cancelStatusChange = document.getElementById("cancelStatusChange");
    const saveStatusChange = document.getElementById("saveStatusChange");
    const modal = document.getElementById("statusModal");

    if (closeModal) closeModal.addEventListener("click", closeStatusModal);
    if (cancelStatusChange) cancelStatusChange.addEventListener("click", closeStatusModal);

    if (modal) {
        modal.addEventListener("click", (event) => {
            if (event.target === modal) closeStatusModal();
        });
    }

    if (saveStatusChange) {
        saveStatusChange.addEventListener("click", saveStatusChangeHandler);
    }
}

function renderAll() {
    renderKPIs();
    renderProducts();
    renderHistory();
    renderReports();
}

function renderKPIs() {
    const total = products.length;
    const disponibles = products.filter(p => p.estado === "Disponible").length;
    const noDisponibles = total - disponibles;

    setText("kpiTotal", total);
    setText("kpiDisponible", disponibles);
    setText("kpiNoDisponibles", noDisponibles);
    setText("kpiHistorial", history.length);
}

function renderProducts() {
    const tbody = document.getElementById("productsTableBody");
    const empty = document.getElementById("emptyProducts");
    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");

    if (!tbody) return;

    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const status = statusFilter ? statusFilter.value : "";

    const filtered = products.filter(product => {
        const text = [
            product.codigo,
            product.nombre,
            product.categoria,
            product.marca,
            product.modelo,
            product.serie,
            product.proveedor,
            product.ubicacion,
            product.estado
        ].join(" ").toLowerCase();

        const matchSearch = !query || text.includes(query);
        const matchStatus = !status || product.estado === status;

        return matchSearch && matchStatus;
    });

    tbody.innerHTML = "";

    if (empty) {
        empty.style.display = filtered.length === 0 ? "block" : "none";
    }

    filtered.forEach(product => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td><strong>${escapeHtml(product.codigo)}</strong></td>
            <td>
                <div class="product-cell">
                    <strong>${escapeHtml(product.nombre)}</strong>
                    <span>${escapeHtml(product.marca)} ${escapeHtml(product.modelo || "")}</span>
                </div>
            </td>
            <td>${escapeHtml(product.serie || "Sin serie")}</td>
            <td>${escapeHtml(product.proveedor || "Sin proveedor")}</td>
            <td>${escapeHtml(product.ubicacion)}</td>
            <td>
                <span class="status-badge ${statusClass(product.estado)}">
                    ${escapeHtml(product.estado)}
                </span>
            </td>
            <td>${formatDate(product.fechaRegistro)}</td>
            <td>
                <button class="btn btn-small btn-primary" onclick="openStatusModal(${product.id})">
                    Cambiar estado
                </button>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

function renderHistory() {
    const tbody = document.getElementById("historyTableBody");
    const empty = document.getElementById("emptyHistory");

    if (!tbody) return;

    tbody.innerHTML = "";

    if (empty) {
        empty.style.display = history.length === 0 ? "block" : "none";
    }

    history.forEach(item => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${formatDate(item.fecha)}</td>
            <td><strong>${escapeHtml(item.codigo)}</strong></td>
            <td>${escapeHtml(item.producto)}</td>
            <td>
                <span class="status-badge ${statusClass(item.estadoAnterior)}">
                    ${escapeHtml(item.estadoAnterior)}
                </span>
            </td>
            <td>
                <span class="status-badge ${statusClass(item.estadoNuevo)}">
                    ${escapeHtml(item.estadoNuevo)}
                </span>
            </td>
            <td>${escapeHtml(item.usuario)}</td>
            <td>${escapeHtml(item.comentario || "Sin comentario")}</td>
        `;

        tbody.appendChild(tr);
    });
}

function renderReports() {
    renderReportByState();
    renderReportByCategory();
    renderAcademicIndicators();
    renderImprovementIndicators();
    renderInventoryMovements();
}

function renderReportByState() {
    const reportCards = document.getElementById("reportCards");
    const reportTableBody = document.getElementById("reportTableBody");

    if (!reportCards || !reportTableBody) return;

    const total = reportByState.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);

    reportCards.innerHTML = "";
    reportTableBody.innerHTML = "";

    reportByState.forEach(item => {
        const cantidad = Number(item.cantidad || 0);
        const valor = Number(item.valor_total || 0);
        const porcentaje = total > 0 ? ((cantidad / total) * 100).toFixed(1) : "0.0";

        const card = document.createElement("article");
        card.className = "content-card report-card";

        card.innerHTML = `
            <span class="status-badge ${statusClass(item.estado)}">
                ${escapeHtml(item.estado)}
            </span>
            <strong>${cantidad}</strong>
            <p>${porcentaje}% del inventario</p>
        `;

        reportCards.appendChild(card);

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>
                <span class="status-badge ${statusClass(item.estado)}">
                    ${escapeHtml(item.estado)}
                </span>
            </td>
            <td>${cantidad}</td>
            <td>S/ ${valor.toFixed(2)}</td>
            <td>${porcentaje}%</td>
        `;

        reportTableBody.appendChild(tr);
    });
}

function renderReportByCategory() {
    const tbody = document.getElementById("categoryReportTableBody");

    if (!tbody) return;

    tbody.innerHTML = "";

    reportByCategory.forEach(item => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td><strong>${escapeHtml(item.categoria)}</strong></td>
            <td>${Number(item.cantidad || 0)}</td>
            <td>S/ ${Number(item.valor_total || 0).toFixed(2)}</td>
        `;

        tbody.appendChild(tr);
    });
}

function renderAcademicIndicators() {
    const tbody = document.getElementById("indicatorsTableBody");

    if (!tbody) return;

    tbody.innerHTML = "";

    academicIndicators.forEach(item => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td><strong>${escapeHtml(item.tipo_medicion)}</strong></td>
            <td>${escapeHtml(item.periodo)}</td>
            <td>${Number(item.errores_registro || 0)}</td>
            <td>${Number(item.incidencias_mensuales || 0)}</td>
            <td>${Number(item.porcentaje_precision || 0).toFixed(2)}%</td>
            <td>${Number(item.tiempo_validacion_promedio || 0).toFixed(2)} min</td>
            <td>${Number(item.tiempo_registro_promedio || 0).toFixed(2)} min</td>
        `;

        tbody.appendChild(tr);
    });
}

function renderImprovementIndicators() {
    const container = document.getElementById("improvementCards");

    if (!container) return;

    container.innerHTML = "";

    if (!improvementIndicators) {
        container.innerHTML = `
            <div class="empty-state">
                No existen indicadores de mejora registrados.
            </div>
        `;
        return;
    }

    const cards = [
        {
            titulo: "Reducción de errores",
            valor: `${Number(improvementIndicators.mejora_errores_porcentaje || 0).toFixed(2)}%`,
            detalle: `${improvementIndicators.errores_preprueba} errores antes → ${improvementIndicators.errores_posprueba} después`
        },
        {
            titulo: "Reducción de incidencias",
            valor: `${Number(improvementIndicators.mejora_incidencias_porcentaje || 0).toFixed(2)}%`,
            detalle: `${improvementIndicators.incidencias_preprueba} incidencias antes → ${improvementIndicators.incidencias_posprueba} después`
        },
        {
            titulo: "Mejora en validación",
            valor: `${Number(improvementIndicators.mejora_tiempo_validacion_porcentaje || 0).toFixed(2)}%`,
            detalle: `${improvementIndicators.tiempo_validacion_preprueba} min antes → ${improvementIndicators.tiempo_validacion_posprueba} min después`
        },
        {
            titulo: "Mejora de precisión",
            valor: `+${Number(improvementIndicators.mejora_precision_puntos || 0).toFixed(2)} pts`,
            detalle: `${improvementIndicators.precision_preprueba}% antes → ${improvementIndicators.precision_posprueba}% después`
        }
    ];

    cards.forEach(item => {
        const card = document.createElement("article");
        card.className = "content-card report-card";

        card.innerHTML = `
            <span class="status-badge status-disponible">${escapeHtml(item.titulo)}</span>
            <strong>${escapeHtml(item.valor)}</strong>
            <p>${escapeHtml(item.detalle)}</p>
        `;

        container.appendChild(card);
    });
}

function renderInventoryMovements() {
    const tbody = document.getElementById("movementsTableBody");

    if (!tbody) return;

    tbody.innerHTML = "";

    inventoryMovements.forEach(item => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${formatDate(item.fecha_movimiento)}</td>
            <td><strong>${escapeHtml(item.sku)}</strong></td>
            <td>${escapeHtml(item.producto)}</td>
            <td>${escapeHtml(item.motivo)}</td>
            <td>${escapeHtml(item.tipo_movimiento)}</td>
            <td>
                <span class="status-badge ${statusClass(item.estado_producto)}">
                    ${escapeHtml(item.estado_producto)}
                </span>
            </td>
            <td>${escapeHtml(item.usuario_responsable)}</td>
            <td>${escapeHtml(item.documento_referencia || "Sin documento")}</td>
        `;

        tbody.appendChild(tr);
    });
}

function openStatusModal(productId) {
    selectedProductId = productId;

    const product = products.find(p => Number(p.id) === Number(productId));

    if (!product) {
        showToast("Producto no encontrado.", "error");
        return;
    }

    setText("modalProductName", `${product.codigo} · ${product.nombre}`);

    const modalCurrentStatus = document.getElementById("modalCurrentStatus");
    const newStatus = document.getElementById("newStatus");
    const changeComment = document.getElementById("changeComment");
    const modal = document.getElementById("statusModal");

    if (modalCurrentStatus) modalCurrentStatus.value = product.estado;
    if (newStatus) newStatus.value = product.estado;
    if (changeComment) changeComment.value = "";

    if (modal) {
        modal.classList.add("show");
        modal.setAttribute("aria-hidden", "false");
    }
}

function closeStatusModal() {
    selectedProductId = null;

    const modal = document.getElementById("statusModal");

    if (modal) {
        modal.classList.remove("show");
        modal.setAttribute("aria-hidden", "true");
    }
}

async function saveStatusChangeHandler() {
    if (!selectedProductId) return;

    const product = products.find(p => Number(p.id) === Number(selectedProductId));

    if (!product) {
        showToast("Producto no encontrado.", "error");
        return;
    }

    const newStatus = getValue("newStatus");
    const comment = getValue("changeComment");

    if (newStatus === product.estado) {
        showToast("Seleccione un estado diferente al actual.", "error");
        return;
    }

    if (comment.length > 500) {
        showToast("El comentario no debe superar 500 caracteres.", "error");
        return;
    }

    try {
        const response = await fetch(`${APP_API_URL}/productos/${selectedProductId}/estado`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                nuevo_estado: newStatus,
                comentario: comment
            })
        });

        if (await handleUnauthorized(response)) return;

        const data = await response.json();

        if (!response.ok) {
            showToast(data.message || "No se pudo actualizar el estado.", "error");
            return;
        }

        closeStatusModal();

        await loadData();

        showToast("Estado actualizado correctamente.", "success");

    } catch (error) {
        console.error(error);
        showToast("Error al conectar con el servidor.", "error");
    }
}

function goToSection(sectionId) {
    const link = document.querySelector(`.nav-link[data-target="${sectionId}"]`);

    if (link) {
        link.click();
    }
}

function getValue(id) {
    const element = document.getElementById(id);
    return element ? element.value.trim() : "";
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function statusClass(status) {
    const normalized = String(status || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-");

    return `status-${normalized}`;
}

function formatDate(dateValue) {
    if (!dateValue) return "Sin fecha";

    const raw = String(dateValue);

    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);

    if (!match) return "Sin fecha";

    const [, year, month, day, hour, minute] = match;

    let hourNumber = Number(hour);
    const ampm = hourNumber >= 12 ? "p. m." : "a. m.";

    hourNumber = hourNumber % 12;
    if (hourNumber === 0) hourNumber = 12;

    return `${day}/${month}/${year}, ${String(hourNumber).padStart(2, "0")}:${minute} ${ampm}`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function showToast(message, type = "success") {
    const toast = document.getElementById("toast");
    const toastText = document.getElementById("toastText");

    if (!toast || !toastText) {
        alert(message);
        return;
    }

    toastText.textContent = message;

    toast.classList.remove("success", "error", "show");
    toast.classList.add(type, "show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}
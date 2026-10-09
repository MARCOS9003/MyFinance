// CONFIGURACIÓN GOOGLE SHEETS (Sustituir por el Web App URL de Google Apps Script)
const GOOGLE_SHEETS_URL = "TU_URL_DE_GOOGLE_APPS_SCRIPT_AQUI";

// ESTADO DE LA APP
let records = [];
let currentRecordId = null;

// CATEGORÍAS ACTUALIZADAS
const categories = {
    gasto: ["Salidas 🍻", "Suplementación 💪", "Deuda Moto 🏍️", "Alimentación", "Transporte", "Ocio", "Otros Gastos"],
    ingreso: ["Nómina", "Bizum 💸", "Otros Ingresos"],
    ahorro: ["🔄 Reponer Deuda Ahorro", "🐷 Aportación Extra (Liquidez)", "📈 Inversión L.P."]
};

// INICIALIZACIÓN
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("date").valueAsDate = new Date();
    updateCategories();
    loadRecords(); // Carga desde Sheets (simulado/real)
});

// NAVEGACIÓN DE PESTAÑAS
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
    
    if(tabId === 'dashboard') calculateBalances();
    if(tabId === 'explore') renderRecords();
}

// LÓGICA DE FORMULARIO DINÁMICO
function updateCategories() {
    const type = document.getElementById("type").value;
    const catSelect = document.getElementById("category");
    const paymentMethodGroup = document.getElementById("payment-method-group");
    
    // Mostrar/Ocultar origen de fondos solo si es Gasto
    paymentMethodGroup.style.display = (type === "gasto") ? "block" : "none";
    
    catSelect.innerHTML = "";
    categories[type].forEach(cat => {
        const option = document.createElement("option");
        option.value = cat;
        option.textContent = cat;
        catSelect.appendChild(option);
    });
}

// CÁLCULO CORE: DASHBOARD Y DEUDA INTELIGENTE
function calculateBalances() {
    let principal = 0;
    let liquidity = 0;
    let investment = 0;
    let expensesFromSavings = 0;
    let debtRepayment = 0;

    records.forEach(r => {
        const amt = parseFloat(r.amount);
        
        if (r.type === 'ingreso') {
            principal += amt;
        } 
        else if (r.type === 'gasto') {
            if (r.paymentMethod === 'liquidez') {
                liquidity -= amt;
                expensesFromSavings += amt; // Registramos que sacamos de liquidez
            } else {
                principal -= amt;
            }
        } 
        else if (r.type === 'ahorro') {
            principal -= amt; // El dinero sale de la cuenta principal
            
            if (r.category === '📈 Inversión L.P.') {
                investment += amt;
            } else if (r.category === '🐷 Aportación Extra (Liquidez)') {
                liquidity += amt; // Crece la liquidez sin afectar deuda
            } else if (r.category === '🔄 Reponer Deuda Ahorro') {
                liquidity += amt; // Crece la liquidez
                debtRepayment += amt; // Amortiza deuda interna
            }
        }
    });

    // MOTOR DE DEUDA (Tope Cero: Si pagas más deuda de la que tienes, desaparece)
    const rawDebt = expensesFromSavings - debtRepayment;
    const currentDebt = Math.max(0, rawDebt);

    // RENDERIZADO DOM
    document.getElementById("checking-balance").textContent = principal.toFixed(2) + " €";
    document.getElementById("liquidity-balance").textContent = liquidity.toFixed(2) + " €";
    document.getElementById("investment-balance").textContent = investment.toFixed(2) + " €";
    
    const debtIndicator = document.getElementById("debt-indicator");
    document.getElementById("debt-amount").textContent = currentDebt.toFixed(2) + " €";
    
    if (currentDebt > 0) {
        debtIndicator.classList.remove("zero-debt");
        debtIndicator.classList.add("has-debt");
    } else {
        debtIndicator.classList.remove("has-debt");
        debtIndicator.classList.add("zero-debt");
    }
}

// GUARDAR MOVIMIENTO
document.getElementById("record-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("save-btn");
    btn.textContent = "Guardando...";
    btn.disabled = true;

    const newRecord = {
        id: Date.now().toString(),
        date: document.getElementById("date").value,
        type: document.getElementById("type").value,
        paymentMethod: document.getElementById("type").value === 'gasto' ? document.getElementById("payment-method").value : 'principal',
        category: document.getElementById("category").value,
        amount: parseFloat(document.getElementById("amount").value),
        description: document.getElementById("description").value || "Sin descripción"
    };

    records.push(newRecord);
    
    // Simulación de envío a Google Sheets (Descomentar en producción)
    /*
    await fetch(GOOGLE_SHEETS_URL, {
        method: "POST",
        body: JSON.stringify({ action: "add", record: newRecord })
    });
    */

    document.getElementById("record-form").reset();
    document.getElementById("date").valueAsDate = new Date();
    updateCategories();
    calculateBalances();
    
    btn.textContent = "Guardar Movimiento";
    btn.disabled = false;
    alert("¡Registro guardado y sincronizado!");
});

// RENDERIZAR LISTA (PESTAÑA EXPLORAR)
function renderRecords() {
    const list = document.getElementById("records-list");
    const filter = document.getElementById("filter-type").value;
    list.innerHTML = "";

    const filtered = filter === "all" ? records : records.filter(r => r.type === filter);
    const sorted = filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(r => {
        const item = document.createElement("div");
        item.className = `record-item ${r.type}`;
        item.innerHTML = `
            <div>
                <strong>${r.category}</strong><br>
                <small>${r.date} | ${r.description}</small>
            </div>
            <div>
                <strong>${r.type === 'gasto' ? '-' : '+'}${r.amount.toFixed(2)} €</strong>
            </div>
        `;
        item.onclick = () => openModal(r.id);
        list.appendChild(item);
    });
}

// LÓGICA MODAL Y ELIMINACIÓN
function openModal(id) {
    const record = records.find(r => r.id === id);
    if(!record) return;
    
    currentRecordId = id;
    document.getElementById("modal-title").textContent = record.category;
    document.getElementById("modal-desc").textContent = `Descripción: ${record.description}`;
    document.getElementById("modal-date").textContent = `Fecha: ${record.date}`;
    document.getElementById("modal-amount").textContent = `Importe: ${record.amount} €`;
    
    document.getElementById("modal").style.display = "block";
}

function closeModal() {
    document.getElementById("modal").style.display = "none";
    currentRecordId = null;
}

document.getElementById("delete-btn").addEventListener("click", async () => {
    if(!currentRecordId) return;
    if(confirm("¿Seguro que quieres eliminar este movimiento?")) {
        records = records.filter(r => r.id !== currentRecordId);
        
        // Simulación borrar en Google Sheets
        /*
        await fetch(GOOGLE_SHEETS_URL, {
            method: "POST",
            body: JSON.stringify({ action: "delete", id: currentRecordId })
        });
        */
        
        closeModal();
        renderRecords();
        calculateBalances();
    }
});

// SIMULACIÓN CARGA INICIAL (Mock para ver cómo funciona sin Sheet conectado)
function loadRecords() {
    // Aquí harías un fetch GET a tu GOOGLE_SHEETS_URL
    calculateBalances();
}

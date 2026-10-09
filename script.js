// URL de tu base de datos en Google Sheets
const API_URL = "https://script.google.com/macros/s/AKfycbzr5OECLW7wG9VF5hVdlJbm1ZwnsiyW3M3t1MPnYrS5LytGLqr923NBjGH5_j8ORdlCGw/exec";

// Categorías Avanzadas Actualizadas
const CAT_GASTOS = [
    "🛒 Supermercado", 
    "🍔 Restaurantes/Ocio", 
    "🍻 Salidas", 
    "🚗 Transporte", 
    "🏍️ Deuda Moto", 
    "💪 Suplementación", 
    "🛍️ Compras Varias", 
    "🏠 Alquiler/Hipoteca", 
    "📱 Suscripciones", 
    "💸 Otros Gastos"
];

const CAT_INGRESOS = [
    "💼 Nómina Principal", 
    "💼 Ingreso Extra", 
    "💸 Bizum", 
    "🔄 Devolución", 
    "📦 Venta Segundamano", 
    "🎁 Regalo", 
    "📈 Rendimiento Inversión"
];

const CAT_AHORROS = [
    "🐷 Hucha General", 
    "✈️ Fondo Viaje", 
    "🚨 Fondo Emergencia", 
    "📈 Inversión (Indexados/Bolsa)"
];

let tipoActual = 'gasto';
let filtroGraficoActual = 'gasto';
let idMovimientoActivo = null; 

let pieChartInstancia = null;
let barChartInstancia = null;

// Ahora arranca vacío y espera a la nube
let movimientos = [];

document.addEventListener('DOMContentLoaded', () => {
    actualizarSelectCategorias();
    actualizarDesplegableCategoriasFiltro(); 
    cargarDatosDesdeGoogle(); // Llama a la base de datos al abrir
});

// NAVEGACIÓN
function navigate(viewId, tabElement) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (tabElement) {
        document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
        tabElement.classList.add('active');
    }
}

// ------------------------------------------------------------------
// NUEVO: SISTEMA DE SINCRONIZACIÓN CON GOOGLE SHEETS
// ------------------------------------------------------------------
async function cargarDatosDesdeGoogle() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        if (data.status === 'success') {
            // Lee las filas del Excel y las transforma en el formato que entiende la app
            movimientos = data.registros.map(row => ({
                id: row[0],
                fecha: row[1],
                tipo: row[2],
                cantidad: Number(row[3]),
                categoria: row[4],
                metodo: row[5],
                descripcion: row[6] || ""
            })).reverse(); // Le da la vuelta para ver los más nuevos primero
            
            // Guarda una copia de seguridad local por si te quedas sin cobertura
            localStorage.setItem('myfinance_movimientos_cache', JSON.stringify(movimientos));
            renderAll();
        }
    } catch (error) {
        console.error("Error al conectar con Sheets. Cargando modo sin conexión:", error);
        movimientos = JSON.parse(localStorage.getItem('myfinance_movimientos_cache')) || [];
        renderAll();
    }
}

// ------------------------------------------------------------------

// FORMULARIOS
document.getElementById('btn-gasto').addEventListener('click', () => setTipo('gasto'));
document.getElementById('btn-ingreso').addEventListener('click', () => setTipo('ingreso'));
document.getElementById('btn-ahorro').addEventListener('click', () => setTipo('ahorro'));

function setTipo(tipo) {
    tipoActual = tipo;
    const btnGasto = document.getElementById('btn-gasto');
    const btnIngreso = document.getElementById('btn-ingreso');
    const btnAhorro = document.getElementById('btn-ahorro');
    const btnGuardar = document.getElementById('btn-guardar');

    btnGasto.classList.remove('active');
    btnIngreso.classList.remove('active');
    btnAhorro.classList.remove('active');

    if (tipo === 'gasto') {
        btnGasto.classList.add('active');
        btnGuardar.textContent = 'Registrar Gasto';
        btnGuardar.className = 'btn-primary btn-red';
    } else if (tipo === 'ingreso') {
        btnIngreso.classList.add('active');
        btnGuardar.textContent = 'Registrar Ingreso';
        btnGuardar.className = 'btn-primary btn-green';
    } else {
        btnAhorro.classList.add('active');
        btnGuardar.textContent = 'Guardar Ahorro';
        btnGuardar.className = 'btn-primary btn-blue';
    }
    actualizarSelectCategorias();
}

function actualizarSelectCategorias() {
    const select = document.getElementById('select-categoria');
    select.innerHTML = '';
    
    let lista = CAT_GASTOS;
    if (tipoActual === 'ingreso') lista = CAT_INGRESOS;
    if (tipoActual === 'ahorro') lista = CAT_AHORROS;
    
    lista.forEach(cat => {
        let opt = document.createElement('option');
        opt.value = cat; opt.textContent = cat;
        select.appendChild(opt);
    });
}

// GUARDAR REGISTRO (CON ENVÍO A LA NUBE)
document.getElementById('form-finanzas').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const cantidad = parseFloat(document.getElementById('input-cantidad').value);
    const categoria = document.getElementById('select-categoria').value;
    const metodo = document.getElementById('select-metodo').value;
    const descripcion = document.getElementById('input-descripcion').value;
    const fechaManual = document.getElementById('input-fecha').value;

    const fechaRegistro = fechaManual ? new Date(fechaManual).toISOString() : new Date().toISOString();

    const nuevoMovimiento = {
        id: Date.now(),
        fecha: fechaRegistro,
        tipo: tipoActual,
        cantidad: cantidad,
        categoria: categoria,
        metodo: metodo,
        descripcion: descripcion
    };

    // 1. Mostrarlo al instante en la app
    movimientos.push(nuevoMovimiento);
    movimientos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); 
    localStorage.setItem('myfinance_movimientos_cache', JSON.stringify(movimientos));
    
    document.getElementById('form-finanzas').reset();
    document.getElementById('input-fecha').value = ""; 
    
    renderAll();
    navigate('view-dashboard', document.querySelectorAll('.tab-item')[0]);

    // 2. Enviarlo a Google Sheets en segundo plano
    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ accion: 'nuevo', ...nuevoMovimiento })
        });
    } catch (error) {
        console.error("Error guardando en la nube:", error);
    }
});

// MOTOR DE RENDERIZADO
function renderAll() {
    renderBalance();
    renderHistorial();
    renderPieChart();
    renderBarChart();
    actualizarFiltroMeses(); 
    renderListaDetalles(); 
}

// EXPLORADOR
function actualizarDesplegableCategoriasFiltro() {
    const tipo = document.getElementById('filtro-tipo').value;
    const selectCat = document.getElementById('filtro-categoria');
    selectCat.innerHTML = '<option value="todas">Todas las categorías</option>';
    
    let lista = [];
    if (tipo === 'gasto') lista = CAT_GASTOS;
    else if (tipo === 'ingreso') lista = CAT_INGRESOS;
    else if (tipo === 'ahorro') lista = CAT_AHORROS;
    else lista = [...CAT_GASTOS, ...CAT_INGRESOS, ...CAT_AHORROS];

    lista.forEach(cat => {
        let opt = document.createElement('option');
        opt.value = cat; opt.textContent = cat;
        selectCat.appendChild(opt);
    });
    renderListaDetalles();
}

function actualizarFiltroMeses() {
    const selectMes = document.getElementById('filtro-mes');
    const valorActual = selectMes.value || 'todos';
    selectMes.innerHTML = '<option value="todos">Todo el histórico</option>';
    
    const mesesUnicos = new Set();
    movimientos.forEach(m => {
        const date = new Date(m.fecha);
        const mesFiltro = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}`;
        mesesUnicos.add(mesFiltro);
    });

    Array.from(mesesUnicos).sort().reverse().forEach(mesStr => {
        const [year, month] = mesStr.split('-');
        const nombreMes = new Date(year, month - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        
        let opt = document.createElement('option');
        opt.value = mesStr; 
        opt.textContent = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);
        selectMes.appendChild(opt);
    });
    
    selectMes.value = valorActual; 
}

function renderListaDetalles() {
    const tipo = document.getElementById('filtro-tipo').value;
    const cat = document.getElementById('filtro-categoria').value;
    const mes = document.getElementById('filtro-mes').value;

    const filtrados = movimientos.filter(m => {
        const matchTipo = (tipo === 'todos') || (m.tipo === tipo);
        const matchCat = (cat === 'todas') || (m.categoria === cat);
        const date = new Date(m.fecha);
        const mesStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}`;
        const matchMes = (mes === 'todos') || (mesStr === mes);
        return matchTipo && matchCat && matchMes;
    });

    let sumaTotal = 0;
    filtrados.forEach(m => {
        if (tipo === 'todos' && m.tipo === 'gasto') sumaTotal -= m.cantidad;
        else if (tipo === 'todos' && m.tipo === 'ahorro') sumaTotal -= m.cantidad;
        else sumaTotal += m.cantidad;
    });

    document.getElementById('det-total-movs').textContent = filtrados.length;
    document.getElementById('det-total-dinero').textContent = `${sumaTotal.toLocaleString('es-ES', {minimumFractionDigits: 2})} €`;

    const cardSuma = document.getElementById('card-total-filtro');
    if (tipo === 'gasto') cardSuma.style.background = 'linear-gradient(135deg, #ff3b30, #ff2d55)';
    else if (tipo === 'ingreso') cardSuma.style.background = 'linear-gradient(135deg, #34c759, #28a745)';
    else if (tipo === 'ahorro') cardSuma.style.background = 'linear-gradient(135deg, #007aff, #5856d6)';
    else cardSuma.style.background = 'linear-gradient(135deg, #1c1c1e, #2c2c2e)';

    const contenedor = document.getElementById('detalles-list');
    contenedor.innerHTML = '';
    
    if (filtrados.length === 0) {
        contenedor.innerHTML = '<div class="list-item"><span class="item-main" style="color:var(--text-secondary);">No hay resultados.</span></div>';
        return;
    }

    filtrados.forEach(m => {
        const div = document

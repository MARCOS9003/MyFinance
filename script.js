// Categorías Avanzadas
const CAT_GASTOS = ["🛒 Supermercado", "🍔 Restaurantes/Ocio", "🚗 Transporte", "🛍️ Compras Varias", "🏠 Alquiler/Hipoteca", "⚡ Suministros (Luz, Agua)", "📱 Suscripciones", "💸 Otros Gastos"];
const CAT_INGRESOS = ["💼 Nómina Principal", "💼 Ingreso Extra", "🔄 Devolución", "📦 Venta Segundamano", "🎁 Regalo", "📈 Rendimiento Inversión"];
const CAT_AHORROS = ["🐷 Hucha General", "✈️ Fondo Viaje", "🚨 Fondo Emergencia", "📈 Inversión (Indexados/Bolsa)"];

let tipoActual = 'gasto';
let filtroGraficoActual = 'gasto'; // Filtro dinámico del queso
let movimientos = JSON.parse(localStorage.getItem('myfinance_movimientos')) || [];

let pieChartInstancia = null;
let barChartInstancia = null;

document.addEventListener('DOMContentLoaded', () => {
    actualizarSelectCategorias();
    renderAll();
});

// Navegación
function navigate(viewId, tabElement) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (tabElement) {
        document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
        tabElement.classList.add('active');
    }
}

// Lógica de Formularios (Gasto, Ingreso, Ahorro)
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

// Guardar Registro
document.getElementById('form-finanzas').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const cantidad = parseFloat(document.getElementById('input-cantidad').value);
    const categoria = document.getElementById('select-categoria').value;
    const metodo = document.getElementById('select-metodo').value;
    const descripcion = document.getElementById('input-descripcion').value;

    const nuevoMovimiento = {
        id: Date.now(),
        fecha: new Date().toISOString(),
        tipo: tipoActual,
        cantidad: cantidad,
        categoria: categoria,
        metodo: metodo,
        descripcion: descripcion
    };

    movimientos.unshift(nuevoMovimiento);
    localStorage.setItem('myfinance_movimientos', JSON.stringify(movimientos));
    
    document.getElementById('form-finanzas').reset();
    renderAll();
    navigate('view-dashboard', document.querySelectorAll('.tab-item')[0]);
});

// MOTOR DE RENDERIZADO
function renderAll() {
    renderBalance();
    renderHistorial();
    renderPieChart();
    renderBarChart();
}

// Balance Pro (Matemáticas Avanzadas)
function renderBalance() {
    let ingresos = 0; 
    let gastos = 0;
    let ahorros = 0;

    movimientos.forEach(m => {
        if (m.tipo === 'ingreso') ingresos += m.cantidad;
        else if (m.tipo === 'gasto') gastos += m.cantidad;
        else if (m.tipo === 'ahorro') ahorros += m.cantidad;
    });

    // Tu liquidez (lo que puedes gastar) son tus ingresos menos tus gastos MENOS lo que has apartado para ahorrar
    const balanceLiquido = ingresos - gastos - ahorros;

    document.getElementById('total-ingresos').textContent = `+${ingresos.toLocaleString('es-ES', {minimumFractionDigits: 2})} €`;
    document.getElementById('total-gastos').textContent = `-${gastos.toLocaleString('es-ES', {minimumFractionDigits: 2})} €`;
    document.getElementById('total-ahorros').textContent = `${ahorros.toLocaleString('es-ES', {minimumFractionDigits: 2})} €`;
    document.getElementById('balance-total').textContent = `${balanceLiquido.toLocaleString('es-ES', {minimumFractionDigits: 2})} €`;
}

// Historial
function renderHistorial() {
    const contenedor = document.getElementById('historial-list');
    contenedor.innerHTML = '';

    if (movimientos.length === 0) {
        contenedor.innerHTML = '<div class="list-item"><span class="item-main" style="color:var(--text-secondary);">Aún no hay movimientos.</span></div>';
        return;
    }

    movimientos.forEach(m => {
        const div = document.createElement('div');
        div.className = 'list-item';
        
        const fecha = new Date(m.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        
        let signo = '-';
        let colorClass = 'text-red';
        if (m.tipo === 'ingreso') { signo = '+'; colorClass = 'text-green'; }
        else if (m.tipo === 'ahorro') { signo = '→'; colorClass = 'text-blue'; } // Ahorro es un movimiento lateral

        div.innerHTML = `
            <div>
                <div class="item-main">${m.categoria}</div>
                <div class="item-sub">${fecha} • ${m.metodo} ${m.descripcion ? '• ' + m.descripcion : ''}</div>
            </div>
            <div class="item-amount ${colorClass}">${signo}${m.cantidad.toLocaleString('es-ES', {minimumFractionDigits: 2})} €</div>
        `;
        contenedor.appendChild(div);
    });
}

// --- GRÁFICOS ---

// Cambiar filtro del Quesito
function cambiarFiltroGrafico(tipo, btnElement) {
    filtroGraficoActual = tipo;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    renderPieChart();
}

function renderPieChart() {
    const ctx = document.getElementById('pieChart').getContext('2d');
    const datosFiltrados = movimientos.filter(m => m.tipo === filtroGraficoActual);
    let sumas = {};
    
    datosFiltrados.forEach(g => {
        sumas[g.categoria] = (sumas[g.categoria] || 0) + g.cantidad;
    });

    const labels = Object.keys(sumas);
    const data = Object.values(sumas);

    // Colores según el tipo
    let colores = ['#ff3b30', '#ff9500', '#ffcc00', '#ff2d55', '#8e8e93']; // Rojo/Naranja para Gastos
    if (filtroGraficoActual === 'ingreso') colores = ['#34c759', '#30b0c7', '#32ade6']; // Verdes para Ingresos
    if (filtroGraficoActual === 'ahorro') colores = ['#007aff', '#5856d6', '#af52de']; // Azules para Ahorro

    if (pieChartInstancia) pieChartInstancia.destroy();

    // Si no hay datos, mostramos un gráfico gris vacío para mantener el diseño
    if (labels.length === 0) {
        pieChartInstancia = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: ['Sin Datos'], datasets: [{ data: [1], backgroundColor: ['#e5e5ea'], borderWidth: 0 }] },
            options: { cutout: '75%', plugins: { tooltip: {enabled: false}, legend: {display: false} } }
        });
        return;
    }

    pieChartInstancia = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{ data: data, backgroundColor: colores, borderWidth: 0 }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom', labels: { font: { family: '-apple-system', size: 12 }, padding: 20 } } },
            cutout: '65%'
        }
    });
}

// Nuevo Gráfico de Barras (Flujo de Caja)
function renderBarChart() {
    const ctx = document.getElementById('barChart').getContext('2d');
    
    let ingresosTotales = 0;
    let gastosTotales = 0;

    movimientos.forEach(m => {
        if (m.tipo === 'ingreso') ingresosTotales += m.cantidad;
        if (m.tipo === 'gasto') gastosTotales += m.cantidad;
    });

    if (barChartInstancia) barChartInstancia.destroy();

    barChartInstancia = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Flujo de Caja'], // Una sola categoría con dos barras
            datasets: [
                {
                    label: 'Ingresos',
                    data: [ingresosTotales],
                    backgroundColor: '#34c759',
                    borderRadius: 8
                },
                {
                    label: 'Gastos',
                    data: [gastosTotales],
                    backgroundColor: '#ff3b30',
                    borderRadius: 8
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, grid: { color: '#f2f2f7' }, border: {display: false} },
                x: { grid: { display: false }, border: {display: false} }
            },
            plugins: { legend: { position: 'top', labels: { font: { family: '-apple-system' } } } }
        }
    });
}

// URL de tu base de datos en Google Sheets
const API_URL = "https://script.google.com/macros/s/AKfycbzr5OECLW7wG9VF5hVdlJbm1ZwnsiyW3M3t1MPnYrS5LytGLqr923NBjGH5_j8ORdlCGw/exec";

// Categorías Avanzadas
const CAT_GASTOS = ["🛒 Supermercado", "🍔 Restaurantes/Ocio", "🚗 Transporte", "🛍️ Compras Varias", "🏠 Alquiler/Hipoteca", "⚡ Suministros (Luz, Agua)", "📱 Suscripciones", "💸 Otros Gastos"];
const CAT_INGRESOS = ["💼 Nómina Principal", "💼 Ingreso Extra", "🔄 Devolución", "📦 Venta Segundamano", "🎁 Regalo", "📈 Rendimiento Inversión"];
const CAT_AHORROS = ["🐷 Hucha General", "✈️ Fondo Viaje", "🚨 Fondo Emergencia", "📈 Inversión (Indexados/Bolsa)"];

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
        const div = document.createElement('div');
        div.className = 'list-item';
        div.setAttribute('onclick', `abrirDetalle(${m.id})`);
        
        const fecha = new Date(m.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        
        let signo = '-'; let colorClass = 'text-red';
        if (m.tipo === 'ingreso') { signo = '+'; colorClass = 'text-green'; }
        else if (m.tipo === 'ahorro') { signo = '→'; colorClass = 'text-blue'; }

        let descPreview = "";
        if (m.descripcion) {
            descPreview = m.descripcion.length > 18 ? ' • ' + m.descripcion.substring(0, 18) + '...' : ' • ' + m.descripcion;
        }

        div.innerHTML = `
            <div>
                <div class="item-main">${m.categoria}</div>
                <div class="item-sub">${fecha} • ${m.metodo}${descPreview}</div>
            </div>
            <div class="item-amount ${colorClass}">${signo}${m.cantidad.toLocaleString('es-ES', {minimumFractionDigits: 2})} €</div>
        `;
        contenedor.appendChild(div);
    });
}

function renderHistorial() {
    const contenedor = document.getElementById('historial-list');
    contenedor.innerHTML = '';

    if (movimientos.length === 0) {
        contenedor.innerHTML = '<div class="list-item"><span class="item-main" style="color:var(--text-secondary);">Aún no hay movimientos.</span></div>';
        return;
    }

    movimientos.slice(0, 25).forEach(m => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.setAttribute('onclick', `abrirDetalle(${m.id})`);
        
        const fecha = new Date(m.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        
        let signo = '-'; let colorClass = 'text-red';
        if (m.tipo === 'ingreso') { signo = '+'; colorClass = 'text-green'; }
        else if (m.tipo === 'ahorro') { signo = '→'; colorClass = 'text-blue'; }

        let descPreview = "";
        if (m.descripcion) {
            descPreview = m.descripcion.length > 18 ? ' • ' + m.descripcion.substring(0, 18) + '...' : ' • ' + m.descripcion;
        }

        div.innerHTML = `
            <div>
                <div class="item-main">${m.categoria}</div>
                <div class="item-sub">${fecha} • ${m.metodo}${descPreview}</div>
            </div>
            <div class="item-amount ${colorClass}">${signo}${m.cantidad.toLocaleString('es-ES', {minimumFractionDigits: 2})} €</div>
        `;
        contenedor.appendChild(div);
    });
}

// MODAL Y ELIMINAR CON ENVÍO A LA NUBE
function abrirDetalle(id) {
    idMovimientoActivo = id;
    const mov = movimientos.find(m => m.id === id);
    if (!mov) return;

    const fechaCompleta = new Date(mov.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    let signo = '-'; let colorClass = 'text-red';
    if (mov.tipo === 'ingreso') { signo = '+'; colorClass = 'text-green'; }
    else if (mov.tipo === 'ahorro') { signo = ''; colorClass = 'text-blue'; }

    document.getElementById('modal-cat').textContent = mov.categoria;
    document.getElementById('modal-amount').textContent = `${signo}${mov.cantidad.toLocaleString('es-ES', {minimumFractionDigits: 2})} €`;
    document.getElementById('modal-amount').className = `modal-amount ${colorClass}`;
    
    document.getElementById('modal-tipo').textContent = mov.tipo;
    document.getElementById('modal-fecha').textContent = fechaCompleta;
    document.getElementById('modal-metodo').textContent = mov.metodo;
    document.getElementById('modal-desc').textContent = mov.descripcion || "Sin descripción";

    document.getElementById('modal-detalle').style.display = 'flex';
}

function cerrarModal() {
    document.getElementById('modal-detalle').style.display = 'none';
    idMovimientoActivo = null;
}

async function eliminarMovimiento() {
    if (!idMovimientoActivo) return;
    
    const confirmacion = confirm("¿Estás seguro de que quieres eliminar este movimiento?");
    if (confirmacion) {
        const idABorrar = idMovimientoActivo; // Guardamos el ID antes de limpiar variables
        
        // 1. Borrado visual inmediato
        movimientos = movimientos.filter(m => m.id !== idABorrar);
        localStorage.setItem('myfinance_movimientos_cache', JSON.stringify(movimientos));
        cerrarModal();
        renderAll();

        // 2. Orden de borrado a la nube
        try {
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ accion: 'eliminar', id: idABorrar })
            });
        } catch (error) {
            console.error("Error al borrar en la nube:", error);
        }
    }
}

// BALANCE Y GRÁFICOS
function renderBalance() {
    let ingresos = 0; let gastos = 0; let ahorros = 0;
    movimientos.forEach(m => {
        if (m.tipo === 'ingreso') ingresos += m.cantidad;
        else if (m.tipo === 'gasto') gastos += m.cantidad;
        else if (m.tipo === 'ahorro') ahorros += m.cantidad;
    });

    const balanceLiquido = ingresos - gastos - ahorros;

    document.getElementById('total-ingresos').textContent = `+${ingresos.toLocaleString('es-ES', {minimumFractionDigits: 2})} €`;
    document.getElementById('total-gastos').textContent = `-${gastos.toLocaleString('es-ES', {minimumFractionDigits: 2})} €`;
    document.getElementById('total-ahorros').textContent = `${ahorros.toLocaleString('es-ES', {minimumFractionDigits: 2})} €`;
    document.getElementById('balance-total').textContent = `${balanceLiquido.toLocaleString('es-ES', {minimumFractionDigits: 2})} €`;
}

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
    
    datosFiltrados.forEach(g => { sumas[g.categoria] = (sumas[g.categoria] || 0) + g.cantidad; });

    const labels = Object.keys(sumas);
    const data = Object.values(sumas);

    let colores = ['#ff3b30', '#ff9500', '#ffcc00', '#ff2d55', '#8e8e93'];
    if (filtroGraficoActual === 'ingreso') colores = ['#34c759', '#30b0c7', '#32ade6'];
    if (filtroGraficoActual === 'ahorro') colores = ['#007aff', '#5856d6', '#af52de'];

    if (pieChartInstancia) pieChartInstancia.destroy();
    if (labels.length === 0) {
        pieChartInstancia = new Chart(ctx, { type: 'doughnut', data: { labels: ['Sin Datos'], datasets: [{ data: [1], backgroundColor: ['#e5e5ea'], borderWidth: 0 }] }, options: { cutout: '75%', plugins: { tooltip: {enabled: false}, legend: {display: false} } } });
        return;
    }

    pieChartInstancia = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: colores, borderWidth: 0 }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { family: '-apple-system', size: 12 }, padding: 20 } } }, cutout: '65%' }
    });
}

function renderBarChart() {
    const ctx = document.getElementById('barChart').getContext('2d');
    let ingresosTotales = 0; let gastosTotales = 0;
    movimientos.forEach(m => {
        if (m.tipo === 'ingreso') ingresosTotales += m.cantidad;
        if (m.tipo === 'gasto') gastosTotales += m.cantidad;
    });

    if (barChartInstancia) barChartInstancia.destroy();
    barChartInstancia = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Flujo de Caja'],
            datasets: [
                { label: 'Ingresos', data: [ingresosTotales], backgroundColor: '#34c759', borderRadius: 8 },
                { label: 'Gastos', data: [gastosTotales], backgroundColor: '#ff3b30', borderRadius: 8 }
            ]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true, grid: { color: '#f2f2f7' }, border: {display: false} }, x: { grid: { display: false }, border: {display: false} } }, plugins: { legend: { position: 'top', labels: { font: { family: '-apple-system' } } } } }
    });
}

// Categorías por defecto
const CAT_GASTOS = ["🛒 Supermercado", "🍔 Ocio y Restaurantes", "🚗 Transporte y Gasolina", "🛍️ Compras", "📱 Suscripciones", "🏠 Hogar", "💸 Otros Gastos"];
const CAT_INGRESOS = ["💼 Nómina", "🔄 Devolución", "📦 Venta (Wallapop, etc)", "🎁 Regalo", "📈 Otros Ingresos"];

let tipoActual = 'gasto'; // Por defecto empieza en Gasto
let movimientos = JSON.parse(localStorage.getItem('finanzas_movimientos')) || [];
let chartInstancia = null;

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

// Selector Gasto vs Ingreso
document.getElementById('btn-gasto').addEventListener('click', () => setTipo('gasto'));
document.getElementById('btn-ingreso').addEventListener('click', () => setTipo('ingreso'));

function setTipo(tipo) {
    tipoActual = tipo;
    const btnGasto = document.getElementById('btn-gasto');
    const btnIngreso = document.getElementById('btn-ingreso');
    const btnGuardar = document.getElementById('btn-guardar');

    if (tipo === 'gasto') {
        btnGasto.classList.add('active');
        btnIngreso.classList.remove('active');
        btnGuardar.textContent = 'Registrar Gasto';
        btnGuardar.className = 'btn-primary btn-red';
    } else {
        btnIngreso.classList.add('active');
        btnGasto.classList.remove('active');
        btnGuardar.textContent = 'Registrar Ingreso';
        btnGuardar.className = 'btn-primary btn-green';
    }
    actualizarSelectCategorias();
}

function actualizarSelectCategorias() {
    const select = document.getElementById('select-categoria');
    select.innerHTML = '';
    const lista = tipoActual === 'gasto' ? CAT_GASTOS : CAT_INGRESOS;
    
    lista.forEach(cat => {
        let opt = document.createElement('option');
        opt.value = cat; opt.textContent = cat;
        select.appendChild(opt);
    });
}

// Guardar Movimiento
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
    localStorage.setItem('finanzas_movimientos', JSON.stringify(movimientos));
    
    document.getElementById('form-finanzas').reset();
    renderAll();
    navigate('view-dashboard', document.querySelectorAll('.tab-item')[0]);
});

// Renderizar todo
function renderAll() {
    renderBalance();
    renderHistorial();
    renderChart();
}

function renderBalance() {
    let ingresos = 0; let gastos = 0;
    movimientos.forEach(m => {
        if (m.tipo === 'ingreso') ingresos += m.cantidad;
        else gastos += m.cantidad;
    });

    const balance = ingresos - gastos;

    document.getElementById('total-ingresos').textContent = `+${ingresos.toFixed(2)} €`;
    document.getElementById('total-gastos').textContent = `-${gastos.toFixed(2)} €`;
    document.getElementById('balance-total').textContent = `${balance.toFixed(2)} €`;
}

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
        const signo = m.tipo === 'ingreso' ? '+' : '-';
        const colorClass = m.tipo === 'ingreso' ? 'text-green' : 'text-red';

        div.innerHTML = `
            <div>
                <div class="item-main">${m.categoria}</div>
                <div class="item-sub">${fecha} • ${m.metodo} ${m.descripcion ? '• ' + m.descripcion : ''}</div>
            </div>
            <div class="item-amount ${colorClass}">${signo}${m.cantidad.toFixed(2)} €</div>
        `;
        contenedor.appendChild(div);
    });
}

function renderChart() {
    const ctx = document.getElementById('gastosChart').getContext('2d');
    
    // Filtrar solo gastos para el gráfico
    const gastos = movimientos.filter(m => m.tipo === 'gasto');
    let sumasPorCategoria = {};
    
    gastos.forEach(g => {
        sumasPorCategoria[g.categoria] = (sumasPorCategoria[g.categoria] || 0) + g.cantidad;
    });

    const labels = Object.keys(sumasPorCategoria);
    const data = Object.values(sumasPorCategoria);

    if (chartInstancia) chartInstancia.destroy();

    if (labels.length === 0) return; // No dibuja si no hay gastos

    chartInstancia = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#5ac8fa', '#007aff', '#5856d6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom', labels: { font: { family: '-apple-system' } } } },
            cutout: '70%'
        }
    });
}
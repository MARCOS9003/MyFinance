const API_URL = "https://script.google.com/macros/s/AKfycbzr5OECLW7wG9VF5hVdlJbm1ZwnsiyW3M3t1MPnYrS5LytGLqr923NBjGH5_j8ORdlCGw/exec";

const CAT_GASTOS = [
    "🛒 Supermercado", "🍔 Restaurantes/Ocio", "☕ Coffee", "🍻 Salidas", "🚗 Transporte", 
    "🏍️ Deuda Moto", "💪 Suplementación", "🛍️ Compras Varias", 
    "🏠 Alquiler/Hipoteca", "📱 Suscripciones", "💸 Otros Gastos"
];

const CAT_INGRESOS = [
    "💼 Nómina Principal", "💼 Ingreso Extra", "💸 Bizum", "🔄 Devolución", 
    "📦 Venta Segundamano", "🎁 Regalo", "📈 Rendimiento Inversión", "💰 Saldo Inicial"
];

const CAT_AHORROS = [
    "📈 Inversión (Largo Plazo)", "🐷 Aportación Extra (Liquidez)",
    "🔄 Reponer Deuda Ahorro", "✈️ Fondo Viaje", "🚨 Fondo Emergencia"
];

let tipoActual = 'gasto';
let filtroGraficoActual = 'gasto';
let idMovimientoActivo = null; 
let idEditando = null; 

let pieChartInstancia = null;
let barChartInstancia = null;
let movimientos = [];

function fmt(num) {
    return Number(num).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getToken() {
    let token = localStorage.getItem('myfinance_token');
    if (!token) {
        token = prompt("🔒 Introduce tu contraseña/token:");
        if (token) localStorage.setItem('myfinance_token', token);
    }
    return token || "";
}

document.addEventListener('DOMContentLoaded', () => {
    actualizarSelectCategorias();
    actualizarDesplegableCategoriasFiltro(); 
    cargarDatosDesdeGoogle();
    
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === 'visible') cargarDatosDesdeGoogle();
    });
});

function navigate(viewId, tabElement) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (tabElement) {
        document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
        tabElement.classList.add('active');
    }
    
    if (viewId !== 'view-registrar') {
        document.getElementById('form-finanzas').reset();
        idEditando = null;
        document.getElementById('titulo-registrar').textContent = "✍️ Nuevo Movimiento";
        setTipo('gasto');
    }
}

async function cargarDatosDesdeGoogle() {
    const cache = localStorage.getItem('myfinance_movimientos_cache');
    if (cache) {
        movimientos = JSON.parse(cache);
        renderAll();
    }

    await procesarColaPendientes();

    try {
        const response = await fetch(`${API_URL}?token=${encodeURIComponent(getToken())}`);
        const data = await response.json();
        if (data.status === 'success') {
            movimientos = data.registros.map(row => ({
                id: row[0], fecha: row[1], tipo: row[2],
                cantidad: Number(row[3]), categoria: row[4],
                metodo: row[5], descripcion: row[6] || ""
            }));
            
            movimientos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); 
            localStorage.setItem('myfinance_movimientos_cache', JSON.stringify(movimientos));
            renderAll();
        }
    } catch (error) { console.error("Offline:", error); }
}

async function procesarColaPendientes() {
    let pendientes = JSON.parse(localStorage.getItem('myfinance_pendientes')) || [];
    if (pendientes.length === 0) return;

    let fallos = [];
    const token = getToken();

    for (let peticion of pendientes) {
        try {
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ token: token, ...peticion })
            });
        } catch (error) { fallos.push(peticion); }
    }
    localStorage.setItem('myfinance_pendientes', JSON.stringify(fallos));
}

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
        btnGuardar.textContent = idEditando ? '💾 Guardar Cambios' : 'Registrar Gasto';
        btnGuardar.className = 'btn-primary btn-red';
    } else if (tipo === 'ingreso') {
        btnIngreso.classList.add('active');
        btnGuardar.textContent = idEditando ? '💾 Guardar Cambios' : 'Registrar Ingreso';
        btnGuardar.className = 'btn-primary btn-green';
    } else {
        btnAhorro.classList.add('active');
        btnGuardar.textContent = idEditando ? '💾 Guardar Cambios' : 'Guardar Ahorro';
        btnGuardar.className = 'btn-primary btn-blue';
    }
    actualizarSelectCategorias();
}

function actualizarSelectCategorias() {
    const select = document.getElementById('select-categoria');
    const valorPrevio = select.value;
    select.innerHTML = '';
    let lista = CAT_GASTOS;
    if (tipoActual === 'ingreso') lista = CAT_INGRESOS;
    if (tipoActual === 'ahorro') lista = CAT_AHORROS;
    lista.forEach(cat => {
        let opt = document.createElement('option');
        opt.value = cat; opt.textContent = cat;
        select.appendChild(opt);
    });
    if (lista.includes(valorPrevio)) select.value = valorPrevio;
}

document.getElementById('form-finanzas').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnGuardar = document.getElementById('btn-guardar');
    btnGuardar.disabled = true;

    const cantidad = parseFloat(document.getElementById('input-cantidad').value);
    const categoria = document.getElementById('select-categoria').value;
    const metodo = document.getElementById('select-metodo').value;
    const descripcion = document.getElementById('input-descripcion').value;
    const fechaManual = document.getElementById('input-fecha').value;
    
    const fechaRegistro = fechaManual ? new Date(fechaManual).toISOString() : new Date().toISOString();
    let peticion;

    if (idEditando) {
        const index = movimientos.findIndex(m => String(m.id) === String(idEditando));
        if (index !== -1) {
            movimientos[index] = { id: idEditando, fecha: fechaRegistro, tipo: tipoActual, cantidad, categoria, metodo, descripcion };
            peticion = { accion: 'editar', ...movimientos[index] };
        }
        idEditando = null;
        document.getElementById('titulo-registrar').textContent = "✍️ Nuevo Movimiento";
    } else {
        const nuevoMovimiento = { id: Date.now(), fecha: fechaRegistro, tipo: tipoActual, cantidad, categoria, metodo, descripcion };
        movimientos.push(nuevoMovimiento);
        peticion = { accion: 'nuevo', ...nuevoMovimiento };
    }

    movimientos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); 
    localStorage.setItem('myfinance_movimientos_cache', JSON.stringify(movimientos));
    
    document.getElementById('form-finanzas').reset();
    document.getElementById('input-fecha').value = ""; 
    renderAll();
    navigate('view-dashboard', document.querySelectorAll('.tab-item')[0]);
    btnGuardar.disabled = false;

    let pendientes = JSON.parse(localStorage.getItem('myfinance_pendientes')) || [];
    pendientes.push(peticion);
    localStorage.setItem('myfinance_pendientes', JSON.stringify(pendientes));
    
    procesarColaPendientes();
});

function prepararEdicion() {
    const mov = movimientos.find(m => String(m.id) === String(idMovimientoActivo));
    if (!mov) return;
    
    cerrarModal();
    navigate('view-registrar', document.querySelectorAll('.tab-item')[1]);
    
    idEditando = mov.id;
    document.getElementById('titulo-registrar').textContent = "✏️ Editar Movimiento";
    
    setTipo(mov.tipo);
    document.getElementById('input-cantidad').value = mov.cantidad;
    document.getElementById('select-categoria').value = mov.categoria;
    document.getElementById('select-metodo').value = mov.metodo;
    document.getElementById('input-descripcion').value = mov.descripcion;
    
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(new Date(mov.fecha) - tzoffset)).toISOString().slice(0, 16);
    document.getElementById('input-fecha').value = localISOTime;
}

// === IA: CHAT FINANCIERO ===
async function enviarMensajeChat() {
    const inputChat = document.getElementById('input-chat');
    const btnChat = document.getElementById('btn-chat');
    const contenedor = document.getElementById('chat-messages');
    const pregunta = inputChat.value.trim();
    
    if (!pregunta) return;

    const divUser = document.createElement('div');
    divUser.style = "background: var(--blue); color: white; padding: 12px; border-radius: 12px; align-self: flex-end; max-width: 85%;";
    divUser.innerHTML = `<span style="font-size: 15px;">${pregunta}</span>`;
    contenedor.appendChild(divUser);
    
    inputChat.value = "";
    contenedor.scrollTop = contenedor.scrollHeight;

    btnChat.textContent = "⏳";
    btnChat.disabled = true;

    try {
        const datosOptimizados = movimientos.map(m => ({
            f: m.fecha.substring(0, 7), 
            t: m.tipo,
            c: m.cantidad,
            cat: m.categoria
        }));

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ 
                token: getToken(), 
                accion: 'chat_ia', 
                preguntaUsuario: pregunta,
                datosFinancieros: datosOptimizados
            })
        });

        const resultado = await response.json();

        const divIA = document.createElement('div');
        divIA.style = "background: #f0f4ff; padding: 12px; border-radius: 12px; align-self: flex-start; max-width: 85%; border: 1px solid #d0d7ff;";
        
        if (resultado.status === 'success') {
            const textoFormateado = resultado.respuesta.replace(/\n/g, '<br>');
            divIA.innerHTML = `<span style="font-size: 15px; color: #1c1c1e; line-height: 1.4;">${textoFormateado}</span>`;
        } else {
            divIA.innerHTML = `<span style="font-size: 15px; color: var(--red);">Error: ${resultado.message}</span>`;
        }
        
        contenedor.appendChild(divIA);

    } catch (error) {
        const divError = document.createElement('div');
        divError.style = "background: #ffe5e5; padding: 12px; border-radius: 12px; align-self: flex-start; max-width: 85%; border: 1px solid #ffcccc;";
        divError.innerHTML = `<span style="font-size: 15px; color: var(--red);">Error de conexión. Inténtalo de nuevo.</span>`;
        contenedor.appendChild(divError);
    } finally {
        btnChat.textContent = "Enviar";
        btnChat.disabled = false;
        contenedor.scrollTop = contenedor.scrollHeight;
    }
}

document.getElementById('input-chat').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') enviarMensajeChat();
});


// === IA: REGISTRO MÁGICO MÚLTIPLE (AUTOMÁTICO) ===
async function procesarMagiaIA() {
    const inputMagico = document.getElementById('input-magico');
    const btnMagia = document.getElementById('btn-magia');
    const texto = inputMagico.value.trim();
    
    if (!texto) return;

    btnMagia.textContent = "⏳";
    btnMagia.disabled = true;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ 
                token: getToken(), 
                accion: 'ia_magia', 
                textoUsuario: texto 
            })
        });

        const arrayResultados = await response.json();

        if (Array.isArray(arrayResultados) && arrayResultados.length > 0) {
            
            // 1. Mostrar resumen al usuario para confirmación
            let mensajeConfirmacion = `✨ He detectado ${arrayResultados.length} movimiento(s):\n\n`;
            let nuevosMovimientosLocal = [];
            
            arrayResultados.forEach((res, index) => {
                // Deducción inteligente del Tipo (Gasto/Ingreso/Ahorro) basada en la Categoría
                let tipoDeducido = 'gasto';
                if (CAT_INGRESOS.includes(res.categoria)) tipoDeducido = 'ingreso';
                else if (CAT_AHORROS.includes(res.categoria)) tipoDeducido = 'ahorro';
                
                mensajeConfirmacion += `${index + 1}. [${tipoDeducido.toUpperCase()}] ${res.cantidad}€ en ${res.categoria || "Otros Gastos"} (${res.descripcion})\n`;
                
                // Preparamos el objeto para guardarlo
                nuevosMovimientosLocal.push({
                    id: Date.now() + index, // Damos IDs únicos
                    fecha: new Date().toISOString(),
                    tipo: tipoDeducido,
                    cantidad: parseFloat(res.cantidad),
                    categoria: res.categoria || "💸 Otros Gastos",
                    metodo: res.metodo || "Tarjeta",
                    descripcion: res.descripcion || texto
                });
            });

            mensajeConfirmacion += `\n¿Deseas registrar esto automáticamente en tu base de datos?`;

            // 2. Si el usuario confirma, los guardamos todos de golpe
            if (confirm(mensajeConfirmacion)) {
                // Guardar en la lista visual del móvil (offline-first)
                movimientos = [...movimientos, ...nuevosMovimientosLocal];
                movimientos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); 
                localStorage.setItem('myfinance_movimientos_cache', JSON.stringify(movimientos));
                
                // Preparar la petición para Google Apps Script
                const peticionMultiple = { 
                    accion: 'nuevo_multiple', 
                    movimientos: nuevosMovimientosLocal 
                };
                
                let pendientes = JSON.parse(localStorage.getItem('myfinance_pendientes')) || [];
                pendientes.push(peticionMultiple);
                localStorage.setItem('myfinance_pendientes', JSON.stringify(pendientes));
                
                procesarColaPendientes();
                
                // Limpiamos pantalla y volvemos al panel principal
                inputMagico.value = "";
                renderAll();
                navigate('view-dashboard', document.querySelectorAll('.tab-item')[0]);
                alert("✅ ¡Movimientos guardados con éxito!");
            }

        } else if (arrayResultados.status === 'error') {
            alert("Error de IA: " + arrayResultados.message);
        } else {
            alert("No he podido entender los datos. Prueba a escribirlos más claro.");
        }
    } catch (error) {
        console.error("Error al procesar la IA:", error);
        alert("No se ha podido procesar este gasto. Revisa tu conexión.");
    } finally {
        btnMagia.textContent = "Procesar";
        btnMagia.disabled = false;
    }
}
// ==========================================

function renderAll() {
    renderBalance();
    renderHistorial();
    renderPieChart();
    renderBarChart();
    actualizarFiltroMeses(); 
    renderListaDetalles(); 
}

function renderBalance() {
    let ingresos = 0; let gastosCorrientes = 0; let ahorrosTotales = 0; 
    let aportacionesLiquidez = 0; let totalInversion = 0;
    let gastosConAhorro = 0; let devolucionesDeuda = 0; 

    movimientos.forEach(m => {
        if (m.tipo === 'ingreso') {
            ingresos += m.cantidad;
        } else if (m.tipo === 'gasto') {
            if (m.metodo === 'Cuenta Ahorro') gastosConAhorro += m.cantidad;
            else gastosCorrientes += m.cantidad;
        } else if (m.tipo === 'ahorro') {
            ahorrosTotales += m.cantidad; 
            if (m.categoria.includes('Inversión')) totalInversion += m.cantidad;
            else {
                aportacionesLiquidez += m.cantidad;
                if (m.categoria === '🔄 Reponer Deuda Ahorro') devolucionesDeuda += m.cantidad;
            }
        }
    });

    const balanceLiquido = ingresos - gastosCorrientes - ahorrosTotales;
    const cuentaAhorro = aportacionesLiquidez - gastosConAhorro;
    let deudaPendiente = gastosConAhorro - devolucionesDeuda;
    if (deudaPendiente < 0) deudaPendiente = 0;

    document.getElementById('total-ingresos').textContent = `+${fmt(ingresos)} €`;
    const gastosTotalesPantalla = gastosCorrientes + gastosConAhorro;
    document.getElementById('total-gastos').textContent = `-${fmt(gastosTotalesPantalla)} €`;
    document.getElementById('balance-total').textContent = `${fmt(balanceLiquido)} €`;
    document.getElementById('total-inversion').textContent = `${fmt(totalInversion)} €`;
    document.getElementById('total-liquidez').textContent = `${fmt(cuentaAhorro)} €`;

    const deudaEl = document.getElementById('deuda-pendiente');
    if (deudaPendiente > 0) {
        deudaEl.style.display = 'inline-block';
        deudaEl.textContent = `Deuda: -${fmt(deudaPendiente)} €`;
    } else {
        deudaEl.style.display = 'none';
    }
}

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
        opt.value = mesStr; opt.textContent = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);
        selectMes.appendChild(opt);
    });
    selectMes.value = valorActual; 
}

function crearItemLista(m) {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.setAttribute('onclick', `abrirDetalle('${m.id}')`);
    const fecha = new Date(m.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    
    let signo = '-'; let colorClass = 'text-red';
    if (m.tipo === 'ingreso') { signo = '+'; colorClass = 'text-green'; }
    else if (m.tipo === 'ahorro') { signo = '→'; colorClass = 'text-blue'; }
    
    let descPreview = m.descripcion ? (m.descripcion.length > 18 ? ' • ' + m.descripcion.substring(0, 18) + '...' : ' • ' + m.descripcion) : "";
    
    div.innerHTML = `
        <div>
            <div class="item-main">${m.categoria}</div>
            <div class="item-sub">${fecha} • ${m.metodo}${descPreview}</div>
        </div>
        <div class="item-amount ${colorClass}">${signo}${fmt(m.cantidad)} €</div>
    `;
    return div;
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
    document.getElementById('det-total-dinero').textContent = `${fmt(sumaTotal)} €`;

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
    filtrados.forEach(m => contenedor.appendChild(crearItemLista(m)));
}

function renderHistorial() {
    const contenedor = document.getElementById('historial-list');
    contenedor.innerHTML = '';
    if (movimientos.length === 0) {
        contenedor.innerHTML = '<div class="list-item"><span class="item-main" style="color:var(--text-secondary);">Aún no hay movimientos.</span></div>';
        return;
    }
    movimientos.slice(0, 25).forEach(m => contenedor.appendChild(crearItemLista(m)));
}

function abrirDetalle(id) {
    idMovimientoActivo = id;
    const mov = movimientos.find(m => String(m.id) === String(id));
    if (!mov) return;
    
    const fechaCompleta = new Date(mov.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    let signo = '-'; let colorClass = 'text-red';
    if (mov.tipo === 'ingreso') { signo = '+'; colorClass = 'text-green'; }
    else if (mov.tipo === 'ahorro') { signo = ''; colorClass = 'text-blue'; }

    document.getElementById('modal-cat').textContent = mov.categoria;
    document.getElementById('modal-amount').textContent = `${signo}${fmt(mov.cantidad)} €`;
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

document.getElementById('modal-detalle').addEventListener('click', function(e) {
    if (e.target === this) cerrarModal();
});

async function eliminarMovimiento() {
    if (!idMovimientoActivo) return;
    if (confirm("¿Estás seguro de que quieres eliminar este movimiento?")) {
        const idABorrar = idMovimientoActivo;
        movimientos = movimientos.filter(m => String(m.id) !== String(idABorrar));
        localStorage.setItem('myfinance_movimientos_cache', JSON.stringify(movimientos));
        cerrarModal();
        renderAll();
        
        const peticionBorrado = { accion: 'eliminar', id: idABorrar };
        let pendientes = JSON.parse(localStorage.getItem('myfinance_pendientes')) || [];
        pendientes.push(peticionBorrado);
        localStorage.setItem('myfinance_pendientes', JSON.stringify(pendientes));
        
        procesarColaPendientes();
    }
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

    let colores = ['#ff3b30', '#ff9500', '#ffcc00', '#ff2d55', '#8e8e93', '#d5a6bd', '#a2c4c9', '#b4a7d6', '#f9cb9c', '#e06666', '#a1887f'];
    if (filtroGraficoActual === 'ingreso') colores = ['#34c759', '#30b0c7', '#32ade6', '#6aa84f', '#8fce00', '#274e13'];
    if (filtroGraficoActual === 'ahorro') colores = ['#007aff', '#5856d6', '#af52de', '#1155cc', '#32ade6']; 

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

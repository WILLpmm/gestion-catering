const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));
app.use(session({
  secret: 'catering-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

/* =========================================================
   CONFIGURACIÓN DE CAPACIDAD OPERATIVA (editable por admin)
   ========================================================= */
const capacidad = {
  maxEventosPorDia: 3,
  maxVajillaDisponible: 600,   // sets de vajilla en almacén
  maxPersonalDisponible: 25    // mozos disponibles por día
};

/* =========================================================
   CATÁLOGO DE SERVICIOS (con insumos y requerimientos)
   Los ingredientes están definidos para una base de 50 personas
   y se escalan proporcionalmente a la cantidad real del evento.
   ========================================================= */
const PERSONAS_BASE = 50;

let menu = [
  {
    id: 'm1', nombre: 'Buffet Premium', precio: 1500, personasBase: PERSONAS_BASE,
    personalPorEvento: 6, vajillaPorPersona: 3,
    ingredientes: [
      { nombre: 'Pollo (kg)', cantidad: 25, unidad: 'kg' },
      { nombre: 'Carne de res (kg)', cantidad: 20, unidad: 'kg' },
      { nombre: 'Arroz (kg)', cantidad: 15, unidad: 'kg' },
      { nombre: 'Papa (kg)', cantidad: 20, unidad: 'kg' },
      { nombre: 'Verduras mixtas (kg)', cantidad: 18, unidad: 'kg' },
      { nombre: 'Postres surtidos (unid)', cantidad: 50, unidad: 'unid' }
    ]
  },
  {
    id: 'm2', nombre: 'Asamblea Escolar', precio: 500, personasBase: PERSONAS_BASE,
    personalPorEvento: 2, vajillaPorPersona: 1,
    ingredientes: [
      { nombre: 'Pan (unid)', cantidad: 100, unidad: 'unid' },
      { nombre: 'Embutidos (kg)', cantidad: 8, unidad: 'kg' },
      { nombre: 'Refresco (litros)', cantidad: 25, unidad: 'l' },
      { nombre: 'Café (kg)', cantidad: 1, unidad: 'kg' }
    ]
  },
  {
    id: 'm3', nombre: 'Almuerzo Ejecutivo', precio: 900, personasBase: PERSONAS_BASE,
    personalPorEvento: 3, vajillaPorPersona: 2,
    ingredientes: [
      { nombre: 'Pollo o pescado (kg)', cantidad: 18, unidad: 'kg' },
      { nombre: 'Arroz (kg)', cantidad: 12, unidad: 'kg' },
      { nombre: 'Ensalada (kg)', cantidad: 10, unidad: 'kg' },
      { nombre: 'Postre individual (unid)', cantidad: 50, unidad: 'unid' },
      { nombre: 'Bebida (litros)', cantidad: 20, unidad: 'l' }
    ]
  },
  {
    id: 'm4', nombre: 'Catering Cumpleaños', precio: 750, personasBase: PERSONAS_BASE,
    personalPorEvento: 3, vajillaPorPersona: 2,
    ingredientes: [
      { nombre: 'Torta (kg)', cantidad: 8, unidad: 'kg' },
      { nombre: 'Bocaditos salados (unid)', cantidad: 200, unidad: 'unid' },
      { nombre: 'Bocaditos dulces (unid)', cantidad: 150, unidad: 'unid' },
      { nombre: 'Gaseosa (litros)', cantidad: 20, unidad: 'l' }
    ]
  },
  {
    id: 'm5', nombre: 'Bodas Premium', precio: 2500, personasBase: PERSONAS_BASE,
    personalPorEvento: 8, vajillaPorPersona: 4,
    ingredientes: [
      { nombre: 'Carne de res (kg)', cantidad: 25, unidad: 'kg' },
      { nombre: 'Pollo (kg)', cantidad: 20, unidad: 'kg' },
      { nombre: 'Arroz (kg)', cantidad: 18, unidad: 'kg' },
      { nombre: 'Papa (kg)', cantidad: 20, unidad: 'kg' },
      { nombre: 'Torta de bodas (kg)', cantidad: 10, unidad: 'kg' },
      { nombre: 'Bebidas variadas (litros)', cantidad: 60, unidad: 'l' }
    ]
  },
  {
    id: 'm6', nombre: 'Coffee Break Empresarial', precio: 650, personasBase: PERSONAS_BASE,
    personalPorEvento: 2, vajillaPorPersona: 1,
    ingredientes: [
      { nombre: 'Café (kg)', cantidad: 2, unidad: 'kg' },
      { nombre: 'Infusiones (cajas)', cantidad: 10, unidad: 'unid' },
      { nombre: 'Jugo (litros)', cantidad: 15, unidad: 'l' },
      { nombre: 'Sándwiches (unid)', cantidad: 100, unidad: 'unid' },
      { nombre: 'Galletas y postres (unid)', cantidad: 100, unidad: 'unid' }
    ]
  },
  {
    id: 'm7', nombre: 'Graduaciones y Promociones', precio: 1200, personasBase: PERSONAS_BASE,
    personalPorEvento: 5, vajillaPorPersona: 3,
    ingredientes: [
      { nombre: 'Pollo (kg)', cantidad: 20, unidad: 'kg' },
      { nombre: 'Arroz (kg)', cantidad: 14, unidad: 'kg' },
      { nombre: 'Ensalada (kg)', cantidad: 12, unidad: 'kg' },
      { nombre: 'Torta (kg)', cantidad: 6, unidad: 'kg' },
      { nombre: 'Bebidas (litros)', cantidad: 30, unidad: 'l' }
    ]
  }
];

/* =========================================================
   PROVEEDORES EXTERNOS
   ========================================================= */
let proveedores = [
  { id: 'p1', nombre: 'Decoraciones Luz & Estilo', servicio: 'Decoración temática', costo: 800 },
  { id: 'p2', nombre: 'Sonido & Iluminación RGB', servicio: 'Equipo de sonido/luces', costo: 1200 },
  { id: 'p3', nombre: 'Transportes Rápido SAC', servicio: 'Transporte adicional', costo: 350 },
  { id: 'p4', nombre: 'Mantelería Fina Express', servicio: 'Alquiler de mantelería', costo: 400 }
];
let nextProveedorId = 5;

/* =========================================================
   USUARIOS (in-memory)
   ========================================================= */
const users = new Map();

async function seedUsers() {
  users.clear();
  const creds = [
    ['admin', '111', 'admin'],
    ['ventas', '222', 'ventas'],
    ['logistica', '333', 'logistica'],
    ['cocina', '444', 'cocina'],
    ['personal', '555', 'personal']
  ];
  for (const [username, pass, role] of creds) {
    const hash = await bcrypt.hash(pass, 10);
    users.set(username, { username, passwordHash: hash, role });
  }
  console.log('=> ¡Credenciales cargadas con éxito en la memoria!');
}

function ensureRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    if (!roles.includes(req.session.user.role)) return res.status(403).json({ error: 'No autorizado' });
    next();
  };
}

/* =========================================================
   PEDIDOS / ÓRDENES
   ========================================================= */
const orders = [];
let nextOrderId = 1;

// Calcula requerimientos (personal, vajilla, ingredientes) de un carrito
function calcularRequerimientos(cart, persons) {
  let personalTotal = 0;
  let vajillaTotal = 0;
  const ingredientesMap = new Map();

  cart.forEach(item => {
    const def = menu.find(m => m.nombre === item.item);
    const qty = Number(item.qty || 1);
    if (!def) return;
    const factor = (Number(persons) || def.personasBase) / def.personasBase;
    personalTotal += Math.ceil(def.personalPorEvento * factor) * qty;
    vajillaTotal += Math.ceil(def.vajillaPorPersona * (Number(persons) || def.personasBase)) * qty;
    def.ingredientes.forEach(ing => {
      const cantidadEscalada = Math.round(ing.cantidad * factor * qty * 100) / 100;
      const key = ing.nombre;
      ingredientesMap.set(key, (ingredientesMap.get(key) || 0) + cantidadEscalada);
    });
  });

  const ingredientes = Array.from(ingredientesMap.entries()).map(([nombre, cantidad]) => ({ nombre, cantidad }));
  return { personalTotal, vajillaTotal, ingredientes };
}

// Estado de ocupación de una fecha (considerando pedidos activos, no rechazados/cancelados)
function ocupacionFecha(fecha) {
  const activos = orders.filter(o =>
    o.clientInfo.fecha === fecha &&
    !['rechazado', 'cancelado'].includes(o.status)
  );
  const eventos = activos.length;
  const vajilla = activos.reduce((sum, o) => sum + (o.requerimientos?.vajillaTotal || 0), 0);
  const personal = activos.reduce((sum, o) => sum + (o.requerimientos?.personalTotal || 0), 0);
  return {
    fecha,
    eventos,
    vajilla,
    personal,
    excedeEventos: eventos > capacidad.maxEventosPorDia,
    excedeVajilla: vajilla > capacidad.maxVajillaDisponible,
    excedePersonal: personal > capacidad.maxPersonalDisponible,
    limites: { ...capacidad }
  };
}

function diasHasta(fechaStr) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaEvento = new Date(fechaStr + 'T00:00:00');
  const diffMs = fechaEvento.getTime() - hoy.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/* =========================================================
   ARRANQUE DEL SERVIDOR
   ========================================================= */
async function startServer() {
  await seedUsers();
  app.listen(PORT, () => {
    console.log('=== SERVIDOR CONFIGURADO ===');
    console.log('Admin      -> usuario: admin      | contraseña: 111');
    console.log('Ventas     -> usuario: ventas     | contraseña: 222');
    console.log('Logística  -> usuario: logistica  | contraseña: 333');
    console.log('Cocina     -> usuario: cocina     | contraseña: 444');
    console.log('Personal   -> usuario: personal   | contraseña: 555');
    console.log('============================');
    console.log('Server running on http://localhost:' + PORT);
  });
}
startServer();

/* =========================================================
   AUTENTICACIÓN
   ========================================================= */
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  const key = username.toLowerCase();
  const user = users.get(key);
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
  req.session.user = { username: user.username, role: user.role };
  return res.json({ ok: true, role: user.role });
});

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  const key = username.toLowerCase();
  if (users.has(key)) return res.status(400).json({ error: 'El usuario ya existe' });
  const reserved = new Set(['admin', 'ventas', 'logistica', 'cocina', 'personal']);
  if (reserved.has(key)) return res.status(400).json({ error: 'Nombre de usuario no permitido' });
  const hash = await bcrypt.hash(password, 10);
  users.set(key, { username, passwordHash: hash, role: 'cliente' });
  return res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  if (!req.session.user) return res.json({ loggedIn: false });
  return res.json({ loggedIn: true, role: req.session.user.role, username: req.session.user.username });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(err => res.json({ ok: !err }));
});

app.get('/api/users', ensureRole('admin'), (req, res) => {
  const userList = Array.from(users.values()).map(u => ({ username: u.username, role: u.role }));
  return res.json({ ok: true, users: userList });
});

app.post('/api/users', ensureRole('admin'), async (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password || !role) return res.status(400).json({ error: 'Datos incompletos' });
  const key = username.toLowerCase();
  if (users.has(key)) return res.status(400).json({ error: 'El usuario ya existe' });
  const allowedRoles = ['admin', 'ventas', 'logistica', 'cocina', 'personal', 'cliente'];
  if (!allowedRoles.includes(role)) return res.status(400).json({ error: 'Rol inválido' });
  const hash = await bcrypt.hash(password, 10);
  users.set(key, { username, passwordHash: hash, role });
  return res.json({ ok: true });
});

/* =========================================================
   CATÁLOGO / MENÚ
   ========================================================= */
app.get('/api/menu', (req, res) => {
  // Para clientes ocultamos info interna (ingredientes, personal, vajilla)
  const isInterno = req.session.user && ['admin', 'ventas', 'cocina', 'logistica'].includes(req.session.user.role);
  const data = isInterno ? menu : menu.map(({ id, nombre, precio }) => ({ id, nombre, precio }));
  res.json({ ok: true, menu: data });
});

app.put('/api/menu/:id', ensureRole('admin'), (req, res) => {
  const item = menu.find(m => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Servicio no encontrado' });
  const { precio } = req.body || {};
  if (precio !== undefined) item.precio = Number(precio);
  res.json({ ok: true, item });
});

/* =========================================================
   PROVEEDORES
   ========================================================= */
app.get('/api/proveedores', ensureRole('admin', 'ventas', 'logistica'), (req, res) => {
  res.json({ ok: true, proveedores });
});

app.post('/api/proveedores', ensureRole('admin', 'ventas'), (req, res) => {
  const { nombre, servicio, costo } = req.body || {};
  if (!nombre || !servicio || costo === undefined) return res.status(400).json({ error: 'Datos incompletos' });
  const nuevo = { id: 'p' + (nextProveedorId++), nombre, servicio, costo: Number(costo) };
  proveedores.push(nuevo);
  res.json({ ok: true, proveedor: nuevo });
});

app.delete('/api/proveedores/:id', ensureRole('admin'), (req, res) => {
  const idx = proveedores.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  proveedores.splice(idx, 1);
  res.json({ ok: true });
});

/* =========================================================
   CAPACIDAD / DISPONIBILIDAD DE FECHAS
   ========================================================= */
app.get('/api/capacidad', ensureRole('admin', 'ventas', 'logistica'), (req, res) => {
  res.json({ ok: true, capacidad });
});

app.put('/api/capacidad', ensureRole('admin'), (req, res) => {
  const { maxEventosPorDia, maxVajillaDisponible, maxPersonalDisponible } = req.body || {};
  if (maxEventosPorDia) capacidad.maxEventosPorDia = Number(maxEventosPorDia);
  if (maxVajillaDisponible) capacidad.maxVajillaDisponible = Number(maxVajillaDisponible);
  if (maxPersonalDisponible) capacidad.maxPersonalDisponible = Number(maxPersonalDisponible);
  res.json({ ok: true, capacidad });
});

app.get('/api/capacidad/:fecha', (req, res) => {
  res.json({ ok: true, ocupacion: ocupacionFecha(req.params.fecha) });
});

/* =========================================================
   PEDIDOS
   ========================================================= */

// Cliente crea un pedido (estado inicial: pendiente, a la espera de Ventas)
app.post('/api/orders', ensureRole('cliente', 'admin', 'ventas'), (req, res) => {
  const { clientInfo, cart } = req.body || {};
  if (!clientInfo || !clientInfo.cliente || !cart || !Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ error: 'Datos de pedido inválidos' });
  }
  const requerimientos = calcularRequerimientos(cart, clientInfo.persons);
  const order = {
    id: 'O' + String(nextOrderId++).padStart(3, '0'),
    clientInfo,
    cart,
    requerimientos,
    status: 'pendiente',
    createdAt: new Date().toISOString(),
    createdBy: req.session.user.username,
    pago: { adelantoRequerido: null, adelantoPagado: false, montoAdelanto: 0, metodoPago: null, numeroOperacion: null, totalPagado: false },
    proveedoresAsignados: [],
    produccion: { insumosRecibidos: false, enPreparacion: false, listoDespacho: false, controlCalidad: false },
    transporte: { vehiculo: '', horarioSalida: '', entregado: false },
    retornoEquipos: null,
    personalAsignado: [],
    solicitudCambio: null,
    historial: [{ evento: 'Pedido creado por el cliente', fecha: new Date().toISOString() }]
  };
  orders.push(order);
  return res.json({ ok: true, order });
});

// Ver pedidos (según rol)
app.get('/api/orders', ensureRole('logistica', 'admin', 'ventas', 'cocina'), (req, res) => {
  return res.json({ ok: true, orders });
});

// Cliente / admin ven solo "mis pedidos"
app.get('/api/orders/mine', ensureRole('cliente', 'admin'), (req, res) => {
  const mine = orders.filter(o => o.createdBy === req.session.user.username);
  res.json({ ok: true, orders: mine });
});

// Personal de servicio ve sus eventos asignados
app.get('/api/orders/asignados', ensureRole('personal', 'admin'), (req, res) => {
  const username = req.session.user.username;
  const asignados = orders.filter(o => (o.personalAsignado || []).includes(username));
  res.json({ ok: true, orders: asignados });
});

// VENTAS: confirma el pedido (coordina detalles + registra adelanto requerido)
app.post('/api/orders/:id/confirmar-ventas', ensureRole('ventas', 'admin'), (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (order.status !== 'pendiente') return res.status(400).json({ error: 'El pedido ya fue procesado' });

  const { lugar, requerimientosEspeciales, montoAdelanto } = req.body || {};
  if (lugar) order.clientInfo.lugar = lugar;
  if (requerimientosEspeciales) order.clientInfo.requerimientosEspeciales = requerimientosEspeciales;

  const total = order.cart.reduce((s, it) => s + Number(it.price) * Number(it.qty || 1), 0) * 1.18;
  const adelanto = montoAdelanto ? Number(montoAdelanto) : Math.round(total * 0.3 * 100) / 100;

  order.pago.adelantoRequerido = adelanto;
  order.status = 'confirmado';
  order.historial.push({ evento: `Confirmado por Ventas (${req.session.user.username}). Adelanto requerido: S/${adelanto}`, fecha: new Date().toISOString() });
  res.json({ ok: true, order });
});

// Cliente registra el pago del adelanto (simulado), eligiendo método de pago
app.post('/api/orders/:id/pagar-adelanto', ensureRole('cliente', 'admin'), (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (order.createdBy !== req.session.user.username && req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'No autorizado' });
  }
  if (order.status !== 'confirmado') return res.status(400).json({ error: 'El pedido aún no ha sido confirmado por Ventas' });

  const { metodoPago, numeroTarjeta, numeroYape } = req.body || {};
  if (!['tarjeta', 'yape'].includes(metodoPago)) {
    return res.status(400).json({ error: 'Selecciona un método de pago válido (tarjeta o Yape)' });
  }

  if (metodoPago === 'tarjeta') {
    const limpio = (numeroTarjeta || '').replace(/\s/g, '');
    if (!/^\d{16}$/.test(limpio)) {
      return res.status(400).json({ error: 'Número de tarjeta inválido (deben ser 16 dígitos)' });
    }
  }
  if (metodoPago === 'yape') {
    if (!/^9\d{8}$/.test(numeroYape || '')) {
      return res.status(400).json({ error: 'Número de Yape inválido (9 dígitos, debe iniciar con 9)' });
    }
  }

  const numeroOperacion = (metodoPago === 'yape' ? 'YP-' : 'TC-') + Math.floor(100000 + Math.random() * 900000);

  order.pago.adelantoPagado = true;
  order.pago.montoAdelanto = order.pago.adelantoRequerido;
  order.pago.metodoPago = metodoPago;
  order.pago.numeroOperacion = numeroOperacion;
  order.status = 'pago_confirmado';
  order.historial.push({ evento: `Adelanto de S/${order.pago.montoAdelanto} pagado vía ${metodoPago === 'yape' ? 'Yape' : 'Tarjeta'} (Op. ${numeroOperacion})`, fecha: new Date().toISOString() });
  res.json({ ok: true, order });
});

// LOGÍSTICA: acepta/rechaza el pedido, validando capacidad operativa
app.post('/api/orders/:id/status', ensureRole('logistica', 'admin'), (req, res) => {
  const { status } = req.body || {};
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (!status) return res.status(400).json({ error: 'Estado requerido' });

  if (status === 'aceptado') {
    if (order.status !== 'pago_confirmado') {
      return res.status(400).json({ error: 'No se puede aceptar: falta confirmación de Ventas o pago de adelanto' });
    }
    const ocupacion = ocupacionFecha(order.clientInfo.fecha);
    if (ocupacion.excedeEventos || ocupacion.excedeVajilla || ocupacion.excedePersonal) {
      return res.status(409).json({
        error: 'Capacidad operativa excedida para esta fecha. Revisa el panel de capacidad antes de aceptar.',
        ocupacion
      });
    }
  }

  order.status = status;
  order.historial.push({ evento: `Estado cambiado a "${status}" por Logística`, fecha: new Date().toISOString() });
  return res.json({ ok: true, order });
});

// COCINA: actualiza estado de producción
app.post('/api/orders/:id/produccion', ensureRole('cocina', 'admin'), (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (order.status !== 'aceptado' && order.status !== 'en_preparacion') {
    return res.status(400).json({ error: 'El pedido no está habilitado para producción' });
  }
  const { campo } = req.body || {};
  if (!['insumosRecibidos', 'enPreparacion', 'listoDespacho', 'controlCalidad'].includes(campo)) {
    return res.status(400).json({ error: 'Campo inválido' });
  }
  order.produccion[campo] = true;
  if (campo === 'enPreparacion') order.status = 'en_preparacion';
  if (campo === 'listoDespacho') order.status = 'listo_despacho';
  order.historial.push({ evento: `Cocina actualizó: ${campo}`, fecha: new Date().toISOString() });
  res.json({ ok: true, order });
});

// LOGÍSTICA: coordina transporte y marca entrega
app.post('/api/orders/:id/transporte', ensureRole('logistica', 'admin'), (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
  const { vehiculo, horarioSalida, marcarEnRuta, marcarEntregado } = req.body || {};
  if (vehiculo) order.transporte.vehiculo = vehiculo;
  if (horarioSalida) order.transporte.horarioSalida = horarioSalida;
  if (marcarEnRuta) { order.status = 'en_ruta'; order.historial.push({ evento: 'Pedido despachado, en ruta', fecha: new Date().toISOString() }); }
  if (marcarEntregado) {
    order.status = 'entregado';
    order.transporte.entregado = true;
    order.historial.push({ evento: 'Pedido entregado en el evento', fecha: new Date().toISOString() });
  }
  res.json({ ok: true, order });
});

// LOGÍSTICA: registra el retorno de equipos físicos y mermas
app.post('/api/orders/:id/retorno-equipos', ensureRole('logistica', 'admin'), (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (order.status !== 'entregado') return res.status(400).json({ error: 'El pedido aún no ha sido entregado' });
  const { vajillaDevuelta, manteleriaDevuelta, samovaresDevueltos, mermas } = req.body || {};
  order.retornoEquipos = {
    vajillaDevuelta: Number(vajillaDevuelta || 0),
    manteleriaDevuelta: Number(manteleriaDevuelta || 0),
    samovaresDevueltos: Number(samovaresDevueltos || 0),
    mermas: mermas || '',
    fecha: new Date().toISOString(),
    registradoPor: req.session.user.username
  };
  order.status = 'cerrado';
  order.historial.push({ evento: 'Retorno de equipos registrado. Pedido cerrado.', fecha: new Date().toISOString() });
  res.json({ ok: true, order });
});

// ADMIN/VENTAS: asigna personal de servicio a un pedido
app.post('/api/orders/:id/asignar-personal', ensureRole('admin', 'ventas'), (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
  const { username } = req.body || {};
  const user = users.get((username || '').toLowerCase());
  if (!user || user.role !== 'personal') return res.status(400).json({ error: 'Usuario de personal de servicio inválido' });
  if (!order.personalAsignado.includes(user.username)) order.personalAsignado.push(user.username);
  order.historial.push({ evento: `Personal asignado: ${user.username}`, fecha: new Date().toISOString() });
  res.json({ ok: true, order });
});

app.post('/api/orders/:id/quitar-personal', ensureRole('admin', 'ventas'), (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
  const { username } = req.body || {};
  order.personalAsignado = order.personalAsignado.filter(u => u !== username);
  res.json({ ok: true, order });
});

// CLIENTE: solicita cambio o cancelación (regla: bloqueado si faltan <7 días)
app.post('/api/orders/:id/solicitar-cambio', ensureRole('cliente', 'admin'), (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (order.createdBy !== req.session.user.username && req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'No autorizado' });
  }
  if (['entregado', 'cerrado', 'cancelado', 'rechazado'].includes(order.status)) {
    return res.status(400).json({ error: 'Este pedido ya no admite cambios' });
  }
  const dias = diasHasta(order.clientInfo.fecha);
  const { tipo, detalle } = req.body || {};
  if (!tipo || !['cambio', 'cancelacion'].includes(tipo)) return res.status(400).json({ error: 'Tipo de solicitud inválido' });

  if (dias < 7) {
    return res.status(409).json({
      error: 'No se permiten cambios ni cancelaciones con menos de 1 semana de anticipación, ya que Cocina ya pudo haber comprado los insumos.',
      diasRestantes: dias
    });
  }

  order.solicitudCambio = {
    tipo, detalle: detalle || '', estado: 'pendiente',
    fechaSolicitud: new Date().toISOString(), diasAnticipacion: dias
  };
  order.historial.push({ evento: `Cliente solicitó ${tipo}`, fecha: new Date().toISOString() });
  res.json({ ok: true, order });
});

// VENTAS: gestiona (aprueba/rechaza) la solicitud de cambio/cancelación
app.post('/api/orders/:id/resolver-cambio', ensureRole('ventas', 'admin'), (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (!order.solicitudCambio || order.solicitudCambio.estado !== 'pendiente') {
    return res.status(400).json({ error: 'No hay una solicitud pendiente' });
  }
  const dias = diasHasta(order.clientInfo.fecha);
  const { aprobar, motivo } = req.body || {};

  if (aprobar && dias < 7) {
    return res.status(409).json({ error: 'No se puede aprobar: faltan menos de 7 días para el evento y Cocina ya gestionó insumos.' });
  }

  order.solicitudCambio.estado = aprobar ? 'aprobado' : 'rechazado';
  order.solicitudCambio.motivo = motivo || '';
  order.solicitudCambio.fechaResolucion = new Date().toISOString();

  if (aprobar && order.solicitudCambio.tipo === 'cancelacion') {
    order.status = 'cancelado';
  }
  order.historial.push({
    evento: `Ventas ${aprobar ? 'aprobó' : 'rechazó'} la solicitud de ${order.solicitudCambio.tipo}`,
    fecha: new Date().toISOString()
  });
  res.json({ ok: true, order });
});

// Lista de ingredientes consolidada por fecha (para Cocina)
app.get('/api/produccion/ingredientes/:fecha', ensureRole('cocina', 'admin'), (req, res) => {
  const pedidosFecha = orders.filter(o =>
    o.clientInfo.fecha === req.params.fecha &&
    ['aceptado', 'en_preparacion', 'listo_despacho'].includes(o.status)
  );
  const consolidado = new Map();
  pedidosFecha.forEach(o => {
    o.requerimientos.ingredientes.forEach(ing => {
      consolidado.set(ing.nombre, (consolidado.get(ing.nombre) || 0) + ing.cantidad);
    });
  });
  res.json({
    ok: true,
    fecha: req.params.fecha,
    pedidos: pedidosFecha.map(o => o.id),
    ingredientes: Array.from(consolidado.entries()).map(([nombre, cantidad]) => ({ nombre, cantidad }))
  });
});

/* =========================================================
   SOLICITUDES DE COTIZACIÓN (independientes de un pedido)
   El cliente puede pedir un estimado de costo sin comprometerse
   a realizar el pedido. Ventas las revisa y da seguimiento.
   ========================================================= */
let cotizacionesSolicitadas = [];
let nextCotizacionId = 1;

app.post('/api/cotizaciones', (req, res) => {
  const { nombre, telefono, evento, fecha, persons, servicios } = req.body || {};
  if (!nombre || !evento || !persons || !servicios || !Array.isArray(servicios) || servicios.length === 0) {
    return res.status(400).json({ error: 'Datos incompletos para calcular la cotización' });
  }

  let subtotal = 0;
  const detalle = servicios.map(s => {
    const def = menu.find(m => m.id === s.id || m.nombre === s.nombre);
    if (!def) return null;
    const qty = Number(s.qty || 1);
    const sub = def.precio * qty;
    subtotal += sub;
    return { nombre: def.nombre, precioUnitario: def.precio, qty, subtotal: sub };
  }).filter(Boolean);

  if (detalle.length === 0) return res.status(400).json({ error: 'Servicios inválidos' });

  const igv = Math.round(subtotal * 0.18 * 100) / 100;
  const total = Math.round((subtotal + igv) * 100) / 100;

  const cotizacion = {
    id: 'COT' + String(nextCotizacionId++).padStart(3, '0'),
    nombre,
    telefono: telefono || '',
    evento,
    fecha: fecha || '',
    persons: Number(persons),
    detalle,
    subtotal,
    igv,
    total,
    estado: 'nueva',
    creadoPor: req.session.user ? req.session.user.username : 'anónimo',
    creadoEn: new Date().toISOString()
  };
  cotizacionesSolicitadas.push(cotizacion);
  res.json({ ok: true, cotizacion });
});

app.get('/api/cotizaciones', ensureRole('ventas', 'admin'), (req, res) => {
  res.json({ ok: true, cotizaciones: cotizacionesSolicitadas });
});

app.post('/api/cotizaciones/:id/atender', ensureRole('ventas', 'admin'), (req, res) => {
  const cot = cotizacionesSolicitadas.find(c => c.id === req.params.id);
  if (!cot) return res.status(404).json({ error: 'No encontrada' });
  cot.estado = 'atendida';
  cot.atendidoPor = req.session.user.username;
  cot.notas = (req.body || {}).notas || '';
  res.json({ ok: true, cotizacion: cot });
});

/* =========================================================
   INCIDENCIAS (Administrador)
   ========================================================= */
let incidencias = [];
let nextIncidenciaId = 1;

app.get('/api/incidencias', ensureRole('admin', 'ventas', 'logistica', 'cocina'), (req, res) => {
  res.json({ ok: true, incidencias });
});

app.post('/api/incidencias', ensureRole('admin', 'ventas', 'logistica', 'cocina'), (req, res) => {
  const { orderId, descripcion, gravedad } = req.body || {};
  if (!descripcion) return res.status(400).json({ error: 'Descripción requerida' });
  const incidencia = {
    id: 'I' + String(nextIncidenciaId++).padStart(3, '0'),
    orderId: orderId || null,
    descripcion,
    gravedad: gravedad || 'media',
    estado: 'abierta',
    reportadoPor: req.session.user.username,
    fecha: new Date().toISOString()
  };
  incidencias.push(incidencia);
  res.json({ ok: true, incidencia });
});

app.post('/api/incidencias/:id/resolver', ensureRole('admin'), (req, res) => {
  const inc = incidencias.find(i => i.id === req.params.id);
  if (!inc) return res.status(404).json({ error: 'No encontrada' });
  inc.estado = 'resuelta';
  inc.resolucion = (req.body || {}).resolucion || '';
  res.json({ ok: true, incidencia: inc });
});
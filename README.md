# Elite Catering — Sistema de Gestión Integral (Prototipo)

Sistema web para la gestión completa de un negocio de catering: desde la cotización
del cliente hasta la entrega del servicio y el retorno de equipos, cubriendo los
6 roles definidos en el proceso de negocio.

## Instalación y ejecución

```bash
npm install
npm start
```

El servidor levanta en `http://localhost:3000` y sirve tanto el frontend (HTML/CSS)
como la API REST (`/api/...`).

## Roles y credenciales de prueba

| Rol                          | Usuario      | Contraseña | Panel principal          |
|-------------------------------|--------------|------------|---------------------------|
| Cliente                       | (regístrate) | —          | `index.html` / `catalogo.html` |
| Ejecutivo de Ventas            | `ventas`     | `222`      | `ventas.html`             |
| Logística / Distribución      | `logistica`  | `333`      | `logistica.html`          |
| Cocina / Producción            | `cocina`     | `444`      | `cocina.html`             |
| Personal de Servicio (mozo)   | `personal`   | `555`      | `personal.html`           |
| Administrador / Jefe de Ops   | `admin`      | `111`      | `menu.html`               |

Los clientes se registran libremente desde `registro.html`. El administrador puede
crear nuevas cuentas de Ventas, Logística, Cocina o Personal desde su panel
(pestaña **Usuarios y Clientes**).

## Flujo del pedido (estado por estado)

1. **Cliente**: consulta el catálogo, completa los datos del evento y arma su
   cotización (`catalogo.html` → `carrito.html` → `cotizacion.html`). Al confirmar,
   el pedido se crea con estado **`pendiente`**.
2. **Ventas** (`ventas.html`): revisa la solicitud, coordina el lugar y
   requerimientos especiales del evento, y confirma el pedido (calculando el
   adelanto requerido, 30% del total por defecto). Estado pasa a **`confirmado`**.
3. **Cliente**: paga el adelanto desde `seguimiento.html`, eligiendo entre
   **Tarjeta de crédito/débito** o **Yape** (pago simulado, con número de
   operación generado automáticamente). Estado pasa a **`pago_confirmado`**.
4. **Logística** (`logistica.html`): evalúa la disponibilidad real (el sistema
   alerta automáticamente si la fecha excede el límite de eventos, vajilla o
   personal configurado) y acepta o rechaza el pedido. Estado: **`aceptado`** o
   **`rechazado`**.
5. **Cocina** (`cocina.html`): ve la lista de ingredientes calculada
   automáticamente (según el menú y la cantidad de personas) y actualiza el
   estado de producción: insumos recibidos → en preparación → control de
   calidad → listo para despacho. Estados: **`en_preparacion`** →
   **`listo_despacho`**.
6. **Logística**: coordina transporte (vehículo, horario), despacha
   (**`en_ruta`**) y marca la entrega en el evento (**`entregado`**). Luego
   registra el retorno de vajilla, mantelería, samovares y reporta mermas o
   roturas, cerrando el pedido (**`cerrado`**).
7. **Personal de Servicio** (`personal.html`): en cualquier momento puede
   consultar los eventos en los que Ventas/Admin lo asignaron, con fecha,
   horario y lugar.
8. **Cliente**: en cualquier momento (mínimo 7 días antes del evento) puede
   solicitar un cambio o cancelación desde `seguimiento.html`. Ventas aprueba o
   rechaza esa solicitud; el sistema bloquea automáticamente la aprobación si
   faltan menos de 7 días, ya que Cocina pudo haber comprado los insumos.

## Solicitar cotización (sin hacer un pedido)

Desde `cotizacion.html` (enlazada como "💬 Cotizar" en la barra superior), cualquier
visitante —sin necesidad de iniciar sesión— puede elegir servicios y cantidad de
personas y obtener un estimado instantáneo (subtotal, IGV y total), sin que esto
cree un pedido formal. La solicitud queda registrada como un *lead* que Ventas
revisa en la pestaña **"Leads de Cotización"** de su panel, para hacer
seguimiento y asesorar al interesado. Si la persona decide continuar, puede
convertir esa cotización en un pedido real con un solo clic, lo que carga el
carrito automáticamente.

## Administrador

Desde `menu.html` el administrador supervisa todo el proceso:
- Dashboard general (clientes, pedidos por etapa).
- Gestión de usuarios (crea cuentas de staff).
- **Capacidad operativa**: configura el máximo de eventos/día, vajilla y
  personal disponible, y consulta la ocupación de cualquier fecha.
- **Proveedores externos**: registra proveedores y su costo por servicio.
- **Incidencias**: cualquier área puede reportar una incidencia; el admin la
  resuelve.
- **Personal de servicio**: vista consolidada de qué mozo está asignado a qué
  evento.
- Accesos directos a los paneles de Ventas, Logística y Cocina (el admin tiene
  permiso para entrar a los tres).

## Endpoints principales de la API

- `POST /api/login`, `POST /api/register`, `GET /api/session`, `POST /api/logout`
- `GET /api/menu` — catálogo de servicios (con ingredientes y requerimientos
  para roles internos)
- `GET/POST/DELETE /api/proveedores`
- `GET/PUT /api/capacidad`, `GET /api/capacidad/:fecha`
- `POST /api/orders` — crear pedido (cliente)
- `GET /api/orders` (staff) / `GET /api/orders/mine` (cliente) / `GET /api/orders/asignados` (personal)
- `POST /api/orders/:id/confirmar-ventas`
- `POST /api/orders/:id/pagar-adelanto`
- `POST /api/orders/:id/status` (aceptar/rechazar — Logística)
- `POST /api/orders/:id/produccion` (Cocina)
- `POST /api/orders/:id/transporte`, `POST /api/orders/:id/retorno-equipos`
- `POST /api/orders/:id/asignar-personal`
- `POST /api/orders/:id/solicitar-cambio`, `POST /api/orders/:id/resolver-cambio`
- `GET /api/produccion/ingredientes/:fecha`
- `POST /api/cotizaciones` (público) — solicitar estimado sin crear pedido
- `GET /api/cotizaciones`, `POST /api/cotizaciones/:id/atender` (Ventas)
- `GET/POST /api/incidencias`, `POST /api/incidencias/:id/resolver`
- `GET/POST /api/users` (admin)

## Nota

Este es un prototipo académico (datos en memoria, sin persistencia en base de
datos real, pagos simulados). No usar en producción sin mejoras de seguridad,
persistencia y validaciones adicionales.
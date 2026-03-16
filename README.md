# Fix It - Ecommerce y sistema de stock
---

Proyecto para cliente, ecommerce + sistema de stock, ventas y mini mercado: frontend (React + Vite + TypeScript) y backend/API (Python + FastAPI)

---

## Estructura del repositorio
---

raucan-repo/
├── client/          # Frontend (React + Vite + TS)
│   └── src/
│       ├── components/   # Componentes reutilizables
│       ├── pages/       # Páginas/vistas
│       ├── services/    # Llamadas a la API (api.ts)
│       ├── hooks/       # Hooks de React
│       └── types/       # Tipos TypeScript (Producto, etc.)
├── src/             # Backend + API (Python + FastAPI)
│   └── app/
│       ├── main.py      # Entrada, CORS, rutas
│       ├── db.py        # Conexión a la base de datos
│       ├── routers/     # Rutas (endpoints por recurso)
│       ├── services/    # Lógica de negocio
│       ├── models/      # Modelos de base de datos (ORM)
│       └── schemas/     # Schemas Pydantic
└── README.md





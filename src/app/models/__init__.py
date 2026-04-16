# Importar todos los modelos para que Base.metadata los conozca y se creen las tablas
# Orden: primero entidades sin FK, luego las que dependen de ellas
#
# ALCANCE: Rol, Usuario, CategoriaProducto, Producto, Pedido, DetallePedido, Pago
#   → los usa el COMPAÑERO (auth, catálogo, carrito/pedido/pago). Nosotros solo los referenciamos por FK.
# Resto de modelos → nuestros módulos (inventario equipos, marketplace, reparaciones, canje).
#
from app.models.roles import Rol
from app.models.usuarios import Usuario
from app.models.carrito import Carrito, CarritoDetalle
from app.models.equipos import ModeloEquipo, Equipo, Equipos, EquipoUsadoDetalle
from app.models.sesiones_login import SesionesLogin as SesionLogin
from app.models.deposito import Deposito, EquipoDeposito
from app.models.productos import CategoriaProducto, Productos
from app.models.accesorios import Accesorios  # noqa: F401 - debe cargarse tras Productos para resolver relationship
from app.models.pedido import Pedido, DetallePedido, Pago
from app.models.reparacion import TipoReparacion, ListaPrecioReparacion, Reparacion
from app.models.canje import ModeloCanje, EquipoOfrecidoCanje, SolicitudCanje, CotizacionCanje
from app.models.publicacion import Publicacion, RevisionPublicacion

__all__ = [
    "Rol",
    "Usuario",
    "Carrito",
    "CarritoDetalle",
    "ModeloEquipo",
    "Equipo",
    "Equipos",
    "EquipoUsadoDetalle",
    "Deposito",
    "EquipoDeposito",
    "CategoriaProducto",
    "Productos",
    "Accesorios",
    "Pedido",
    "DetallePedido",
    "Pago",
    "TipoReparacion",
    "ListaPrecioReparacion",
    "Reparacion",
    "ModeloCanje",
    "EquipoOfrecidoCanje",
    "SolicitudCanje",
    "CotizacionCanje",
    "Publicacion",
    "RevisionPublicacion",
]

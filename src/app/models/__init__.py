# Importar todos los modelos para que Base.metadata los conozca y se creen las tablas
# Orden: primero entidades sin FK, luego las que dependen de ellas
#
# ALCANCE: Rol, Usuario, SesionLogin, CategoriaProducto, Producto, Pedido, DetallePedido, Pago
#   → los usa el COMPAÑERO (auth, catálogo, carrito/pedido/pago). Nosotros solo los referenciamos por FK.
# Resto de modelos → nuestros módulos (inventario equipos, marketplace, reparaciones, canje).
#
from app.models.rol import Rol, Usuario, SesionLogin
from app.models.equipos import ModeloEquipo, Equipos, EquipoUsadoDetalle
from app.models.deposito import Deposito, EquipoDeposito
from app.models.productos import CategoriaProducto, Productos
from app.models.pedido import Pedido, DetallePedido, Pago
from app.models.reparacion import TipoReparacion, Reparacion
from app.models.canje import EquipoOfrecidoCanje, SolicitudCanje
from app.models.publicacion import Publicacion, RevisionPublicacion

__all__ = [
    "Rol",
    "Usuario",
    "SesionLogin",
    "ModeloEquipo",
    "Equipos",
    "EquipoUsadoDetalle",
    "Deposito",
    "EquipoDeposito",
    "CategoriaProducto",
    "Productos",
    "Pedido",
    "DetallePedido",
    "Pago",
    "TipoReparacion",
    "Reparacion",
    "EquipoOfrecidoCanje",
    "SolicitudCanje",
    "Publicacion",
    "RevisionPublicacion",
]

/**
 * Query keys y hooks centralizados de React Query.
 * Importar desde acá para mantener consistencia en las claves de cache.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { marketplaceApi } from '../services/marketplaceApi'
import { inventarioApi } from '../services/inventarioApi'
import { productosApi } from '../services/productosApi'
import { carritoApi } from '../services/carritoApi'

// ─── Query keys ──────────────────────────────────────────────────────────────

export const qk = {
  dolar: ['dolar', 'blue'] as const,

  productos: {
    catalogoTienda: ['productos', 'catalogoTienda'] as const,
    detalle: (id: number) => ['productos', 'detalle', id] as const,
  },

  carrito: {
    mercadoPagoEstado: ['carrito', 'mercadoPagoEstado'] as const,
  },

  pedidos: {
    pendientes: ['pedidos', 'pendientes'] as const,
    entrega:    ['pedidos', 'entrega'] as const,
  },

  marketplace: {
    publicaciones: ['marketplace', 'publicaciones'] as const,
    intereses:     ['marketplace', 'intereses'] as const,
  },

  inventario: {
    modelos:           ['inventario', 'modelos'] as const,
    equipos:           ['inventario', 'equipos'] as const,
    equiposUsados:     ['inventario', 'equiposUsados'] as const,
  },
}

// ─── Dólar blue ──────────────────────────────────────────────────────────────

async function fetchDolarBlue(): Promise<{ venta: number; fechaActualizacion: string | null }> {
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/blue')
    if (!res.ok) throw new Error()
    const data = (await res.json()) as { venta?: number; fechaActualizacion?: string }
    if (typeof data.venta === 'number' && data.venta > 0) {
      return { venta: data.venta, fechaActualizacion: data.fechaActualizacion ?? null }
    }
  } catch { /* silencioso */ }
  return { venta: 1100, fechaActualizacion: null }
}

export function useDolarBlue() {
  return useQuery({
    queryKey: qk.dolar,
    queryFn: fetchDolarBlue,
    staleTime: 10 * 60 * 1000, // cotización: 10 min
  })
}

// ─── Catálogo / productos ────────────────────────────────────────────────────

/** Catálogo de tienda. Cachea entre navegaciones: volver a /tienda no re-pega al backend. */
export function useCatalogoTienda() {
  return useQuery({
    queryKey: qk.productos.catalogoTienda,
    queryFn: () => productosApi.listTiendaCatalogoWithFallback(),
    staleTime: 2 * 60 * 1000, // el catálogo cambia poco entre visitas
  })
}

/** Detalle de producto. `enabled` evita disparar la query con un id inválido. */
export function useProductoDetalle(idProducto: number | null) {
  return useQuery({
    queryKey: qk.productos.detalle(idProducto ?? -1),
    queryFn: () => productosApi.get(idProducto as number),
    enabled: idProducto !== null && Number.isFinite(idProducto),
    staleTime: 2 * 60 * 1000,
  })
}

/** Flag de configuración de Mercado Pago: es estático, no tiene sentido pedirlo en cada montaje. */
export function useMercadoPagoEstado() {
  return useQuery({
    queryKey: qk.carrito.mercadoPagoEstado,
    queryFn: () => carritoApi.mercadoPagoEstado(),
    staleTime: 30 * 60 * 1000,
    retry: 0,
  })
}

// Nota: las queries de pedidos admin viven en `pages/admin/PedidosPage` porque su
// tipo `Pedido` es local a esa página; acá quedan solo las claves (`qk.pedidos`)
// para que la invalidación sea consistente.

// ─── Marketplace ─────────────────────────────────────────────────────────────

export function usePublicaciones() {
  return useQuery({
    queryKey: qk.marketplace.publicaciones,
    queryFn: () => marketplaceApi.publicaciones.list(0, 100, null),
    staleTime: 60 * 1000,
  })
}

export function useIntereses() {
  return useQuery({
    queryKey: qk.marketplace.intereses,
    queryFn: () => marketplaceApi.intereses.list(0, 100),
    staleTime: 60 * 1000,
  })
}

export function useCambiarEstadoPublicacion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: string }) =>
      marketplaceApi.publicaciones.patch(id, { estado }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.marketplace.publicaciones })
    },
  })
}

export function useEliminarPublicacion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => marketplaceApi.publicaciones.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.marketplace.publicaciones })
    },
  })
}

export function useEditarPublicacion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      marketplaceApi.publicaciones.patch(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.marketplace.publicaciones })
    },
  })
}

// ─── Inventario ──────────────────────────────────────────────────────────────

export function useModelos() {
  return useQuery({
    queryKey: qk.inventario.modelos,
    queryFn: () => inventarioApi.modelos.list(0, 100),
    staleTime: 5 * 60 * 1000, // modelos cambian poco: 5 min
  })
}

export function useEquipos() {
  return useQuery({
    queryKey: qk.inventario.equipos,
    queryFn: () => inventarioApi.equipos.list(0, 100),
    staleTime: 60 * 1000,
  })
}

export function useEquiposUsadosDetalle() {
  return useQuery({
    queryKey: qk.inventario.equiposUsados,
    queryFn: () => inventarioApi.equiposUsadosDetalle.list(0, 100),
    staleTime: 60 * 1000,
  })
}

export function useToggleActivoEquipo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) =>
      inventarioApi.equipos.patch(id, { activo }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.inventario.equipos })
      void queryClient.invalidateQueries({ queryKey: qk.inventario.equiposUsados })
    },
  })
}

export function useEliminarEquipoUsado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ idDetalle, idEquipo }: { idDetalle: number; idEquipo: number }) => {
      await inventarioApi.equiposUsadosDetalle.delete(idDetalle)
      await inventarioApi.equipos.delete(idEquipo)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.inventario.equipos })
      void queryClient.invalidateQueries({ queryKey: qk.inventario.equiposUsados })
    },
  })
}

export function useEliminarFotoEquipo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (idEquipo: number) => inventarioApi.equipos.deleteFoto(idEquipo),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.inventario.equipos })
    },
  })
}

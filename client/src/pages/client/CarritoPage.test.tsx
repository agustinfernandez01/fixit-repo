import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CarritoPage from './CarritoPage'

const mockEnsure = vi.fn()
const mockSummary = vi.fn()
const mockCheckout = vi.fn()

vi.mock('../../lib/auth', () => ({
  getAccessToken: vi.fn(() => 'token-demo'),
}))

vi.mock('../../services/carritoApi', () => ({
  carritoApi: {
    ensure: (...args: unknown[]) => mockEnsure(...args),
    summary: (...args: unknown[]) => mockSummary(...args),
    checkout: (...args: unknown[]) => mockCheckout(...args),
    updateItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
}))

beforeEach(() => {
  mockEnsure.mockResolvedValue({ id: 1 })
  mockSummary.mockResolvedValue({
    carrito: {
      id: 1,
      id_usuario: 1,
      id_pedido: null,
      token_identificador: 't1',
      estado: true,
      fecha_creacion: new Date().toISOString(),
    },
    items: [
      {
        id: 10,
        id_carrito: 1,
        id_producto: 22,
        cant: 1,
        precio_unitario: '1000.00',
        subtotal: '1000.00',
        producto: {
          id: 22,
          nombre: 'iPhone 14',
          precio: '1000.00',
          activo: true,
          tipo_producto: 'equipo',
          id_origen: 5,
        },
      },
    ],
    total_unidades: 1,
    total_importe: '1000.00',
  })
  mockCheckout.mockResolvedValue({
    id_pedido: 55,
    id_pago: 77,
    estado_pedido: 'pendiente_confirmacion',
    estado_pago: 'pendiente',
    referencia_externa: 'LOCAL-55',
    whatsapp_url: 'https://wa.me/5493816226300?text=hola',
    total: '1000.00',
    mensaje: 'Pedido generado',
  })
})

describe('CarritoPage checkout', () => {
  it('redirige a WhatsApp al confirmar compra', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    render(
      <MemoryRouter>
        <CarritoPage />
      </MemoryRouter>,
    )

    const button = await screen.findByRole('button', { name: /confirmar compra/i })
    await userEvent.click(button)

    await waitFor(() => {
      expect(mockCheckout).toHaveBeenCalledTimes(1)
      expect(openSpy).toHaveBeenCalledWith('https://wa.me/5493816226300?text=hola', '_self')
    })

    openSpy.mockRestore()
  })
})

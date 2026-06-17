export type CatalogVersion = {
  label: string    // Shown in dropdown: "Pro Max", "Estándar", "3ra Gen"
  suffix: string   // Appended to model name ("" = no suffix → "iPhone 16")
  storages: number[] // GB
  colors: string[]
}

export type CatalogSeries = {
  label: string    // "16", "15", "Pro", "Air"
  prefix: string   // Used in nombre_modelo
  versions: CatalogVersion[]
}

export type CatalogFamily = {
  label: string    // "iPhone", "iPad", "MacBook"
  series: CatalogSeries[]
}

export function composeName(family: string, prefix: string, suffix: string): string {
  return [family, prefix, suffix].filter(Boolean).join(' ')
}

export function fmtStorage(gb: number): string {
  if (gb >= 1024) return `${gb / 1024} TB`
  return `${gb} GB`
}

// ─── Catálogo Apple completo ──────────────────────────────────────────────────

export const APPLE_CATALOG: CatalogFamily[] = [
  {
    label: 'iPhone',
    series: [
      {
        label: 'iPhone 16', prefix: '16',
        versions: [
          {
            label: 'Pro Max', suffix: 'Pro Max',
            storages: [256, 512, 1024],
            colors: ['Titanio Negro', 'Titanio Blanco', 'Titanio Natural', 'Titanio Desierto'],
          },
          {
            label: 'Pro', suffix: 'Pro',
            storages: [128, 256, 512, 1024],
            colors: ['Titanio Negro', 'Titanio Blanco', 'Titanio Natural', 'Titanio Desierto'],
          },
          {
            label: 'Plus', suffix: 'Plus',
            storages: [128, 256, 512],
            colors: ['Negro', 'Blanco', 'Rosa', 'Teal', 'Ultramarino'],
          },
          {
            label: 'Estándar', suffix: '',
            storages: [128, 256, 512],
            colors: ['Negro', 'Blanco', 'Rosa', 'Teal', 'Ultramarino'],
          },
        ],
      },
      {
        label: 'iPhone 15', prefix: '15',
        versions: [
          {
            label: 'Pro Max', suffix: 'Pro Max',
            storages: [256, 512, 1024],
            colors: ['Titanio Negro', 'Titanio Blanco', 'Titanio Azul', 'Titanio Natural'],
          },
          {
            label: 'Pro', suffix: 'Pro',
            storages: [128, 256, 512, 1024],
            colors: ['Titanio Negro', 'Titanio Blanco', 'Titanio Azul', 'Titanio Natural'],
          },
          {
            label: 'Plus', suffix: 'Plus',
            storages: [128, 256, 512],
            colors: ['Negro', 'Azul', 'Verde', 'Amarillo', 'Rosa'],
          },
          {
            label: 'Estándar', suffix: '',
            storages: [128, 256, 512],
            colors: ['Negro', 'Azul', 'Verde', 'Amarillo', 'Rosa'],
          },
        ],
      },
      {
        label: 'iPhone 14', prefix: '14',
        versions: [
          {
            label: 'Pro Max', suffix: 'Pro Max',
            storages: [128, 256, 512, 1024],
            colors: ['Negro Espacial', 'Dorado', 'Plateado', 'Morado Profundo'],
          },
          {
            label: 'Pro', suffix: 'Pro',
            storages: [128, 256, 512, 1024],
            colors: ['Negro Espacial', 'Dorado', 'Plateado', 'Morado Profundo'],
          },
          {
            label: 'Plus', suffix: 'Plus',
            storages: [128, 256, 512],
            colors: ['Medianoche', 'Luz de las Estrellas', 'Azul', 'Morado', 'Rojo'],
          },
          {
            label: 'Estándar', suffix: '',
            storages: [128, 256, 512],
            colors: ['Medianoche', 'Luz de las Estrellas', 'Azul', 'Morado', 'Rojo'],
          },
        ],
      },
      {
        label: 'iPhone 13', prefix: '13',
        versions: [
          {
            label: 'Pro Max', suffix: 'Pro Max',
            storages: [128, 256, 512, 1024],
            colors: ['Grafito', 'Dorado', 'Plateado', 'Azul Sierra', 'Verde Alpino'],
          },
          {
            label: 'Pro', suffix: 'Pro',
            storages: [128, 256, 512, 1024],
            colors: ['Grafito', 'Dorado', 'Plateado', 'Azul Sierra', 'Verde Alpino'],
          },
          {
            label: 'Estándar', suffix: '',
            storages: [128, 256, 512],
            colors: ['Medianoche', 'Luz de las Estrellas', 'Azul', 'Rosa', 'Verde', 'Rojo'],
          },
          {
            label: 'Mini', suffix: 'Mini',
            storages: [128, 256, 512],
            colors: ['Medianoche', 'Luz de las Estrellas', 'Azul', 'Rosa', 'Verde', 'Rojo'],
          },
        ],
      },
      {
        label: 'iPhone 12', prefix: '12',
        versions: [
          {
            label: 'Pro Max', suffix: 'Pro Max',
            storages: [128, 256, 512],
            colors: ['Grafito', 'Dorado', 'Plateado', 'Azul Pacífico'],
          },
          {
            label: 'Pro', suffix: 'Pro',
            storages: [128, 256, 512],
            colors: ['Grafito', 'Dorado', 'Plateado', 'Azul Pacífico'],
          },
          {
            label: 'Estándar', suffix: '',
            storages: [64, 128, 256],
            colors: ['Negro', 'Blanco', 'Rojo', 'Verde', 'Azul', 'Morado', 'Amarillo'],
          },
          {
            label: 'Mini', suffix: 'Mini',
            storages: [64, 128, 256],
            colors: ['Negro', 'Blanco', 'Rojo', 'Verde', 'Azul', 'Morado', 'Amarillo'],
          },
        ],
      },
      {
        label: 'iPhone 11', prefix: '11',
        versions: [
          {
            label: 'Pro Max', suffix: 'Pro Max',
            storages: [64, 256, 512],
            colors: ['Verde Medianoche', 'Dorado', 'Plateado', 'Gris Espacial'],
          },
          {
            label: 'Pro', suffix: 'Pro',
            storages: [64, 256, 512],
            colors: ['Verde Medianoche', 'Dorado', 'Plateado', 'Gris Espacial'],
          },
          {
            label: 'Estándar', suffix: '',
            storages: [64, 128, 256],
            colors: ['Negro', 'Blanco', 'Rojo', 'Amarillo', 'Morado', 'Verde'],
          },
        ],
      },
      {
        label: 'iPhone SE', prefix: 'SE',
        versions: [
          {
            label: '3ra Generación', suffix: '3ra Gen',
            storages: [64, 128, 256],
            colors: ['Medianoche', 'Luz de las Estrellas', 'Rojo'],
          },
          {
            label: '2da Generación', suffix: '2da Gen',
            storages: [64, 128, 256],
            colors: ['Negro', 'Blanco', 'Rojo'],
          },
        ],
      },
    ],
  },

  {
    label: 'iPad',
    series: [
      {
        label: 'iPad Pro', prefix: 'Pro',
        versions: [
          {
            label: '13" (M4)', suffix: '13" M4',
            storages: [256, 512, 1024, 2048],
            colors: ['Negro Espacial', 'Plateado'],
          },
          {
            label: '11" (M4)', suffix: '11" M4',
            storages: [256, 512, 1024, 2048],
            colors: ['Negro Espacial', 'Plateado'],
          },
        ],
      },
      {
        label: 'iPad Air', prefix: 'Air',
        versions: [
          {
            label: '13" (M2)', suffix: '13" M2',
            storages: [128, 256, 512, 1024],
            colors: ['Azul', 'Morado', 'Luz de las Estrellas', 'Gris Espacial'],
          },
          {
            label: '11" (M2)', suffix: '11" M2',
            storages: [128, 256, 512, 1024],
            colors: ['Azul', 'Morado', 'Luz de las Estrellas', 'Gris Espacial'],
          },
        ],
      },
      {
        label: 'iPad mini', prefix: 'mini',
        versions: [
          {
            label: '7ma Generación', suffix: '7ma Gen',
            storages: [128, 256, 512],
            colors: ['Azul', 'Morado', 'Luz de las Estrellas', 'Gris Espacial'],
          },
          {
            label: '6ta Generación', suffix: '6ta Gen',
            storages: [64, 256],
            colors: ['Gris Espacial', 'Rosa', 'Morado', 'Luz de las Estrellas'],
          },
        ],
      },
      {
        label: 'iPad', prefix: 'iPad',
        versions: [
          {
            label: '10ma Generación', suffix: '10ma Gen',
            storages: [64, 256],
            colors: ['Azul', 'Rosa', 'Plateado', 'Amarillo'],
          },
          {
            label: '9na Generación', suffix: '9na Gen',
            storages: [64, 256],
            colors: ['Gris Espacial', 'Plateado'],
          },
        ],
      },
    ],
  },

  {
    label: 'MacBook',
    series: [
      {
        label: 'MacBook Pro', prefix: 'Pro',
        versions: [
          {
            label: '16" (M4)', suffix: '16" M4',
            storages: [512, 1024, 2048, 4096],
            colors: ['Negro Espacial', 'Plateado'],
          },
          {
            label: '14" (M4)', suffix: '14" M4',
            storages: [512, 1024, 2048],
            colors: ['Negro Espacial', 'Plateado'],
          },
        ],
      },
      {
        label: 'MacBook Air', prefix: 'Air',
        versions: [
          {
            label: '15" (M3)', suffix: '15" M3',
            storages: [256, 512, 1024, 2048],
            colors: ['Medianoche', 'Luz de las Estrellas', 'Gris Espacial', 'Plateado'],
          },
          {
            label: '13" (M3)', suffix: '13" M3',
            storages: [256, 512, 1024, 2048],
            colors: ['Medianoche', 'Luz de las Estrellas', 'Gris Espacial', 'Plateado'],
          },
          {
            label: '13" (M2)', suffix: '13" M2',
            storages: [256, 512, 1024, 2048],
            colors: ['Medianoche', 'Luz de las Estrellas', 'Gris Espacial', 'Plateado'],
          },
        ],
      },
    ],
  },
]

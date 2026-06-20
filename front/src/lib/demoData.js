const baseReclamos = [
  {
    id_reclamo: 'R-0001',
    texto_original:
      'El semáforo de la Av. Principal con calle 7 lleva 3 días malogrado, los choferes pasan sin respetar y casi atropellan a un escolar esta mañana.',
    tipo: 'Infraestructura vial',
    urgencia: 'Alta',
    area: 'Municipalidad - Tránsito',
    resumen:
      'Semáforo malogrado en intersección concurrida; riesgo inmediato de accidente con escolares.',
  },
  {
    id_reclamo: 'R-0002',
    texto_original:
      'Movistar me cobra dos veces el mismo recibo desde hace 2 meses, ya reclamé por su 104 pero no responden.',
    tipo: 'Facturación duplicada',
    urgencia: 'Media',
    area: 'Osiptel - Reclamos telecomunicaciones',
    resumen:
      'Cobro duplicado recurrente de Movistar sin respuesta del operador tras múltiples reclamos.',
  },
  {
    id_reclamo: 'R-0003',
    texto_original:
      'El parque de mi barrio está lleno de basura desde el fin de semana, los recolectores no han pasado.',
    tipo: 'Limpieza pública',
    urgencia: 'Baja',
    area: 'Municipalidad - Limpieza',
    resumen:
      'Acumulación de residuos en parque vecinal por retraso de la ruta de recolección.',
  },
  {
    id_reclamo: 'R-0004',
    texto_original:
      'Compré un electrodoméstico en una tienda y se malogró a la semana, no quieren reconocer la garantía.',
    tipo: 'Garantía de producto',
    urgencia: 'Media',
    area: 'Indecopi - Protección al consumidor',
    resumen:
      'Negativa de tienda a aplicar garantía vigente sobre electrodoméstico con falla temprana.',
  },
  {
    id_reclamo: 'R-0005',
    texto_original:
      'Hay un poste de luz a punto de caerse en mi cuadra, el cableado está colgando, da miedo pasar de noche.',
    tipo: 'Riesgo eléctrico',
    urgencia: 'Alta',
    area: 'Municipalidad - Defensa Civil',
    resumen:
      'Poste con cableado suelto representa peligro estructural y eléctrico para transeúntes.',
  },
  {
    id_reclamo: 'R-0006',
    texto_original:
      'Mi internet de Claro Hogar se cae todos los días entre 7 y 10 pm, ya hablé tres veces con soporte.',
    tipo: 'Calidad de servicio',
    urgencia: 'Media',
    area: 'Osiptel - Reclamos telecomunicaciones',
    resumen:
      'Interrupciones recurrentes del servicio de internet en horario pico sin solución del operador.',
  },
]

export const demoReclamos = baseReclamos

let revealed = 0

export function nextDemoBatch() {
  revealed = Math.min(revealed + 2, demoReclamos.length)
  return demoReclamos.slice(0, revealed)
}

export function resetDemoBatch() {
  revealed = 0
}

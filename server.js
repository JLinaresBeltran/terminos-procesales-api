/**
 * Servidor de términos procesales administrativos para n8n
 * Versión simplificada y refactorizada
 */

const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Configuración básica
app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'JSON inválido en la petición', detalle: err.message });
  }
  next();
});

// Tipos de acciones - Utilizando Object.freeze para inmutabilidad
const TIPOS_ACCIONES = Object.freeze({
  PETICION: 'PETICION', 
  PETICION_INFO: 'PETICION_INFO', 
  CONSULTA: 'CONSULTA', 
  QUEJA: 'QUEJA', 
  RECLAMO: 'RECLAMO', 
  REPOSICION: 'REPOSICION', 
  APELACION: 'APELACION', 
  RECURSO_QUEJA: 'RECURSO_QUEJA', 
  TUTELA: 'TUTELA', 
  NULIDAD: 'NULIDAD', 
  NULIDAD_RESTABLECIMIENTO: 'NULIDAD_RESTABLECIMIENTO', 
  CUMPLIMIENTO: 'CUMPLIMIENTO'
});

// Descripciones comunes - Centralizado
const DESCRIPCIONES = Object.freeze({
  silencioPositivo: 'El silencio administrativo positivo en servicios públicos domiciliarios: ' +
    'Se configura automáticamente cuando la empresa no responde una PQR en los 15 días hábiles establecidos. ' +
    'No requiere elevar a escritura pública ni procedimientos especiales. ' +
    'La empresa debe reconocer sus efectos dentro de las 72 horas siguientes al vencimiento del plazo. ' +
    'Si la empresa no reconoce los efectos, el usuario puede solicitar sanciones a la Superintendencia. ' +
    'No opera si hay práctica de pruebas o si el usuario causó la demora.',
  
  recursos: 'El recurso debe presentarse dentro de los 5 días hábiles siguientes a la notificación, contados desde el mismo día en que se accede al documento (solo aplica para correo electrónico). La empresa tiene 15 días hábiles para resolverlo, contados desde el mismo día en que se presenta el recurso, y debe reconocer los efectos del silencio administrativo positivo dentro de las 72 horas siguientes al vencimiento del plazo.'
});

// Lista condensada y ordenada de festivos en Colombia 2024-2026
const FESTIVOS = Object.freeze([
  // 2024
  "2024-01-01", "2024-01-08", "2024-03-25", "2024-03-28", "2024-03-29", 
  "2024-05-01", "2024-05-13", "2024-06-03", "2024-06-10", "2024-07-01", 
  "2024-07-20", "2024-08-07", "2024-08-19", "2024-10-14", "2024-11-04", 
  "2024-11-11", "2024-12-08", "2024-12-25",
  // 2025
  "2025-01-01", "2025-01-06", "2025-03-24", "2025-04-17", "2025-04-18", 
  "2025-05-01", "2025-06-02", "2025-06-23", "2025-06-30", 
  "2025-07-20", "2025-08-07", "2025-08-18", "2025-10-13", "2025-11-03", 
  "2025-11-17", "2025-12-08", "2025-12-25",
  // 2026
  "2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03", 
  "2026-05-01", "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29", 
  "2026-07-20", "2026-08-07", "2026-08-17", "2026-10-12", "2026-11-02", 
  "2026-11-16", "2026-12-08", "2026-12-25"
]);

/**
 * Utilidades para manejo de fechas
 */
const fechaUtils = {
  // Convierte string a fecha UTC-5 (Colombia)
  parseFechaColombia(fechaStr) {
    const [year, month, day] = fechaStr.split('-').map(num => parseInt(num, 10));
    return new Date(Date.UTC(year, month - 1, day, 17, 0, 0));
  },
  
  // Formatea fecha a YYYY-MM-DD
  formatoFecha(fecha) {
    return fecha.toISOString().split('T')[0];
  },
  
  // Valida formato de fecha YYYY-MM-DD
  isValidDate(dateString) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
    
    const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
    if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) return false;
    
    // Verificar días según mes (incluye bisiestos)
    const diasPorMes = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (this.esBisiesto(year)) diasPorMes[2] = 29;
    return day <= diasPorMes[month];
  },
  
  // Verifica si un año es bisiesto
  esBisiesto(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  },
  
  // Verifica si es fin de semana
  esFindeSemana(fecha) {
    const dia = fecha.getUTCDay();
    return dia === 0 || dia === 6; // Domingo(0) o Sábado(6)
  },
  
  // Verifica si es festivo en Colombia
  esFestivo(fecha) {
    return FESTIVOS.includes(this.formatoFecha(fecha));
  },
  
  // Verifica si es día hábil
  esDiaHabil(fecha) {
    return !this.esFindeSemana(fecha) && !this.esFestivo(fecha);
  },
  
  // Operaciones con fechas
  agregarDias(fecha, dias) {
    const resultado = new Date(fecha);
    resultado.setUTCDate(resultado.getUTCDate() + dias);
    return resultado;
  },
  
  agregarMeses(fecha, meses) {
    const resultado = new Date(fecha);
    resultado.setUTCMonth(resultado.getUTCMonth() + meses);
    return resultado;
  },
  
  // Obtiene siguiente día hábil
  obtenerSiguienteDiaHabil(fecha) {
    let resultado = new Date(fecha);
    
    do {
      resultado.setUTCDate(resultado.getUTCDate() + 1);
    } while (!this.esDiaHabil(resultado));
    
    return resultado;
  },
  
  // Agrega días hábiles
  agregarDiasHabiles(fecha, dias, empezarMismoDia = true) {
    let resultado = new Date(fecha);
    let diasAgregados = 0;
    
    // Contar primer día si es hábil y se requiere
    if (empezarMismoDia && this.esDiaHabil(resultado)) {
      diasAgregados = 1;
    }
    
    // Agregar días hábiles restantes
    while (diasAgregados < dias) {
      resultado.setUTCDate(resultado.getUTCDate() + 1);
      if (this.esDiaHabil(resultado)) {
        diasAgregados++;
      }
    }
    
    return resultado;
  },
  
  // Obtiene fecha actual Colombia YYYY-MM-DD
  obtenerFechaActualColombia() {
    const ahora = new Date();
    ahora.setUTCHours(ahora.getUTCHours() - 5); // Ajuste a Colombia
    return this.formatoFecha(ahora);
  },

  // Retorna día siguiente hábil a una fecha
  obtenerDiaSiguienteHabil(fecha) {
    let diaSiguiente = this.agregarDias(fecha, 1);
    return this.esDiaHabil(diaSiguiente) ? diaSiguiente : this.obtenerSiguienteDiaHabil(diaSiguiente);
  }
};

/**
 * Funciones base para cálculos comunes
 */
const calculosBase = {
  // Cálculo básico para peticiones generales
  peticionBase(fechaBase) {
    // Normalizar fecha base a día hábil si es necesario
    if (!fechaUtils.esDiaHabil(fechaBase)) {
      fechaBase = fechaUtils.obtenerSiguienteDiaHabil(fechaBase);
    }
    
    // Términos: 15 días hábiles + 3 días para silencio
    const fechaRespuesta = fechaUtils.agregarDiasHabiles(fechaBase, 15, true);
    const fechaReconocimientoSilencio = fechaUtils.agregarDias(fechaRespuesta, 3);
    
    return {
      fechaInicial: fechaUtils.formatoFecha(fechaBase),
      fechaLimiteRespuesta: fechaUtils.formatoFecha(fechaRespuesta),
      fechaReconocimientoSilencio: fechaUtils.formatoFecha(fechaReconocimientoSilencio),
      fundamentoJuridico: 'Artículo 158 de la Ley 142 de 1994.'
    };
  },

  // Base para recursos (reposición/apelación)
  recursoBase(fechaBase) {
    // Normalizar fecha base a día hábil si es necesario
    if (!fechaUtils.esDiaHabil(fechaBase)) {
      fechaBase = fechaUtils.obtenerSiguienteDiaHabil(fechaBase);
    }
    
    // Fecha límite para presentar el recurso: 5 días hábiles
    const fechaLimiteRecurso = fechaUtils.agregarDiasHabiles(fechaBase, 5, true);
    
    // Día siguiente hábil para iniciar presentación (solo se usa en APELACION, no en REPOSICION)
    const fechaInicialDePresentacion = fechaUtils.obtenerDiaSiguienteHabil(fechaBase);
    
    // 15 días hábiles para decisión desde la presentación
    const fechaDecision = fechaUtils.agregarDiasHabiles(fechaInicialDePresentacion, 15, true);
    
    // 3 días para reconocimiento de silencio positivo
    const fechaReconocimientoSilencio = fechaUtils.agregarDias(fechaDecision, 3);
    
    return {
      fechaInicial: fechaUtils.formatoFecha(fechaBase),
      fechaLimitePresentacion: fechaUtils.formatoFecha(fechaLimiteRecurso),
      fechaInicialDePresentacion: fechaUtils.formatoFecha(fechaInicialDePresentacion),
      fechaLimiteDecision: fechaUtils.formatoFecha(fechaDecision),
      fechaReconocimientoSilencio: fechaUtils.formatoFecha(fechaReconocimientoSilencio),
      descripcion: DESCRIPCIONES.recursos,
      fundamentoJuridico: 'Artículo 158 de la Ley 142 de 1994.'
    };
  }
};

/**
 * Calculador de términos - Implementaciones específicas por tipo de acción
 */
const calculadorTerminos = {
  // Petición general
  PETICION(fechaBase) {
    const base = calculosBase.peticionBase(fechaBase);
    return {
      ...base,
      tipo: TIPOS_ACCIONES.PETICION,
      descripcion: `El término para responder un derecho de petición general es de 15 días hábiles contados desde el mismo día de presentación. ${DESCRIPCIONES.silencioPositivo}`
    };
  },
  
  // Petición de información
  PETICION_INFO(fechaBase) {
    const base = calculosBase.peticionBase(fechaBase);
    return {
      ...base,
      tipo: TIPOS_ACCIONES.PETICION_INFO,
      descripcion: `El término para responder un derecho de petición de información es de 15 días hábiles contados desde el mismo día de presentación. ${DESCRIPCIONES.silencioPositivo}`
    };
  },
  
  // Consulta
  CONSULTA(fechaBase) {
    const base = calculosBase.peticionBase(fechaBase);
    return {
      ...base,
      tipo: TIPOS_ACCIONES.CONSULTA,
      descripcion: `El término para responder una consulta es de 15 días hábiles contados desde el mismo día de presentación. ${DESCRIPCIONES.silencioPositivo}`
    };
  },
  
  // Queja
  QUEJA(fechaBase) {
    const base = calculosBase.peticionBase(fechaBase);
    return {
      ...base,
      tipo: TIPOS_ACCIONES.QUEJA,
      descripcion: `El término para responder una queja administrativa es de 15 días hábiles contados desde el mismo día de presentación. La reclamación puede presentarse dentro de los 5 meses siguientes a la entrega de la factura. ${DESCRIPCIONES.silencioPositivo}`
    };
  },
  
  // Reclamo
  RECLAMO(fechaBase) {
    const base = calculosBase.peticionBase(fechaBase);
    return {
      ...base,
      tipo: TIPOS_ACCIONES.RECLAMO,
      descripcion: `El término para responder una reclamación es de 15 días hábiles contados desde el mismo día de presentación. La reclamación puede presentarse dentro de los 5 meses siguientes a la entrega de la factura. ${DESCRIPCIONES.silencioPositivo}`
    };
  },
  
  // Recurso de reposición - MODIFICADO según lo solicitado
  REPOSICION(fechaBase) {
    // Normalizar fecha base a día hábil si es necesario
    if (!fechaUtils.esDiaHabil(fechaBase)) {
      fechaBase = fechaUtils.obtenerSiguienteDiaHabil(fechaBase);
    }
    
    // Fecha límite para presentar el recurso: 5 días hábiles
    const fechaLimiteRecurso = fechaUtils.agregarDiasHabiles(fechaBase, 5, true);
    
    // 15 días hábiles para decisión desde la fechaLimitePresentacion (modificado según requerimiento)
    const fechaDecision = fechaUtils.agregarDiasHabiles(fechaLimiteRecurso, 15, true);
    
    // 3 días para reconocimiento de silencio positivo
    const fechaReconocimientoSilencio = fechaUtils.agregarDias(fechaDecision, 3);
    
    return {
      tipo: TIPOS_ACCIONES.REPOSICION,
      fechaInicial: fechaUtils.formatoFecha(fechaBase),
      fechaLimitePresentacion: fechaUtils.formatoFecha(fechaLimiteRecurso),
      fechaLimiteDecision: fechaUtils.formatoFecha(fechaDecision),
      fechaReconocimientoSilencio: fechaUtils.formatoFecha(fechaReconocimientoSilencio),
      descripcion: DESCRIPCIONES.recursos,
      fundamentoJuridico: 'Artículo 158 de la Ley 142 de 1994.'
    };
  },
  
  // Apelación - MODIFICADO igual que REPOSICION
  APELACION(fechaBase) {
    // Normalizar fecha base a día hábil si es necesario
    if (!fechaUtils.esDiaHabil(fechaBase)) {
      fechaBase = fechaUtils.obtenerSiguienteDiaHabil(fechaBase);
    }
    
    // Fecha límite para presentar el recurso: 5 días hábiles
    const fechaLimiteRecurso = fechaUtils.agregarDiasHabiles(fechaBase, 5, true);
    
    // 15 días hábiles para decisión desde la fechaLimitePresentacion (modificado según requerimiento)
    const fechaDecision = fechaUtils.agregarDiasHabiles(fechaLimiteRecurso, 15, true);
    
    // 3 días para reconocimiento de silencio positivo
    const fechaReconocimientoSilencio = fechaUtils.agregarDias(fechaDecision, 3);
    
    return {
      tipo: TIPOS_ACCIONES.APELACION,
      fechaInicial: fechaUtils.formatoFecha(fechaBase),
      fechaLimitePresentacion: fechaUtils.formatoFecha(fechaLimiteRecurso),
      fechaLimiteDecision: fechaUtils.formatoFecha(fechaDecision),
      fechaReconocimientoSilencio: fechaUtils.formatoFecha(fechaReconocimientoSilencio),
      descripcion: DESCRIPCIONES.recursos,
      fundamentoJuridico: 'Artículo 158 de la Ley 142 de 1994.'
    };
  },
  
  // Recurso de queja - MODIFICADO para eliminar fechaInicialDePresentacion
  RECURSO_QUEJA(fechaBase) {
    // Normalizar fecha base a día hábil si es necesario
    if (!fechaUtils.esDiaHabil(fechaBase)) {
      fechaBase = fechaUtils.obtenerSiguienteDiaHabil(fechaBase);
    }
    
    // 5 días hábiles para presentar la queja desde la fecha de rechazo
    const fechaLimiteQueja = fechaUtils.agregarDiasHabiles(fechaBase, 5, true);
    
    return {
      tipo: TIPOS_ACCIONES.RECURSO_QUEJA,
      fechaRechazoApelacion: fechaUtils.formatoFecha(fechaBase),
      fechaLimitePresentacionQueja: fechaUtils.formatoFecha(fechaLimiteQueja),
      descripcion: 'El recurso de queja es un mecanismo facultativo, procede cuando las empresas prestadoras rechazan un recurso de apelación sobre actos de negación, terminación, suspensión, corte o facturación del servicio. Debe interponerse dentro de los cinco días hábiles siguientes a la notificación del rechazo, siendo la Superintendencia de Servicios Públicos quien resuelve en quince días hábiles, plazo que puede suspenderse hasta treinta días por práctica de pruebas. Opera con efecto devolutivo (no suspende automáticamente el acto impugnado), aunque puede solicitarse la suspensión en casos de posible daño irreparable, y su resolución puede confirmar el acto, revocar lo ordenando, revisión de la apelación, o exigir subsanación de defectos procedimentales.',
      fundamentoJuridico: 'Ley 142 de 1994 como régimen especial, con aplicación subsidiaria del CPACA (Ley 1437 de 2011).'
    };
  },
  
  // Acción de tutela - MODIFICADO para eliminar fechaPresentacion
  TUTELA(fechaBase) {
    // Normalizar fecha base a día hábil si es necesario
    if (!fechaUtils.esDiaHabil(fechaBase)) {
      fechaBase = fechaUtils.obtenerSiguienteDiaHabil(fechaBase);
    }
    
    // 10 días hábiles para decisión desde la fecha base
    const fechaLimiteDecision = fechaUtils.agregarDiasHabiles(fechaBase, 10, true);
    
    // Día siguiente hábil para inicio de impugnación
    const inicioImpugnacion = fechaUtils.obtenerDiaSiguienteHabil(fechaLimiteDecision);
    
    // 3 días hábiles para impugnación
    const fechaLimiteImpugnacion = fechaUtils.agregarDiasHabiles(inicioImpugnacion, 3, true);
    
    return {
      tipo: TIPOS_ACCIONES.TUTELA,
      fechaInicial: fechaUtils.formatoFecha(fechaBase),
      fechaLimiteDecision: fechaUtils.formatoFecha(fechaLimiteDecision),
      fechaLimiteImpugnacion: fechaUtils.formatoFecha(fechaLimiteImpugnacion),
      descripcion: "La acción de tutela en el ámbito de servicios públicos colombianos constituye un mecanismo de protección que procede cuando la prestación o suspensión de servicios vulnera derechos fundamentales, especialmente en casos de suspensión de servicios esenciales a personas vulnerables, violación al derecho de petición o irregularidades administrativas. Aunque no tiene un término de caducidad específico, se aplica el criterio jurisprudencial de inmediatez con un plazo razonable aproximado de seis meses, resolviendo el juez en máximo diez días hábiles y permitiendo impugnación dentro de los tres días siguientes a la notificación. Sus efectos pueden ser determinantes: desde ordenar la reconexión inmediata de servicios, exigir respuestas de fondo a peticiones, rectificar procedimientos administrativos irregulares, hasta garantizar atención adecuada en canales digitales, siendo particularmente importante para la protección de poblaciones vulnerables.",
      fundamentoJuridico: "Articulo 86 Constitución Política de Colombia, Decreto 2591 de 1991 que reglamenta la acción de tutela."
    };
  },
  
  // Acción de nulidad
  NULIDAD(fechaBase) {
    return {
      tipo: TIPOS_ACCIONES.NULIDAD,
      descripcion: "La acción de nulidad simple en el contexto de servicios públicos es un mecanismo jurisdiccional que busca preservar la legalidad del ordenamiento jurídico verificando que los actos administrativos se ajusten a las normas vigentes. Procede principalmente contra actos administrativos de carácter general y, excepcionalmente, contra actos particulares cuando no persiga el restablecimiento de un derecho subjetivo, se trate de recuperar bienes públicos, los efectos del acto afecten gravemente el orden público, o la ley lo consagre expresamente.\nLos actos administrativos particulares pueden ser objeto de nulidad simple cuando afectan el interés de la comunidad en casos de grave afectación del orden público, político, económico (como reconocimientos ilegales de prestaciones que generan cargas fiscales insostenibles), social o ecológico. La \"teoría de los móviles y finalidades\" desarrollada por el Consejo de Estado permite esta acción cuando el acto particular compromete un interés comunitario de naturaleza e importancia superior o desborda el ámbito individual al resquebrajar el orden jurídico con proyección sobre el patrimonio nacional. También procede en casos taxativos como la recuperación de bienes de uso público o protección de intereses colectivos reconocidos por leyes especiales.\nEsta acción no está sujeta a término de caducidad, pudiendo interponerse en cualquier momento, y no requiere conciliación previa como requisito de procedibilidad. Puede ser ejercida por cualquier persona, reflejando su carácter público y su objetivo de proteger la legalidad objetiva más allá de intereses particulares, produciendo efectos exclusivamente sobre la restauración del orden jurídico en abstracto.",
      fundamentoJuridico: "Fundamento normativo\n* Código de Procedimiento Administrativo y de lo Contencioso Administrativo (Ley 1437 de 2011)\n* Jurisprudencia del Consejo de Estado, especialmente la \"teoría de móviles y finalidades\""
    };
  },
  
  // Nulidad y restablecimiento
  NULIDAD_RESTABLECIMIENTO(fechaBase) {
    // Obtener la fecha en formato YYYY-MM-DD
    const fechaBaseString = fechaUtils.formatoFecha(fechaBase);
    
    // Extraer componentes de la fecha
    const [year, month, day] = fechaBaseString.split('-').map(num => parseInt(num, 10));
    
    // Calcular día siguiente
    const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
    const inicioTerminoString = fechaUtils.formatoFecha(nextDate);
    
    // Calcular fecha de caducidad (4 meses después)
    const caducidadDate = new Date(nextDate);
    caducidadDate.setUTCMonth(caducidadDate.getUTCMonth() + 4);
    
    // Ajustar para meses con menos días
    const dayInMonth = nextDate.getUTCDate();
    const lastDayInCaducidadMonth = new Date(Date.UTC(
      caducidadDate.getUTCFullYear(), 
      caducidadDate.getUTCMonth() + 1, 
      0
    )).getUTCDate();
    
    if (dayInMonth > lastDayInCaducidadMonth) {
      caducidadDate.setUTCDate(lastDayInCaducidadMonth);
    }
    
    const fechaCaducidadString = fechaUtils.formatoFecha(caducidadDate);
    
    return {
      tipo: TIPOS_ACCIONES.NULIDAD_RESTABLECIMIENTO,
      inicioTerminoDeLaAccion: inicioTerminoString,
      fechaCaducidad: fechaCaducidadString,
      descripcion: 'La acción de nulidad y restablecimiento del derecho en servicios públicos domiciliarios es un mecanismo judicial que permite a los usuarios controvertir actos administrativos que afectan sus derechos, contando con un término general de caducidad de cuatro meses desde la notificación del acto, aunque, excepcionalmente y bajo unas condiciones especificas, para prestaciones periódicas, pueden interponerse en cualquier tiempo. Este proceso requiere conciliación extrajudicial como requisito obligatorio, cuya solicitud suspende el término de caducidad hasta su culminación, ya sea por acuerdo, expedición de constancias o transcurso de tres meses.',
      fundamentoJuridico: 'CPACA (Ley 1437 de 2011), Art. 138.'
    };
  },
  
  // Acción de cumplimiento - MODIFICADO según requerimientos
  CUMPLIMIENTO(fechaBase) {
    // Normalizar fecha base a día hábil si es necesario
    if (!fechaUtils.esDiaHabil(fechaBase)) {
      fechaBase = fechaUtils.obtenerSiguienteDiaHabil(fechaBase);
    }
    
    // Día siguiente hábil para inicio del conteo
    const fechaSiguiente = fechaUtils.obtenerDiaSiguienteHabil(fechaBase);
    
    // 10 días hábiles para configuración de renuencia desde el día siguiente
    const fechaConfiguracionRenuencia = fechaUtils.agregarDiasHabiles(fechaSiguiente, 10, true);
    
    return {
      tipo: TIPOS_ACCIONES.CUMPLIMIENTO,
      fechaRadicacionRenuencia: fechaUtils.formatoFecha(fechaBase),
      fechaConfiguracionRenuencia: fechaUtils.formatoFecha(fechaConfiguracionRenuencia),
      descripcion: 'La acción de cumplimiento es un mecanismo constitucional que permite exigir judicialmente el cumplimiento de leyes o actos administrativos, en el ámbito de los servicios públicos domiciliarios. El principal requisito de procedibilidad es la constitución de la renuencia mediante solicitud formal a la autoridad, configurándose cuando esta ratifica su incumplimiento o no responde dentro de diez días hábiles a la solicitud. Este requisito puede omitirse excepcionalmente ante peligro inminente de perjuicio irremediable. La acción debe identificar claramente la norma incumplida con mandato imperativo. No procede cuando el afectado disponga de otro instrumento judicial para lograr el cumplimiento, cuando se busque el cumplimiento de normas que establezcan gastos, o cuando el derecho pueda garantizarse mediante acción de tutela. A diferencia de otros procesos contencioso-administrativos, no es necesario agotar la conciliación.',
      fundamentoJuridico: 'Ley 393 de 1997.'
    };
  }
};

/**
 * Función principal para calcular términos
 */
function calcularTerminos(tipoAccion, fechaInicial) {
  console.log(`Calculando términos para: ${tipoAccion}, fecha: ${fechaInicial}`);
  
  // Normalizar tipo de acción
  const accion = tipoAccion.trim().toUpperCase();
  
  // Crear fecha base de manera adecuada según el tipo de acción
  let fechaBase;
  
  if (accion === TIPOS_ACCIONES.NULIDAD_RESTABLECIMIENTO) {
    const [year, month, day] = fechaInicial.split('-').map(num => parseInt(num, 10));
    fechaBase = new Date(Date.UTC(year, month - 1, day, 17, 0, 0));
  } else {
    fechaBase = fechaUtils.parseFechaColombia(fechaInicial);
  }
  
  // Verificar si el tipo de acción es válido
  if (calculadorTerminos[accion]) {
    return calculadorTerminos[accion](fechaBase);
  } else {
    return {
      error: `Tipo de acción "${tipoAccion}" no reconocido`,
      tiposValidos: Object.keys(TIPOS_ACCIONES).join(', ')
    };
  }
}

// Rutas API
app.get('/health', (_, res) => res.json({ 
  status: 'ok', 
  message: 'Servidor de términos procesales activo',
  version: '1.0.0'
}));

app.get('/tipos', (_, res) => res.json({ 
  tiposAcciones: Object.keys(TIPOS_ACCIONES) 
}));

app.post('/calcular', (req, res) => {
  try {
    const { tipoAccion, fechaInicial } = req.body;
    
    if (!tipoAccion) {
      return res.status(400).json({
        error: "Debe especificar un tipo de acción",
        campo: "tipoAccion"
      });
    }
    
    // Usar fecha especificada o fecha actual
    const fechaBase = (fechaInicial && fechaUtils.isValidDate(fechaInicial)) ? 
      fechaInicial : fechaUtils.obtenerFechaActualColombia();
    
    // Calcular y enviar respuesta
    res.json(calcularTerminos(tipoAccion, fechaBase));
  } catch (error) {
    res.status(500).json({
      error: `Error al procesar la consulta: ${error.message}`
    });
  }
});

// Iniciar servidor
app.listen(port, () => console.log(`Servidor términos procesales activo en puerto ${port}`));
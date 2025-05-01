// Servidor de términos procesales administrativos para n8n
// Basado en el script original
// Adaptado para funcionar como API REST

const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Habilitar CORS para permitir solicitudes desde n8n
app.use(cors());

// Para parsear el cuerpo de las solicitudes en formato JSON
app.use(express.json());

// Ruta principal para realizar cálculos
app.post('/calcular', (req, res) => {
  try {
    const { tipoAccion, fechaInicial } = req.body;
    
    console.log(`\n===== NUEVA SOLICITUD DE CÁLCULO =====`);
    console.log(`Tipo de acción: ${tipoAccion}`);
    console.log(`Fecha inicial solicitada: ${fechaInicial}`);
    
    if (!tipoAccion) {
      console.log(`Error: Tipo de acción no especificado`);
      return res.status(400).json({
        error: "Debe especificar un tipo de acción",
        campo: "tipoAccion"
      });
    }
    
    // Convertir a mayúsculas y eliminar espacios
    const accion = tipoAccion.trim().toUpperCase();
    
    // Usar fecha especificada o fecha actual
    let fechaBase;
    if (fechaInicial && isValidDate(fechaInicial)) {
      fechaBase = fechaInicial;
      console.log(`Usando fecha proporcionada: ${fechaBase}`);
    } else {
      // Crear fecha actual en zona horaria de Colombia (UTC-5)
      const ahora = new Date();
      // Restar 5 horas para ajustar a tiempo de Colombia
      ahora.setUTCHours(ahora.getUTCHours() - 5);
      const año = ahora.getUTCFullYear();
      const mes = String(ahora.getUTCMonth() + 1).padStart(2, '0');
      const dia = String(ahora.getUTCDate()).padStart(2, '0');
      fechaBase = `${año}-${mes}-${dia}`;
      console.log(`Usando fecha actual (Colombia): ${fechaBase}`);
    }
    
    // Calcular términos según el tipo de acción
    console.log(`Calculando términos para: ${accion} con fecha: ${fechaBase}`);
    const resultado = calcularTerminos(accion, fechaBase);
    
    // Enviar respuesta
    console.log(`Respuesta generada: `, JSON.stringify(resultado, null, 2));
    console.log(`======================================\n`);
    res.json(resultado);
  } catch (error) {
    console.log(`Error en la solicitud: ${error.message}`);
    res.status(500).json({
      error: `Error al procesar la consulta: ${error.message}`
    });
  }
});

// Ruta de verificación/estado
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor de términos procesales activo' });
});

// Mostrar tipos de acciones disponibles
app.get('/tipos', (req, res) => {
  res.json({
    tiposAcciones: [
      "PETICION", "PETICION_INFO", "CONSULTA", "QUEJA", "RECLAMO", 
      "REPOSICION", "APELACION", "RECURSO_QUEJA", "SILENCIO", 
      "TUTELA", "NULIDAD", "NULIDAD_RESTABLECIMIENTO", "CUMPLIMIENTO"
    ]
  });
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor de términos procesales iniciado en el puerto ${port}`);
});

// Función para validar formato de fecha
function isValidDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  // Validar que se pueda crear una fecha válida
  const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
  
  // Verificar rangos válidos: año > 2000, mes entre 1-12, día entre 1-31
  if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  
  // Verificar días válidos según el mes
  const diasPorMes = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  
  // Ajuste para año bisiesto
  if ((year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)) {
    diasPorMes[2] = 29;
  }
  
  return day <= diasPorMes[month];
}

// Función principal para calcular términos
function calcularTerminos(tipoAccion, fechaInicial) {
  // Crear la fecha base en zona horaria de Colombia
  const fechaBase = parseFechaColombia(fechaInicial);
  
  switch (tipoAccion) {
    case 'PETICION':
      return calcularTerminoPeticion(fechaBase);
    case 'PETICION_INFO':
      return calcularTerminoPeticionInfo(fechaBase);
    case 'CONSULTA':
      return calcularTerminoConsulta(fechaBase);
    case 'QUEJA':
      return calcularTerminoQueja(fechaBase);
    case 'RECLAMO':
      return calcularTerminoReclamo(fechaBase);
    case 'REPOSICION':
      return calcularTerminoReposicion(fechaBase);
    case 'APELACION':
      return calcularTerminoApelacion(fechaBase);
    case 'RECURSO_QUEJA':
      return calcularTerminoRecursoQueja(fechaBase);
    case 'SILENCIO':
      return calcularTerminoSilencio(fechaBase);
    case 'TUTELA':
      return calcularTerminoTutela(fechaBase);
    case 'NULIDAD':
      return calcularTerminoNulidad(fechaBase);
    case 'NULIDAD_RESTABLECIMIENTO':
      return calcularTerminoNulidadRestablecimiento(fechaBase);
    case 'CUMPLIMIENTO':
      return calcularTerminoCumplimiento(fechaBase);
    default:
      return {
        error: `Tipo de acción "${tipoAccion}" no reconocido`,
        tiposValidos: "PETICION, PETICION_INFO, CONSULTA, QUEJA, RECLAMO, REPOSICION, APELACION, RECURSO_QUEJA, SILENCIO, TUTELA, NULIDAD, NULIDAD_RESTABLECIMIENTO, CUMPLIMIENTO"
      };
  }
}

// Función para verificar si una fecha es día hábil y, si no, obtener el siguiente día hábil
function obtenerSiguienteDiaHabil(fecha) {
  let resultado = new Date(fecha);
  
  console.log(`\n--- INICIO obtenerSiguienteDiaHabil ---`);
  console.log(`Fecha inicial: ${formatoFecha(resultado)}, Día de semana: ${resultado.getUTCDay()}`);
  
  // Verificar explícitamente si es fin de semana
  if (esFindeSemana(resultado)) {
    console.log(`La fecha ${formatoFecha(resultado)} cae en fin de semana, buscando siguiente día hábil...`);
    // Si es sábado (6) o domingo (0), avanzar al siguiente día hábil
    while (esFindeSemana(resultado)) {
      resultado.setUTCDate(resultado.getUTCDate() + 1);
      console.log(`  - Intentando con: ${formatoFecha(resultado)}`);
    }
  }
  
  // Verificar si es festivo y, en caso afirmativo, avanzar al siguiente día hábil
  while (esFestivo(resultado)) {
    console.log(`La fecha ${formatoFecha(resultado)} es festivo, buscando siguiente día hábil...`);
    resultado.setUTCDate(resultado.getUTCDate() + 1);
    // Si avanzando llegamos a un fin de semana, seguir avanzando
    while (esFindeSemana(resultado)) {
      resultado.setUTCDate(resultado.getUTCDate() + 1);
      console.log(`  - Intentando con: ${formatoFecha(resultado)}`);
    }
  }
  
  console.log(`Fecha resultante: ${formatoFecha(resultado)}`);
  console.log(`--- FIN obtenerSiguienteDiaHabil ---\n`);
  
  return resultado;
}

// Descripción estándar del silencio administrativo positivo
const descripcionSilencioPositivo = 'El silencio administrativo positivo en servicios públicos domiciliarios: ' +
  'Se configura automáticamente cuando la empresa no responde una PQR en los 15 días hábiles establecidos. ' +
  'No requiere elevar a escritura pública ni procedimientos especiales. ' +
  'La empresa debe reconocer sus efectos dentro de las 72 horas siguientes al vencimiento del plazo. ' +
  'Si la empresa no reconoce los efectos, el usuario puede solicitar sanciones a la Superintendencia. ' +
  'No opera si hay práctica de pruebas o si el usuario causó la demora.';

// Funciones específicas para cada tipo de acción

function calcularTerminoPeticion(fechaBase) {
  console.log(`\n========== CÁLCULO DE TÉRMINO PETICIÓN ==========`);
  console.log(`Fecha inicial (antes de ajustar): ${formatoFecha(fechaBase)}`);
  
  // Verificar si la fecha base es hábil, si no, obtener el siguiente día hábil
  fechaBase = obtenerSiguienteDiaHabil(fechaBase);
  console.log(`Fecha inicial (después de ajustar): ${formatoFecha(fechaBase)}`);
  
  // Término para respuesta de derechos de petición general: 15 días hábiles
  // Contamos desde el mismo día (true) para que el día de radicación sea el día 1
  const fechaRespuesta = agregarDiasHabiles(fechaBase, 15, true);
  console.log(`Fecha límite de respuesta: ${formatoFecha(fechaRespuesta)}`);
  
  // Término para reconocimiento del silencio: 72 horas (3 días calendario) después del vencimiento
  const fechaReconocimientoSilencio = agregarDias(fechaRespuesta, 3);
  console.log(`Fecha para reconocimiento de silencio: ${formatoFecha(fechaReconocimientoSilencio)}`);
  console.log(`=================================================\n`);
  
  return {
    tipo: 'PETICION',
    fechaInicial: formatoFecha(fechaBase),
    fechaLimiteRespuesta: formatoFecha(fechaRespuesta),
    fechaReconocimientoSilencio: formatoFecha(fechaReconocimientoSilencio),
    descripcion: `El término para responder un derecho de petición general es de 15 días hábiles contados desde el mismo día de presentación. ${descripcionSilencioPositivo}`,
    fundamentoJuridico: 'Artículo 158 de la Ley 142 de 1994.'
  };
}

function calcularTerminoPeticionInfo(fechaBase) {
  // Verificar si la fecha base es hábil, si no, obtener el siguiente día hábil
  fechaBase = obtenerSiguienteDiaHabil(fechaBase);
  
  // Término para respuesta de derechos de petición de información: 15 días hábiles
  // Contamos desde el mismo día (true) para que el día de radicación sea el día 1
  const fechaRespuesta = agregarDiasHabiles(fechaBase, 15, true);
  
  // Término para reconocimiento del silencio: 72 horas (3 días calendario) después del vencimiento
  const fechaReconocimientoSilencio = agregarDias(fechaRespuesta, 3);
  
  return {
    tipo: 'PETICION_INFO',
    fechaInicial: formatoFecha(fechaBase),
    fechaLimiteRespuesta: formatoFecha(fechaRespuesta),
    fechaReconocimientoSilencio: formatoFecha(fechaReconocimientoSilencio),
    descripcion: `El término para responder un derecho de petición de información es de 15 días hábiles contados desde el mismo día de presentación. ${descripcionSilencioPositivo}`,
    fundamentoJuridico: 'Artículo 158 de la Ley 142 de 1994.'
  };
}

function calcularTerminoConsulta(fechaBase) {
  // Verificar si la fecha base es hábil, si no, obtener el siguiente día hábil
  fechaBase = obtenerSiguienteDiaHabil(fechaBase);
  
  // Término para respuesta de consultas: 15 días hábiles
  // Contamos desde el mismo día (true) para que el día de radicación sea el día 1
  const fechaRespuesta = agregarDiasHabiles(fechaBase, 15, true);
  
  // Término para reconocimiento del silencio: 72 horas (3 días calendario) después del vencimiento
  const fechaReconocimientoSilencio = agregarDias(fechaRespuesta, 3);
  
  return {
    tipo: 'CONSULTA',
    fechaInicial: formatoFecha(fechaBase),
    fechaLimiteRespuesta: formatoFecha(fechaRespuesta),
    fechaReconocimientoSilencio: formatoFecha(fechaReconocimientoSilencio),
    descripcion: `El término para responder una consulta es de 15 días hábiles contados desde el mismo día de presentación. ${descripcionSilencioPositivo}`,
    fundamentoJuridico: 'Artículo 158 de la Ley 142 de 1994.'
  };
}

function calcularTerminoQueja(fechaBase) {
  // Verificar si la fecha base es hábil, si no, obtener el siguiente día hábil
  fechaBase = obtenerSiguienteDiaHabil(fechaBase);
  
  // Término para responder una queja administrativa: 15 días hábiles
  // Contamos desde el mismo día (true) para que el día de radicación sea el día 1
  const fechaRespuesta = agregarDiasHabiles(fechaBase, 15, true);
  
  // Término para reconocimiento del silencio: 72 horas (3 días calendario) después del vencimiento
  const fechaReconocimientoSilencio = agregarDias(fechaRespuesta, 3);
  
  return {
    tipo: 'QUEJA',
    fechaInicial: formatoFecha(fechaBase),
    fechaLimiteRespuesta: formatoFecha(fechaRespuesta),
    fechaReconocimientoSilencio: formatoFecha(fechaReconocimientoSilencio),
    descripcion: `El término para responder una queja administrativa es de 15 días hábiles contados desde el mismo día de presentación. ${descripcionSilencioPositivo}`,
    fundamentoJuridico: 'Artículo 158 de la Ley 142 de 1994.'
  };
}

function calcularTerminoReclamo(fechaBase) {
  // Verificar si la fecha base es hábil, si no, obtener el siguiente día hábil
  fechaBase = obtenerSiguienteDiaHabil(fechaBase);
  
  // Término para respuesta de reclamaciones: 15 días hábiles
  // Contamos desde el mismo día (true) para que el día de radicación sea el día 1
  const fechaRespuesta = agregarDiasHabiles(fechaBase, 15, true);
  
  // Término para reconocimiento del silencio: 72 horas (3 días calendario) después del vencimiento
  const fechaReconocimientoSilencio = agregarDias(fechaRespuesta, 3);
  
  // Término máximo para presentar reclamación: 5 meses HACIA ADELANTE desde la entrega de la factura
  const fechaLimiteReclamacion = agregarMeses(fechaBase, 5);
  
  return {
    tipo: 'RECLAMO',
    fechaInicial: formatoFecha(fechaBase),
    fechaLimiteRespuesta: formatoFecha(fechaRespuesta),
    fechaReconocimientoSilencio: formatoFecha(fechaReconocimientoSilencio),
    fechaLimiteParaReclamar: formatoFecha(fechaLimiteReclamacion),
    descripcion: `El término para responder una reclamación es de 15 días hábiles contados desde el mismo día de presentación. La reclamación puede presentarse dentro de los 5 meses siguientes a la entrega de la factura. ${descripcionSilencioPositivo}`,
    fundamentoJuridico: 'Artículo 158 de la Ley 142 de 1994.'
  };
}

function calcularTerminoReposicion(fechaBase) {
  // Término para presentar recurso de reposición: 5 días hábiles desde notificación (contando desde el mismo día)
  const fechaLimiteRecurso = agregarDiasHabiles(fechaBase, 5, true);
  // Término para resolver el recurso: 15 días hábiles desde presentación (contando desde el mismo día)
  const fechaDecision = agregarDiasHabiles(fechaBase, 15, true);
  // Término para reconocimiento del silencio: 72 horas (3 días calendario) después del vencimiento
  const fechaReconocimientoSilencio = agregarDias(fechaDecision, 3);
  
  return {
    tipo: 'REPOSICION',
    fechaInicial: formatoFecha(fechaBase),
    fechaLimitePresentacion: formatoFecha(fechaLimiteRecurso),
    fechaLimiteDecision: formatoFecha(fechaDecision),
    fechaReconocimientoSilencio: formatoFecha(fechaReconocimientoSilencio),
    descripcion: 'El recurso de reposición debe presentarse dentro de los 5 días hábiles siguientes a la notificación, contados desde el mismo día. La empresa tiene 15 días hábiles para resolverlo, contados desde el día de presentación.',
    fundamentoJuridico: 'Artículo 158 de la Ley 142 de 1994.'
  };
}

function calcularTerminoApelacion(fechaBase) {
  // La apelación se presenta junto con reposición, mismo plazo: 5 días hábiles (contando desde el mismo día)
  const fechaLimiteRecurso = agregarDiasHabiles(fechaBase, 5, true);
  // La empresa debe remitir el expediente a la Superintendencia
  // La Superintendencia tiene 2 meses (aprox. 40 días hábiles) para resolver
  const fechaDecision = agregarDiasHabiles(fechaBase, 40, true);
  
  return {
    tipo: 'APELACION',
    fechaInicial: formatoFecha(fechaBase),
    fechaLimitePresentacion: formatoFecha(fechaLimiteRecurso),
    fechaLimiteDecision: formatoFecha(fechaDecision),
    descripcion: 'El recurso de apelación debe presentarse en subsidio con el de reposición dentro de los 5 días hábiles siguientes a la notificación, contados desde el mismo día. La Superintendencia tiene aproximadamente 2 meses para resolver.',
    fundamentoJuridico: 'Artículo 158 de la Ley 142 de 1994.'
  };
}

function calcularTerminoRecursoQueja(fechaBase) {
  // Término para presentar recurso de queja: 5 días hábiles desde notificación del rechazo (contando desde el mismo día)
  const fechaLimiteQueja = agregarDiasHabiles(fechaBase, 5, true);
  // Término para resolverlo: 10 días hábiles (contando desde el mismo día de presentación)
  const fechaDecision = agregarDiasHabiles(fechaLimiteQueja, 10, true);
  
  return {
    tipo: 'RECURSO_QUEJA',
    fechaRechazoApelacion: formatoFecha(fechaBase),
    fechaLimitePresentacionQueja: formatoFecha(fechaLimiteQueja),
    fechaLimiteDecision: formatoFecha(fechaDecision),
    descripcion: 'El recurso de queja debe presentarse dentro de los 5 días hábiles siguientes a la notificación del rechazo de la apelación, contados desde el mismo día. El término para resolverlo es de 10 días hábiles desde la presentación.',
    fundamentoJuridico: 'Artículo 158 de la Ley 142 de 1994.'
  };
}

function calcularTerminoSilencio(fechaBase) {
  // El silencio ya se configuró en esta fecha, calcular plazos para acciones posteriores
  // Se establece el término para reconocimiento: 72 horas (3 días calendario) después del vencimiento
  const fechaReconocimientoSilencio = agregarDias(fechaBase, 3);
  
  return {
    tipo: 'SILENCIO',
    fechaVencimientoTermino: formatoFecha(fechaBase),
    fechaReconocimientoSilencio: formatoFecha(fechaReconocimientoSilencio),
    descripcion: descripcionSilencioPositivo,
    fundamentoJuridico: 'Artículo 158 de la Ley 142 de 1994.'
  };
}

function calcularTerminoTutela(fechaBase) {
  // La acción de tutela debe ser resuelta en 10 días hábiles (contando desde el mismo día)
  const fechaDecision = agregarDiasHabiles(fechaBase, 10, true);
  // Plazo para impugnación: 3 días hábiles (contando desde el mismo día)
  const fechaImpugnacion = agregarDiasHabiles(fechaDecision, 3, true);
  
  return {
    tipo: 'TUTELA',
    fechaPresentacion: formatoFecha(fechaBase),
    fechaLimiteDecision: formatoFecha(fechaDecision),
    fechaLimiteImpugnacion: formatoFecha(fechaImpugnacion),
    descripcion: 'La acción de tutela debe ser resuelta en 10 días hábiles contados desde la presentación. La impugnación puede presentarse dentro de los 3 días hábiles siguientes a la notificación.',
    fundamentoJuridico: 'Constitución Política, Art. 86 y Decreto 2591 de 1991.'
  };
}

function calcularTerminoNulidad(fechaBase) {
  // La acción de nulidad simple no tiene caducidad
  // Aproximadamente 3 meses para admisión (estimado)
  const fechaEstimadaAdmision = agregarMeses(fechaBase, 3);
  
  return {
    tipo: 'NULIDAD',
    fechaPresentacion: formatoFecha(fechaBase),
    fechaEstimadaAdmision: formatoFecha(fechaEstimadaAdmision),
    descripcion: 'La acción de nulidad simple puede presentarse en cualquier tiempo. No tiene caducidad. Es aplicable para actos administrativos de carácter general.',
    fundamentoJuridico: 'CPACA (Ley 1437 de 2011), Art. 137.'
  };
}

function calcularTerminoNulidadRestablecimiento(fechaBase) {
  // Caducidad: 4 meses desde notificación o publicación del acto
  const fechaCaducidad = agregarMeses(fechaBase, 4);
  // Fecha estimada de admisión (aproximado)
  const fechaEstimadaAdmision = agregarMeses(fechaBase, 3);
  
  return {
    tipo: 'NULIDAD_RESTABLECIMIENTO',
    fechaActoAdministrativo: formatoFecha(fechaBase),
    fechaCaducidad: formatoFecha(fechaCaducidad),
    fechaEstimadaAdmision: formatoFecha(fechaEstimadaAdmision),
    descripcion: 'La acción de nulidad y restablecimiento del derecho debe presentarse dentro de los 4 meses siguientes a la notificación o publicación del acto administrativo. Aplica para actos administrativos que afecten derechos particulares.',
    fundamentoJuridico: 'CPACA (Ley 1437 de 2011), Art. 138.'
  };
}

function calcularTerminoCumplimiento(fechaBase) {
  // La acción de cumplimiento requiere constitución en renuencia: 10 días para responder (contando desde el mismo día)
  const fechaLimiteRenuencia = agregarDiasHabiles(fechaBase, 10, true);
  // Término para presentar acción tras configuración de renuencia: 30 días calendario
  const fechaLimiteAccion = agregarDias(fechaLimiteRenuencia, 30);
  // Término para resolver la acción: 20 días hábiles (contando desde el mismo día)
  const fechaDecision = agregarDiasHabiles(fechaLimiteAccion, 20, true);
  
  return {
    tipo: 'CUMPLIMIENTO',
    fechaConstitucioEnRenuencia: formatoFecha(fechaBase),
    fechaConfiguracionRenuencia: formatoFecha(fechaLimiteRenuencia),
    fechaLimitePresentacionAccion: formatoFecha(fechaLimiteAccion),
    fechaLimiteDecision: formatoFecha(fechaDecision),
    descripcion: 'La autoridad tiene 10 días para responder a la constitución en renuencia contados desde el día de su presentación. Luego, se tienen 30 días calendario para presentar la acción de cumplimiento. El juez debe resolver en 20 días hábiles desde su presentación.',
    fundamentoJuridico: 'Ley 393 de 1997.'
  };
}

// Funciones auxiliares para el cálculo de fechas

function agregarDias(fecha, dias) {
  const resultado = new Date(fecha);
  // Sumar días en UTC para mantener la zona horaria
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado;
}

function agregarMeses(fecha, meses) {
  const resultado = new Date(fecha);
  // Sumar meses en UTC para mantener la zona horaria
  resultado.setUTCMonth(resultado.getUTCMonth() + meses);
  return resultado;
}

function agregarDiasHabiles(fecha, dias, empezarMismoDia = true) {
  let resultado = new Date(fecha);
  let diasAgregados = 0;
  
  console.log(`\n--- INICIO agregarDiasHabiles ---`);
  console.log(`Fecha inicial: ${formatoFecha(resultado)}, Día de semana: ${resultado.getUTCDay()}`);
  console.log(`Es fin de semana: ${esFindeSemana(resultado)}, Es festivo: ${esFestivo(resultado)}`);
  console.log(`Días a agregar: ${dias}, Empezar mismo día: ${empezarMismoDia}`);
  
  // Si la fecha es hábil y queremos contar desde el mismo día
  if (empezarMismoDia && !esFindeSemana(resultado) && !esFestivo(resultado)) {
    diasAgregados = 1; // Contar el primer día como día 1
    console.log(`Contando día inicial como día 1. Días contados: ${diasAgregados}`);
  } else {
    console.log(`NO contando día inicial. Días contados: ${diasAgregados}`);
  }
  
  // Seguir contando hasta alcanzar el total de días hábiles requeridos
  while (diasAgregados < dias) {
    resultado.setUTCDate(resultado.getUTCDate() + 1);
    console.log(`Avanzando a fecha: ${formatoFecha(resultado)}, Día de semana: ${resultado.getUTCDay()}`);
    
    if (!esFindeSemana(resultado) && !esFestivo(resultado)) {
      diasAgregados++;
      console.log(`Es día hábil. Días contados: ${diasAgregados}`);
    } else {
      console.log(`NO es día hábil. Días contados: ${diasAgregados}`);
    }
  }
  
  console.log(`Fecha final: ${formatoFecha(resultado)}, Total días hábiles: ${diasAgregados}`);
  console.log(`--- FIN agregarDiasHabiles ---\n`);
  
  return resultado;
}

function esFindeSemana(fecha) {
  // En JavaScript con UTC: 0 = Domingo, 1 = Lunes, ..., 5 = Viernes, 6 = Sábado
  const diaSemana = fecha.getUTCDay();
  const esFinde = diaSemana === 0 || diaSemana === 6; // Domingo o Sábado
  
  console.log(`Verificando fin de semana: ${formatoFecha(fecha)}, día ${diaSemana} (0=Dom, 6=Sáb): ${esFinde}`);
  
  return esFinde;
}

function esFestivo(fecha) {
  // Lista de festivos en Colombia para 2024-2026
  const festivos = [
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
  ];
  
  const fechaStr = formatoFecha(fecha);
  const esFest = festivos.includes(fechaStr);
  
  if (esFest) {
    console.log(`Verificando festivo: ${fechaStr} - ES FESTIVO`);
  }
  
  return esFest;
}

// Función para convertir string de fecha YYYY-MM-DD a objeto Date en zona horaria de Colombia (UTC-5)
function parseFechaColombia(fechaStr) {
  // Separar año, mes y día
  const [year, month, day] = fechaStr.split('-').map(num => parseInt(num, 10));
  
  // Crear fecha con hora fija a las 12 del mediodía en Colombia (UTC-5)
  // Mes en JavaScript es base 0 (enero = 0)
  const fecha = new Date(Date.UTC(year, month - 1, day, 17, 0, 0));
  
  return fecha;
}

// Función para formatear fecha a string YYYY-MM-DD
function formatoFecha(fecha) {
  // Ajustar a zona horaria de Colombia (UTC-5)
  const año = fecha.getUTCFullYear();
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getUTCDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}
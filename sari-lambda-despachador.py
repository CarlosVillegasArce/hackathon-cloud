import json
import csv
import io
import urllib.parse
import boto3
import os
from botocore.exceptions import ClientError

# Inicializamos los clientes de AWS fuera del handler para reutilizar conexiones
s3_client = boto3.client('s3')
sqs_client = boto3.client('sqs')

# Extraemos la URL de la cola SQS desde las variables de entorno (Buena práctica)
SQS_QUEUE_URL = os.environ.get('SQS_QUEUE_URL')

TAMANO_LOTE = 10          # Reclamos por mensaje SQS
LOTES_POR_BATCH = 10      # Mensajes SQS por llamada send_message_batch (máximo permitido por AWS)

# Tenants reconocidos actualmente. La carpeta en S3 debe coincidir exactamente con una de estas keys.
# Ej: uploads/SEDAPAL/archivo.csv, uploads/MUNICIPALIDAD_DE_ATE/archivo.csv
TENANTS_VALIDOS = {
    "SEDAPAL",
    "INDECOPI",
    "ESSALUD",
    "OSIPTEL",
    "MUNICIPALIDAD_DE_ATE",
}


def lambda_handler(event, context):
    if not SQS_QUEUE_URL:
        # Falla rápido y claro, en vez de reventar más adelante en enviar_a_sqs
        raise ValueError("La variable de entorno SQS_QUEUE_URL no está configurada.")

    resultados = []

    # Soportamos uno o varios records en el mismo evento de S3
    for record in event.get('Records', []):
        try:
            resultado = procesar_record(record)
            resultados.append(resultado)
        except Exception as e:
            # Si falla un archivo, no abortamos el resto del batch de records.
            # Lo logueamos y re-lanzamos al final para que Lambda marque el evento como fallido
            # (esto importa si vienes de un trigger con retry/DLQ configurado a nivel de evento).
            print(f"Error procesando record: {json.dumps(record.get('s3', {}))} -> {str(e)}")
            raise

    return {
        'statusCode': 200,
        'body': json.dumps({'archivos_procesados': resultados})
    }


def procesar_record(record):
    # 1. Extraer información del archivo desde el evento de S3
    bucket_name = record['s3']['bucket']['name']
    # El nombre del archivo puede venir con caracteres especiales codificados (ej: espacios como +)
    file_key = urllib.parse.unquote_plus(record['s3']['object']['key'])

    print(f"Procesando archivo: {file_key} del bucket: {bucket_name}")

    # 2. Extraer el tenant_id de la estructura de la carpeta
    # Estructura esperada: uploads/SEDAPAL/archivo.csv
    tenant_id = extraer_tenant_id(file_key)
    print(f"Tenant identificado: {tenant_id}")

    # 3. Obtener el objeto de S3 de forma eficiente (Streaming)
    response = s3_client.get_object(Bucket=bucket_name, Key=file_key)

    # TextIOWrapper sobre el StreamingBody: csv.reader maneja correctamente
    # los saltos de línea DENTRO de campos entrecomillados, algo que
    # iter_lines() rompe porque parte el archivo línea a línea de forma ciega.
    stream = io.TextIOWrapper(response['Body'], encoding='utf-8', errors='strict', newline='')
    csv_reader = csv.DictReader(stream)

    # Validación temprana de encabezados esperados
    columnas_esperadas = {'id_reclamo', 'fecha_reclamo', 'detalle_reclamo'}
    if not csv_reader.fieldnames or not columnas_esperadas.issubset(set(csv_reader.fieldnames)):
        raise ValueError(
            f"El archivo {file_key} no tiene las columnas esperadas. "
            f"Encontradas: {csv_reader.fieldnames}"
        )

    lote_actual = []
    buffer_lotes = []  # Acumula lotes (listas de reclamos) antes de mandarlos en batch a SQS
    contador_mensajes = 0
    contador_filas_invalidas = 0
    numero_fila = 1  # fila 1 = primera fila de datos (después del header)

    # 4. Leer el CSV fila por fila
    for fila in csv_reader:
        numero_fila += 1

        id_reclamo = (fila.get('id_reclamo') or '').strip()
        fecha_reclamo = (fila.get('fecha_reclamo') or '').strip()
        detalle_reclamo = (fila.get('detalle_reclamo') or '').strip()

        if not id_reclamo or not detalle_reclamo:
            contador_filas_invalidas += 1
            print(f"Fila {numero_fila} inválida en {file_key}, se ignora (id_reclamo o detalle_reclamo vacíos).")
            continue

        reclamo = {
            "id_reclamo": id_reclamo,
            "fecha_creacion": fecha_reclamo,
            "texto_original": detalle_reclamo
        }

        lote_actual.append(reclamo)

        if len(lote_actual) == TAMANO_LOTE:
            buffer_lotes.append(lote_actual)
            lote_actual = []

            # Cuando juntamos suficientes lotes, los mandamos todos en una sola
            # llamada send_message_batch (hasta 10 mensajes por llamada)
            if len(buffer_lotes) == LOTES_POR_BATCH:
                contador_mensajes += flush_lotes(tenant_id, buffer_lotes)
                buffer_lotes = []

    # Lote sobrante (si el archivo no era múltiplo de TAMANO_LOTE)
    if lote_actual:
        buffer_lotes.append(lote_actual)

    # Flush final de lo que quedó en el buffer
    if buffer_lotes:
        contador_mensajes += flush_lotes(tenant_id, buffer_lotes)

    print(
        f"Archivo {file_key}: {contador_mensajes} mensajes enviados a SQS, "
        f"{contador_filas_invalidas} filas inválidas ignoradas."
    )

    return {
        'archivo': file_key,
        'tenant_id': tenant_id,
        'mensajes_enviados': contador_mensajes,
        'filas_invalidas': contador_filas_invalidas
    }


def extraer_tenant_id(file_key: str) -> str:
    """Extrae el tenant_id de la ruta del archivo, validando la estructura esperada."""
    parts = file_key.split('/')

    if len(parts) < 2 or not parts[1]:
        print(f"ADVERTENCIA: no se pudo extraer tenant_id de la ruta '{file_key}'. Estructura inesperada.")
        return "UNKNOWN"

    tenant_id = parts[1]

    if tenant_id not in TENANTS_VALIDOS:
        raise ValueError(
            f"Tenant '{tenant_id}' no reconocido para el archivo '{file_key}'. "
            f"Tenants válidos: {sorted(TENANTS_VALIDOS)}"
        )

    return tenant_id


def flush_lotes(tenant_id: str, lotes: list) -> int:
    """
    Envía hasta 10 lotes (mensajes) a SQS en una sola llamada send_message_batch.
    Devuelve la cantidad de mensajes enviados exitosamente.
    Si alguno falla, lo reintenta individualmente antes de darse por vencido.
    """
    entries = []
    for i, lote in enumerate(lotes):
        payload = {
            "tenant_id": tenant_id,
            "reclamos": lote
        }
        entries.append({
            "Id": str(i),
            "MessageBody": json.dumps(payload)
        })

    try:
        response = sqs_client.send_message_batch(QueueUrl=SQS_QUEUE_URL, Entries=entries)
    except ClientError as e:
        print(f"Error llamando send_message_batch: {str(e)}")
        raise

    enviados = len(response.get('Successful', []))
    fallidos = response.get('Failed', [])

    if fallidos:
        print(f"{len(fallidos)} mensajes fallaron en send_message_batch, reintentando individualmente...")
        for fallo in fallidos:
            idx = int(fallo['Id'])
            entry = entries[idx]
            try:
                sqs_client.send_message(QueueUrl=SQS_QUEUE_URL, MessageBody=entry['MessageBody'])
                enviados += 1
            except ClientError as e:
                # Si esto falla, dejamos que se propague: es mejor que Lambda reintente
                # el archivo completo (con riesgo de duplicados manejado por idempotencia
                # en el Worker) a que perdamos reclamos silenciosamente.
                print(f"Fallo definitivo enviando mensaje {entry['Id']}: {str(e)}")
                raise

    return enviados
import json
import os
import re
import urllib.request
import urllib.error
import time
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')

TABLE_NAME = os.environ.get('DYNAMODB_TABLE')
GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
GROQ_MODEL = os.environ.get('GROQ_MODEL', 'llama-3.1-8b-instant')
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

AREAS_VALIDAS = {"OPERACIONES", "COMERCIAL", "ATENCION_AL_CLIENTE", "LEGAL"}
URGENCIAS_VALIDAS = {"ALTA", "MEDIA", "BAJA"}

table = None  # se inicializa de forma perezosa, una vez por contenedor Lambda


def get_table():
    global table
    if table is None:
        if not TABLE_NAME:
            raise ValueError("La variable de entorno DYNAMODB_TABLE no está configurada.")
        table = dynamodb.Table(TABLE_NAME)
    return table


def lambda_handler(event, context):
    if not GROQ_API_KEY:
        raise ValueError("La variable de entorno GROQ_API_KEY no está configurada.")

    fallos = []  # batchItemFailures para que SQS solo reintente los mensajes que fallaron

    for record in event.get('Records', []):
        message_id = record.get('messageId')
        try:
            procesar_mensaje(record)
        except Exception as e:
            print(f"Error procesando mensaje {message_id}: {str(e)}")
            fallos.append({"itemIdentifier": message_id})

    # Reportamos fallos parciales: SQS solo reintenta los mensajes listados aquí,
    # no el batch completo. Requiere ReportBatchItemFailures habilitado en el
    # event source mapping del Lambda (ver nota al final).
    return {"batchItemFailures": fallos}


def procesar_mensaje(record):
    body = json.loads(record['body'])
    tenant_id = body['tenant_id']
    reclamos = body['reclamos']

    print(f"Procesando lote de {len(reclamos)} reclamos para tenant {tenant_id}")

    clasificaciones = clasificar_lote_con_groq(reclamos)

    guardar_en_dynamodb(tenant_id, reclamos, clasificaciones)


def clasificar_lote_con_groq(reclamos: list) -> dict:
    """
    Llama a Groq UNA sola vez con todos los reclamos del lote.
    Devuelve un dict {id_reclamo: {area_derivada, urgencia, resumen_reclamo}}.

    Si el JSON de respuesta viene roto, se intenta recuperar con un parseo
    tolerante (sin volver a llamar al modelo, para no gastar tokens extra).
    Los reclamos que no se puedan clasificar (ni por Groq ni por el parseo
    de respaldo) quedan marcados para revisión manual, sin costo adicional.
    """
    prompt = construir_prompt(reclamos)

    raw_response = llamar_groq(prompt)

    clasificaciones = parsear_respuesta_groq(raw_response, reclamos)

    return clasificaciones


def construir_prompt(reclamos: list) -> str:
    items = [
        {"id_reclamo": r["id_reclamo"], "texto": r["texto_original"]}
        for r in reclamos
    ]

    instrucciones = (
        "Eres un clasificador de reclamos de servicios públicos en Perú. "
        "Para cada reclamo de la lista, clasifica:\n"
        "- area_derivada: una de OPERACIONES, COMERCIAL, ATENCION_AL_CLIENTE, LEGAL\n"
        "- urgencia: una de ALTA, MEDIA, BAJA\n"
        "- resumen_reclamo: resumen claro en español, máximo 25 palabras\n\n"
        "Responde ÚNICAMENTE con un array JSON, sin texto adicional, sin markdown, "
        "con este formato exacto:\n"
        '[{"id_reclamo": "...", "area_derivada": "...", "urgencia": "...", "resumen_reclamo": "..."}]\n\n'
        "Debes incluir TODOS los id_reclamo de la lista de entrada, en cualquier orden.\n\n"
        f"Reclamos a clasificar:\n{json.dumps(items, ensure_ascii=False)}"
    )

    return instrucciones


def llamar_groq(prompt: str, max_reintentos: int = 2) -> str:
    # Pedimos un ARRAY JSON (no un objeto), así que no usamos response_format
    # json_object -- varios modelos de Groq lo exigen top-level object.
    # En su lugar, forzamos el formato vía instrucciones en el prompt y
    # parseamos con tolerancia a ruido en parsear_respuesta_groq().
    payload_dict = {
        "model": GROQ_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
    }
    payload = json.dumps(payload_dict).encode('utf-8')

    req = urllib.request.Request(
        GROQ_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        },
        method="POST"
    )

    ultimo_error = None
    for intento in range(max_reintentos + 1):
        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                return data['choices'][0]['message']['content']
        except urllib.error.HTTPError as e:
            cuerpo_error = e.read().decode('utf-8', errors='ignore')
            ultimo_error = f"HTTP {e.code}: {cuerpo_error}"
            # Reintentamos solo en 429 (rate limit) y 5xx (error transitorio del lado de Groq).
            # Esto SÍ es una llamada de red repetida, no una repetición de tokens de contenido
            # malformado -- es la única clase de reintento que vale la pena pagar.
            if e.code == 429 or e.code >= 500:
                time.sleep(2 ** intento)
                continue
            raise RuntimeError(f"Error llamando a Groq (no reintentable): {ultimo_error}")
        except urllib.error.URLError as e:
            ultimo_error = str(e.reason)
            time.sleep(2 ** intento)
            continue

    raise RuntimeError(f"Groq falló tras {max_reintentos} reintentos: {ultimo_error}")


def parsear_respuesta_groq(raw_response: str, reclamos: list) -> dict:
    """
    Intenta parsear el JSON devuelto por Groq. Si viene con ruido (markdown,
    texto antes/después), se recorta con regex SIN volver a llamar al modelo.
    Si de plano no se puede parsear, todos los reclamos del lote quedan
    marcados para revisión manual, a costo cero.
    """
    ids_esperados = {r["id_reclamo"] for r in reclamos}

    texto = raw_response.strip()

    # Quita posibles bloques de markdown ```json ... ```
    texto = re.sub(r'^```(?:json)?\s*', '', texto)
    texto = re.sub(r'\s*```$', '', texto)

    items_parseados = None
    try:
        items_parseados = json.loads(texto)
    except json.JSONDecodeError:
        # Recorte de respaldo: nos quedamos solo con lo que está entre el
        # primer '[' y el último ']' del texto, por si el modelo agregó
        # alguna frase antes o después del array.
        match = re.search(r'\[.*\]', texto, re.DOTALL)
        if match:
            try:
                items_parseados = json.loads(match.group(0))
            except json.JSONDecodeError:
                items_parseados = None

    clasificaciones = {}

    if items_parseados is None:
        print(f"No se pudo parsear la respuesta de Groq, se marca todo el lote para revisión. Respuesta cruda: {raw_response[:500]}")
        for id_reclamo in ids_esperados:
            clasificaciones[id_reclamo] = clasificacion_por_defecto()
        return clasificaciones

    # Mapeamos lo que sí vino bien, por id_reclamo
    ids_recibidos = set()
    for item in items_parseados:
        try:
            id_reclamo = str(item["id_reclamo"])
            area = str(item.get("area_derivada", "")).strip().upper()
            urgencia = str(item.get("urgencia", "")).strip().upper()
            resumen = str(item.get("resumen_reclamo", "")).strip()

            if area not in AREAS_VALIDAS:
                area = "ATENCION_AL_CLIENTE"  # default seguro si el LLM alucina una categoría
            if urgencia not in URGENCIAS_VALIDAS:
                urgencia = "MEDIA"
            if not resumen:
                resumen = "Sin resumen disponible (revisión manual requerida)."

            clasificaciones[id_reclamo] = {
                "area_derivada": area,
                "urgencia": urgencia,
                "resumen_reclamo": resumen,
                "requiere_revision": False
            }
            ids_recibidos.add(id_reclamo)
        except (KeyError, TypeError):
            continue

    # Los que el LLM se "comió" (no vinieron en la respuesta) quedan con default + flag
    faltantes = ids_esperados - ids_recibidos
    if faltantes:
        print(f"Groq no devolvió clasificación para {len(faltantes)} reclamos: {faltantes}")
        for id_reclamo in faltantes:
            clasificaciones[id_reclamo] = clasificacion_por_defecto()

    return clasificaciones


def clasificacion_por_defecto() -> dict:
    return {
        "area_derivada": "ATENCION_AL_CLIENTE",
        "urgencia": "MEDIA",
        "resumen_reclamo": "No se pudo clasificar automáticamente (revisión manual requerida).",
        "requiere_revision": True
    }


def guardar_en_dynamodb(tenant_id: str, reclamos: list, clasificaciones: dict):
    tabla = get_table()

    with tabla.batch_writer() as batch:
        for reclamo in reclamos:
            id_reclamo = reclamo["id_reclamo"]
            clasif = clasificaciones.get(id_reclamo, clasificacion_por_defecto())

            item = {
                "pk": f"TENANT#{tenant_id}",
                "sk": id_reclamo,
                "area_derivada": clasif["area_derivada"],
                "urgencia": clasif["urgencia"],
                "resumen_reclamo": clasif["resumen_reclamo"],
                "texto_original": reclamo["texto_original"],
                "fecha_creacion": reclamo["fecha_creacion"],
                "estado": "pendiente",
            }

            if clasif.get("requiere_revision"):
                item["requiere_revision"] = True

            batch.put_item(Item=item)

    print(f"Guardados {len(reclamos)} reclamos en DynamoDB para tenant {tenant_id}")
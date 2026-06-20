import boto3
import json
import requests
import time

# --- Configuración ---
REGION = 'us-east-1'
QUEUE_NAME = 'ReclamosQueue-dev'
TABLE_NAME = 'ReclamosProcesados-dev'
GEMINI_API_KEY = '${GEMINI_API_KEY}'  # Asegúrate de configurar esta variable de entorno con tu API Key de Gemini
# El ARN se construye usando tu ID de cuenta asignado por el laboratorio
SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:322876131322:AlertasUrgentesTopic-dev'

# Clientes de AWS
sqs = boto3.client('sqs', region_name=REGION)
sns = boto3.client('sns', region_name=REGION)
dynamodb = boto3.resource('dynamodb', region_name=REGION)
tabla = dynamodb.Table(TABLE_NAME)

queue_url = sqs.get_queue_url(QueueName=QUEUE_NAME)['QueueUrl']
gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"

def analizar_con_gemini(texto_reclamo):
    prompt = f"""
    Eres un experto analista de reclamos ciudadanos en Perú. 
    Analiza este reclamo: "{texto_reclamo}"
    Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta:
    {{"tipo_reclamo": "Breve categoría", "urgencia": "Alta/Media/Baja", "area_derivacion": "Área responsable", "resumen_ejecutivo": "Resumen de 1 linea"}}
    """
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    headers = {'Content-Type': 'application/json'}
    response = requests.post(gemini_url, json=payload, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        texto_respuesta = data['candidates'][0]['content']['parts'][0]['text']
        texto_limpio = texto_respuesta.replace('```json', '').replace('```', '').strip()
        return json.loads(texto_limpio)
    else:
        raise Exception(f"Error de GCP: {response.text}")

print("Iniciando Worker con Soporte SNS: Escuchando mensajes de SQS...")

while True:
    response = sqs.receive_message(
        QueueUrl=queue_url,
        MaxNumberOfMessages=1,
        WaitTimeSeconds=10 
    )
    
    if 'Messages' in response:
        for msg in response['Messages']:
            try:
                receipt_handle = msg['ReceiptHandle']
                cuerpo_mensaje = json.loads(msg['Body'])
                
                id_reclamo = cuerpo_mensaje.get('id_reclamo', 'desc')
                texto = cuerpo_mensaje.get('texto', '')
                
                print(f"Procesando reclamo ID: {id_reclamo}...")
                resultado_ia = analizar_con_gemini(texto)
                
                # 1. Persistencia en DynamoDB
                item_db = {
                    'id_reclamo': id_reclamo,
                    'texto_original': texto,
                    'tipo': resultado_ia['tipo_reclamo'],
                    'urgencia': resultado_ia['urgencia'],
                    'area': resultado_ia['area_derivacion'],
                    'resumen': resultado_ia['resumen_ejecutivo']
                }
                tabla.put_item(Item=item_db)
                print(f"✅ Reclamo {id_reclamo} guardado en DynamoDB.")
                
                # 2. PATRÓN FAN-OUT: Evaluar urgencia para alertas críticas
                urgencia_detectada = resultado_ia.get('urgencia', 'Media')
                if "Alta" in urgencia_detectada or urgencia_detectada == "Alta":
                    mensaje_alerta = f"""
                    🚨 ALERTA CRÍTICA DE ATENCIÓN AL CIUDADANO 🚨
                    
                    Se ha clasificado un reclamo con prioridad ALTA.
                    
                    ID Reclamo: {id_reclamo}
                    Categoría: {resultado_ia['tipo_reclamo']}
                    Área de Asignación: {resultado_ia['area_derivacion']}
                    
                    Resumen Ejecutivo: {resultado_ia['resumen_ejecutivo']}
                    
                    Texto Original del Ciudadano:
                    "{texto}"
                    --------------------------------------------------
                    Módulo de Triaje Inteligente Multi-Cloud Asíncrono.
                    """
                    
                    sns.publish(
                        TopicArn=SNS_TOPIC_ARN,
                        Message=mensaje_alerta,
                        Subject=f"⚠️ URGENCIA ALTA: Reclamo N° {id_reclamo}"
                    )
                    print(f"📢 Alerta urgente publicada en SNS para el reclamo {id_reclamo}.")
                
                # 3. Confirmar eliminación en SQS
                sqs.delete_message(QueueUrl=queue_url, ReceiptHandle=receipt_handle)
                
            except Exception as e:
                print(f"❌ Error procesando mensaje: {e}")
    else:
        pass
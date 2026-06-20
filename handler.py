import json
import boto3
import csv
import urllib.parse

s3_client = boto3.client('s3')
sqs_client = boto3.client('sqs')
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
tabla_resultados = dynamodb.Table('ReclamosProcesados-dev')

# --- DISPACHER: Ingesta asíncrona ---
def process_csv(event, context):
    try:
        bucket = event['Records'][0]['s3']['bucket']['name']
        key = urllib.parse.unquote_plus(event['Records'][0]['s3']['object']['key'], encoding='utf-8')
        
        response = s3_client.get_object(Bucket=bucket, Key=key)
        lines = response['Body'].read().decode('utf-8').splitlines()
        reader = csv.DictReader(lines)
        
        queue_url_response = sqs_client.get_queue_url(QueueName='ReclamosQueue-dev')
        queue_url = queue_url_response['QueueUrl']
        
        mensajes_enviados = 0
        for row in reader:
            sqs_client.send_message(
                QueueUrl=queue_url,
                MessageBody=json.dumps(row)
            )
            mensajes_enviados += 1
            
        return {
            "statusCode": 200,
            "body": json.dumps({"message": f"Se encolaron {mensajes_enviados} reclamos."})
        }
    except Exception as e:
        print(f"Error en dispatcher: {str(e)}")
        raise e

# --- GET_RECLAMOS: Nueva API síncrona para el Frontend ---
def get_reclamos(event, context):
    try:
        # Recuperamos todos los registros procesados por la IA
        response = tabla_resultados.scan()
        items = response.get('Items', [])
        
        # Retornamos los datos con los headers necesarios para evitar bloqueos CORS en el navegador
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            },
            "body": json.dumps(items, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error en API get_reclamos: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": f"Error al leer la base de datos: {str(e)}"})
        }
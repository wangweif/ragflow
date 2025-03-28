from elasticsearch import Elasticsearch
import sys

try:
    es = Elasticsearch(
        hosts=['http://localhost:1200'],
        basic_auth=('elastic', 'infini_rag_flow')
    )
    
    info = es.info()
    print(f"Successfully connected to Elasticsearch: {info}")
    sys.exit(0)
except Exception as e:
    print(f"Failed to connect to Elasticsearch: {e}")
    sys.exit(1) 
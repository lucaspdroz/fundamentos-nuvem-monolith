# API (FastAPI)

## Rodando localmente

```bash
cd app
python -m venv .venv
.venv\Scripts\activate         
pip install -r requirements.txt
uvicorn main:app --reload
```

- API: http://localhost:8000
- Documentação interativa (Swagger): http://localhost:8000/docs

> Ainda não há endpoints implementados.

## Estrutura

```text
app/
├── main.py             # ponto de entrada (instância do FastAPI)
├── src/
│   ├── controllers/    # rotas/endpoints (APIRouter)
│   ├── services/       # regras de negócio
│   ├── repositories/   # acesso ao banco de dados
│   ├── models/         # entidades do banco
│   ├── schemas/        # modelos Pydantic de entrada/saída
│   ├── core/           # configurações da aplicação
│   └── database/       # conexão com o banco
├── tests/              # testes
├── .env.example        # exemplo de variáveis de ambiente
├── requirements.txt
└── Dockerfile
```

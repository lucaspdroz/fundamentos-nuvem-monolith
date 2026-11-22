# API (FastAPI)

## Rodando localmente

```bash
cd app
python -m venv .venv
.venv\Scripts\activate         
pip install -r requirements.txt
uvicorn main:app --reload
```

- API: <http://localhost:8000>
- Documentação interativa (Swagger): <http://localhost:8000/docs>

O banco padrão é SQLite em `./data/classmate.db` (criado automaticamente). Para trocar (ex.: Aurora), defina `DATABASE_URL` no `.env`.

## Endpoints

Todas as rotas da API usam o prefixo `/api/v1`. A matrícula (`registration`) é obrigatória, única e com no mínimo 4 caracteres.

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/` | health check (usado pelo ALB) |
| `POST` | `/api/v1/auth/login` | login `{ "registration": "..." }`: retorna o aluno ou 404 (vai para o cadastro) |
| `POST` | `/api/v1/students` | cadastro (409 se a matrícula já existe) |
| `GET` | `/api/v1/students/{id}` | busca o aluno pelo id |
| `PUT` | `/api/v1/students/{id}` | atualiza o cadastro |
| `GET` | `/api/v1/students/{registration}/presences` | dashboard: `presences`, `absences` (datas), `present_today` e `total_absences` |
| `POST` | `/api/v1/students/{registration}/presences` | check presence `{ "room": "Lab 04" }` (409 se já fez hoje) |
| `GET` | `/api/v1/students?course=&turn=` | professor view: alunos em ordem alfabética com `status` |

**Faltas:** como não há calendário de aulas, um dia de aula é qualquer dia (antes de hoje e depois do cadastro do aluno) em que alguém do mesmo curso e turno fez presença. Falta é um desses dias sem presença do aluno.

**Status (professor view):** `warning` se faltas > `ABSENCE_LIMIT` (padrão 5), senão `present` se fez presença hoje, senão `default`.

## Rodando com Docker

```bash
cd app
docker build -t fundamentos-nuvem-api .
docker run -p 8000:8000 fundamentos-nuvem-api
```

- API: <http://localhost:8000>
- Documentação interativa (Swagger): <http://localhost:8000/docs>

## Estrutura

```text
app/
├── main.py             # ponto de entrada (instância do FastAPI)
├── src/
│   ├── controllers/    # rotas/endpoints (APIRouter) + dependencies.py
│   ├── services/       # regras de negócio
│   ├── repositories/   # acesso ao banco de dados
│   ├── models/         # entidades do banco
│   ├── schemas/        # modelos Pydantic de entrada/saída
│   ├── core/           # configurações, fuso horário, exceções e logging
│   ├── database/       # conexão com o banco
│   └── middlewares/    # tratamento de erros
├── .env.example        # exemplo de variáveis de ambiente
├── requirements.txt
└── Dockerfile
```

Dentro de `controllers/`, `services/`, `repositories/`, `models/` e `schemas/` há uma subpasta por domínio: `students/` e `presences/`.

## Logs (CloudWatch)

A API escreve logs em JSON no stdout. Na AWS, o Docker envia o stdout para o CloudWatch Logs (driver `awslogs`), no Log Group `/classmate/<stack>/api`, com um stream por EC2 (`app-a`, `app-b`). O health check do ALB (`GET /`) não é logado.

Campo `event` de cada log:

| `event` | Quando |
| --- | --- |
| `http.request` | toda requisição (`method`, `path`, `status_code`) |
| `student.created` / `student.updated` | cadastro / atualização de aluno |
| `presence.checked_in` | check presence (`registration`, `course`, `turn`, `room`) |
| `app.error` | erros esperados: 404, 409 (`status_code`, `path`) |
| `app.unhandled_error` | erro 500, com o traceback em `exception` |

Exemplos de consulta (CloudWatch Logs Insights, também usados no data source CloudWatch do Grafana):

```text
filter event = "presence.checked_in"
| stats count(*) as presencas by bin(1h)

filter event = "http.request"
| stats count(*) by status_code

filter level = "ERROR"
| fields @timestamp, path, message, exception
| sort @timestamp desc
```

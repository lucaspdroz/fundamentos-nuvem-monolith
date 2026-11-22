# Infra e CI/CD

## Estrutura

```text
infra/
├── backend/        cloudformation.yaml: rede (VPC, subnets, Security Groups) + API (ALB, EC2, ECR, logs)
├── database/       stack do banco de dados
├── monitoring/     stack do monitoramento
├── frontend/       stack do frontend
├── scripts/        deploy-stack.sh e rollout-api.sh (usados pelo pipeline)
└── README.md
```

Cada pasta vira uma stack com o mesmo nome (`backend`, `database`, `monitoring`, `frontend`), sempre com o template em `infra/<pasta>/cloudformation.yaml`.

Todo recurso criado por uma stack usa o nome dela como prefixo: o backend cria `backend-vpc`, `backend-alb`, `backend-app-a`..., o frontend cria `frontend-...`, e assim por diante. Nos templates, monte os nomes com `!Sub ${AWS::StackName}-<recurso>` em vez de escrever o prefixo fixo. A rede fica na stack `backend`; as outras importam os exports dela, então a ordem do deploy é: **backend → database → monitoring → frontend**.

## Pipeline (`.github/workflows/ci-cd.yml`)

| Job | Quando roda | O que faz |
| --- | --- | --- |
| Backend | todo push e PR | instala dependências, roda os testes de `app/tests` (se existirem), verifica se a API sobe e builda a imagem Docker |
| Frontend | desativado no momento (`if: false`) | `npm ci`, build e testes do Angular |
| Infra | todo push e PR | `cfn-lint` em todos os templates `infra/**/*.yaml`, detecta quais stacks têm template e se a branch faz deploy |
| Deploy backend | push na `main` ou em branch terminada em `-deploy` (ex.: `feature/login-deploy`) | stack `backend`, build/push da imagem no ECR e rolling deploy nas EC2 |
| Deploy database | depois do backend, se existir `infra/database/cloudformation.yaml` | stack `database` |
| Deploy monitoring | depois do database (ou do backend, se o database foi pulado), se existir `infra/monitoring/cloudformation.yaml` | stack `monitoring` |
| Deploy frontend | depois do monitoring, se existir `infra/frontend/cloudformation.yaml` | stack `frontend` |

Os jobs de deploy rodam encadeados na ordem backend → database → monitoring → frontend. Uma stack sem template aparece como pulada (skipped) e não bloqueia as seguintes; uma stack que falha interrompe as seguintes. O deploy do backend depende dos jobs Backend e Infra. O job Frontend está pulado (`if: false`) até o teste desatualizado `should render title` (`frontend/src/app/app.spec.ts`) ser corrigido; para reativar, remova essa linha do job.

## Credenciais do Learner Lab (obrigatório)

O Learner Lab não permite criar usuário IAM nem OIDC, então o pipeline usa as credenciais temporárias da sessão. Elas expiram em ~4h e mudam a cada **Start Lab**.

Antes de fazer merge/push na `main`:

1. No Learner Lab: **Start Lab** → **AWS Details** → **AWS CLI: Show**.
2. No GitHub: **Settings → Secrets and variables → Actions**, atualizar os 3 secrets:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_SESSION_TOKEN`

Com o lab desligado ou os secrets vencidos, o job de deploy falha (os outros jobs continuam funcionando). Depois de atualizar os secrets, rode de novo pelo botão **Run workflow** na `main`.

## Como o deploy da API funciona

1. `infra/scripts/deploy-stack.sh` cria/atualiza a stack `backend` (`infra/backend/cloudformation.yaml`). Se a stack estiver em `ROLLBACK_COMPLETE` (criação anterior falhou), ela é removida e recriada.
2. A imagem da API é buildada e enviada ao ECR da stack com as tags `<sha do commit>` e `latest`.
3. `infra/scripts/rollout-api.sh` atualiza uma EC2 por vez via SSM: tira a instância do ALB, roda `/opt/classmate/deploy.sh <imagem>` (pull + restart do container), devolve ao ALB e espera ficar healthy. A outra AZ continua atendendo durante o deploy.

Ao subir pela primeira vez, as EC2 nascem antes da imagem existir no ECR; quem publica a API nesse caso é o passo 3.

## Adicionando a sua stack (banco, monitoramento, frontend)

1. Crie o template na pasta da sua área: `infra/database/cloudformation.yaml`, `infra/monitoring/cloudformation.yaml` ou `infra/frontend/cloudformation.yaml`.
2. Pronto: o `cfn-lint` passa a validá-lo e o job de deploy da sua área (`deploy-database`, `deploy-monitoring` ou `deploy-frontend`) deixa de ser pulado no próximo push.

Para usar a VPC, subnets e Security Groups da stack `backend`, importe os exports dela (`!ImportValue backend-VpcId`, `backend-PublicSubnetIds`, `backend-MonitoringSecurityGroupId`, ...).

Se a sua stack precisar de parâmetros, coloque valores padrão (`Default`) no template ou adicione no passo do seu job no formato `Chave=Valor` depois do template:

```yaml
- name: Stack do monitoring
  run: bash infra/scripts/deploy-stack.sh monitoring infra/monitoring/cloudformation.yaml GrafanaAllowedCidr=0.0.0.0/0
```

Passos extras da sua área (por exemplo, enviar o build do Angular para um bucket S3 no frontend) entram no mesmo job, depois do passo da stack.

## Deploy manual (sem o pipeline)

Com as credenciais do Learner Lab configuradas no terminal:

```bash
bash infra/scripts/deploy-stack.sh backend infra/backend/cloudformation.yaml
REPO=$(aws cloudformation describe-stacks --stack-name backend --query "Stacks[0].Outputs[?OutputKey=='ApiRepositoryUri'].OutputValue" --output text)
aws ecr get-login-password | docker login --username AWS --password-stdin "${REPO%%/*}"
docker build -t "$REPO:manual" app && docker push "$REPO:manual"
bash infra/scripts/rollout-api.sh backend "$REPO:manual"
```

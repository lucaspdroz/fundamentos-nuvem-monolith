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

Um job por stack, encadeados: **Backend → Database → Monitoring → Frontend**. Cada job cuida de tudo da sua área, da checagem ao deploy.

| Job | Checagem (todo push e PR) | Deploy (push na `main` ou em branch terminada em `-deploy`) |
| --- | --- | --- |
| Backend | dependências, testes de `app/tests` (se existirem), verifica se a API sobe, build da imagem e `cfn-lint` do template | stack `backend`, push da imagem no ECR e rolling deploy nas EC2 |
| Database | `cfn-lint` de `infra/database/cloudformation.yaml` | stack `database` |
| Monitoring | `cfn-lint` de `infra/monitoring/cloudformation.yaml` | stack `monitoring` |
| Frontend | `cfn-lint` de `infra/frontend/cloudformation.yaml` | stack `frontend` |

Se a pasta da área ainda não tem `cloudformation.yaml`, os passos do job são pulados e ele termina verde, sem bloquear os seguintes. Os jobs são independentes: cada um espera o anterior terminar (para manter a ordem), mas roda mesmo que o anterior tenha falhado. Só param se o run for cancelado.

Em PR e em branches que não fazem deploy, só a checagem roda. Runs que fazem deploy entram numa fila única: se dois forem disparados juntos, o segundo espera o primeiro terminar.

## Credenciais do Learner Lab (obrigatório)

O Learner Lab não permite criar usuário IAM nem OIDC, então o pipeline usa as credenciais temporárias da sessão. Elas expiram em ~4h e mudam a cada **Start Lab**.

Antes de fazer merge/push na `main`:

1. No Learner Lab: **Start Lab** → **AWS Details** → **AWS CLI: Show**.
2. No GitHub: **Settings → Secrets and variables → Actions**, atualizar os 3 secrets:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_SESSION_TOKEN`

Com o lab desligado ou os secrets vencidos, o job Backend falha no passo "Credenciais AWS" (a checagem antes dele continua funcionando) e os jobs seguintes não rodam. Depois de atualizar os secrets, rode de novo pelo botão **Run workflow** na `main`.

## Como o deploy da API funciona

1. `infra/scripts/deploy-stack.sh` cria/atualiza a stack `backend` (`infra/backend/cloudformation.yaml`). Se a stack estiver em `ROLLBACK_COMPLETE` (criação anterior falhou), ela é removida e recriada.
2. A imagem da API é buildada e enviada ao ECR da stack com as tags `<sha do commit>` e `latest`.
3. `infra/scripts/rollout-api.sh` atualiza uma EC2 por vez via SSM: tira a instância do ALB, roda `/opt/classmate/deploy.sh <imagem>` (pull + restart do container), devolve ao ALB e espera ficar healthy. A outra AZ continua atendendo durante o deploy.

Ao subir pela primeira vez, as EC2 nascem antes da imagem existir no ECR; quem publica a API nesse caso é o passo 3.

## Adicionando a sua stack (banco, monitoramento, frontend)

1. Crie o template na pasta da sua área: `infra/database/cloudformation.yaml`, `infra/monitoring/cloudformation.yaml` ou `infra/frontend/cloudformation.yaml`.
2. Pronto: no próximo push, o job da sua área (`database`, `monitoring` ou `frontend`) passa a validar o template e, numa branch de deploy, publicar a stack.

Para usar a VPC, subnets e Security Groups da stack `backend`, importe os exports dela (`!ImportValue backend-VpcId`, `backend-PublicSubnetIds`, `backend-MonitoringSecurityGroupId`, ...).

Se a sua stack precisar de parâmetros, coloque valores padrão (`Default`) no template ou adicione no passo "Deploy da stack" do seu job, no formato `Chave=Valor` depois do template:

```yaml
- name: Deploy da stack
  if: steps.template.outputs.exists == 'true' && env.DEPLOY == 'true'
  run: bash infra/scripts/deploy-stack.sh "$STACK_NAME" "$TEMPLATE" GrafanaAllowedCidr=0.0.0.0/0
```

Tudo o mais da sua área entra no mesmo job: dependências, build e testes antes da validação do template, e passos pós-deploy (por exemplo, enviar o build do Angular para um bucket S3) depois do "Deploy da stack", com o mesmo `if`.

## Deploy manual (sem o pipeline)

Com as credenciais do Learner Lab configuradas no terminal:

```bash
bash infra/scripts/deploy-stack.sh backend infra/backend/cloudformation.yaml
REPO=$(aws cloudformation describe-stacks --stack-name backend --query "Stacks[0].Outputs[?OutputKey=='ApiRepositoryUri'].OutputValue" --output text)
aws ecr get-login-password | docker login --username AWS --password-stdin "${REPO%%/*}"
docker build -t "$REPO:manual" app && docker push "$REPO:manual"
bash infra/scripts/rollout-api.sh backend "$REPO:manual"
```

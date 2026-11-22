# Infra e CI/CD

## Pipeline (`.github/workflows/ci-cd.yml`)

| Job | Quando roda | O que faz |
| --- | --- | --- |
| Backend | todo push e PR | instala dependências, roda os testes de `app/tests` (se existirem), verifica se a API sobe e builda a imagem Docker |
| Frontend | desativado no momento (`if: false`) | `npm ci`, build e testes do Angular |
| Infra | todo push e PR | `cfn-lint` em todos os templates `infra/**/*.yaml` |
| Deploy na AWS | push na `main` (ou "Run workflow" na `main`) | deploy das stacks, build/push da imagem no ECR e rolling deploy nas EC2 |

O deploy depende dos jobs Backend e Infra. O job Frontend está pulado (`if: false`) até o teste desatualizado `should render title` (`frontend/src/app/app.spec.ts`) ser corrigido; para reativar, remova essa linha do job.

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

1. `infra/scripts/deploy-stack.sh` cria/atualiza a stack `backend` (`infra/cloudformation.yaml`). Se a stack estiver em `ROLLBACK_COMPLETE` (criação anterior falhou), ela é removida e recriada.
2. A imagem da API é buildada e enviada ao ECR da stack com as tags `<sha do commit>` e `latest`.
3. `infra/scripts/rollout-api.sh` atualiza uma EC2 por vez via SSM: tira a instância do ALB, roda `/opt/classmate/deploy.sh <imagem>` (pull + restart do container), devolve ao ALB e espera ficar healthy. A outra AZ continua atendendo durante o deploy.

Ao subir pela primeira vez, as EC2 nascem antes da imagem existir no ECR; quem publica a API nesse caso é o passo 3.

## Adicionando a sua stack (monitoramento, banco, frontend...)

1. Crie o template em `infra/` (ex.: `infra/monitoring.yaml`). O `cfn-lint` passa a validá-lo automaticamente.
2. No job `deploy` do workflow, adicione um passo depois de "Stack do backend" (se depender dos exports dela) chamando o mesmo script:

   ```yaml
   - name: Stack de monitoramento
     run: bash infra/scripts/deploy-stack.sh monitoring infra/monitoring.yaml GrafanaAllowedCidr=0.0.0.0/0
   ```

   Parâmetros vão no formato `Chave=Valor` depois do template. Para usar a VPC, subnets e Security Groups da stack `backend`, importe os exports dela (`!ImportValue backend-VpcId`, `backend-PublicSubnetIds`, `backend-MonitoringSecurityGroupId`, ...).

## Deploy manual (sem o pipeline)

Com as credenciais do Learner Lab configuradas no terminal:

```bash
bash infra/scripts/deploy-stack.sh backend infra/cloudformation.yaml
REPO=$(aws cloudformation describe-stacks --stack-name backend --query "Stacks[0].Outputs[?OutputKey=='ApiRepositoryUri'].OutputValue" --output text)
aws ecr get-login-password | docker login --username AWS --password-stdin "${REPO%%/*}"
docker build -t "$REPO:manual" app && docker push "$REPO:manual"
bash infra/scripts/rollout-api.sh backend "$REPO:manual"
```

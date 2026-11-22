#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Uso: $0 <stack-name> <image-uri>" >&2
  exit 1
fi

STACK_NAME="$1"
IMAGE_URI="$2"

stack_output() {
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text
}

wait_ssm_online() {
  local instance_id="$1"
  for _ in $(seq 1 60); do
    ping=$(aws ssm describe-instance-information \
      --filters "Key=InstanceIds,Values=$instance_id" \
      --query "InstanceInformationList[0].PingStatus" \
      --output text)
    if [ "$ping" = "Online" ]; then
      return 0
    fi
    sleep 10
  done
  echo "A instancia $instance_id nao ficou Online no SSM em 10 minutos" >&2
  return 1
}

run_deploy() {
  local instance_id="$1"
  local command_id
  command_id=$(aws ssm send-command \
    --instance-ids "$instance_id" \
    --document-name AWS-RunShellScript \
    --comment "deploy ${IMAGE_URI##*:}" \
    --parameters "commands=[\"cloud-init status --wait || true\",\"/opt/classmate/deploy.sh $IMAGE_URI\"]" \
    --query "Command.CommandId" \
    --output text)

  if ! aws ssm wait command-executed --command-id "$command_id" --instance-id "$instance_id"; then
    echo "O deploy falhou em $instance_id:" >&2
    aws ssm get-command-invocation \
      --command-id "$command_id" \
      --instance-id "$instance_id" \
      --query "[Status, StandardOutputContent, StandardErrorContent]" \
      --output text >&2 || true
    return 1
  fi
}

TARGET_GROUP_ARN=$(stack_output AppTargetGroupArn)
APP_PORT=$(aws elbv2 describe-target-groups \
  --target-group-arns "$TARGET_GROUP_ARN" \
  --query "TargetGroups[0].Port" \
  --output text)
INSTANCE_IDS=$(stack_output AppInstanceIds | tr ',' ' ')

for instance_id in $INSTANCE_IDS; do
  target="Id=$instance_id,Port=$APP_PORT"
  echo "==> $instance_id: aguardando SSM"
  wait_ssm_online "$instance_id"

  echo "==> $instance_id: removendo do ALB"
  aws elbv2 deregister-targets --target-group-arn "$TARGET_GROUP_ARN" --targets "$target"
  aws elbv2 wait target-deregistered --target-group-arn "$TARGET_GROUP_ARN" --targets "$target"

  echo "==> $instance_id: atualizando para $IMAGE_URI"
  if ! run_deploy "$instance_id"; then
    aws elbv2 register-targets --target-group-arn "$TARGET_GROUP_ARN" --targets "$target"
    exit 1
  fi

  echo "==> $instance_id: voltando para o ALB"
  aws elbv2 register-targets --target-group-arn "$TARGET_GROUP_ARN" --targets "$target"
  aws elbv2 wait target-in-service --target-group-arn "$TARGET_GROUP_ARN" --targets "$target"
  echo "==> $instance_id: healthy"
done

#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Uso: $0 <stack-name> <template-file> [Chave=Valor ...]" >&2
  exit 1
fi

STACK_NAME="$1"
TEMPLATE_FILE="$2"
shift 2

status=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].StackStatus" \
  --output text 2>/dev/null || echo "NONE")

if [ "$status" = "ROLLBACK_COMPLETE" ]; then
  echo "Stack $STACK_NAME em ROLLBACK_COMPLETE (criacao anterior falhou). Removendo para recriar."
  aws cloudformation delete-stack --stack-name "$STACK_NAME"
  aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME"
fi

args=(
  --stack-name "$STACK_NAME"
  --template-file "$TEMPLATE_FILE"
  --no-fail-on-empty-changeset
)
if [ "$#" -gt 0 ]; then
  args+=(--parameter-overrides "$@")
fi

echo "Deploy da stack $STACK_NAME ($TEMPLATE_FILE)"
if ! aws cloudformation deploy "${args[@]}"; then
  echo "Falha no deploy de $STACK_NAME. Eventos com erro:" >&2
  aws cloudformation describe-stack-events \
    --stack-name "$STACK_NAME" \
    --max-items 20 \
    --query "StackEvents[?contains(ResourceStatus, 'FAILED')].[LogicalResourceId, ResourceStatusReason]" \
    --output table >&2 || true
  exit 1
fi

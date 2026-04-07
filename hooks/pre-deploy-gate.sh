#!/bin/bash
# Quality gates before production deploy

echo "◆ Pre-deploy gate..."

# TypeScript check
if [ -f "tsconfig.json" ]; then
  if ! npx tsc --noEmit 2>/dev/null; then
    echo "BLOCKED: TypeScript errors. Fix before deploying."
    exit 1
  fi
  echo "  ✓ TypeScript"
fi

# Lint check
if [ -f "package.json" ] && grep -q '"lint"' package.json; then
  if ! npm run lint 2>/dev/null; then
    echo "BLOCKED: Lint errors. Fix before deploying."
    exit 1
  fi
  echo "  ✓ Lint"
fi

# Test check
if [ -f "package.json" ] && grep -q '"test"' package.json; then
  if ! npm test 2>/dev/null; then
    echo "BLOCKED: Tests failed. Fix before deploying."
    exit 1
  fi
  echo "  ✓ Tests"
fi

# Build check
if [ -f "package.json" ] && grep -q '"build"' package.json; then
  if ! npm run build 2>/dev/null; then
    echo "BLOCKED: Build failed. Fix before deploying."
    exit 1
  fi
  echo "  ✓ Build"
fi

# Security: no service_role in client code
LEAKS=$(grep -r "service_role" app/ components/ src/ 2>/dev/null | grep -v node_modules | grep -v ".server." | wc -l)
if [ "$LEAKS" -gt 0 ]; then
  echo "BLOCKED: service_role found in client code. Remove before deploying."
  exit 1
fi
echo "  ✓ Security"

echo "◆ All gates passed."

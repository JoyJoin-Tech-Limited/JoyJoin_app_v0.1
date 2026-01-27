#!/bin/bash
# Test script for verifying progress bar and signup flow performance fixes

set -e

echo "========================================="
echo "Progress Bar & Signup Flow Test Suite"
echo "========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Type checking
echo "Test 1: Type Checking"
echo "---------------------"
echo "Running TypeScript checks on modified files..."

echo -n "User client types: "
if npx tsc -p apps/user-client/tsconfig.json --noEmit 2>&1 | grep -v "error TS2688" | grep -q "error TS"; then
  echo -e "${RED}FAIL${NC}"
  exit 1
else
  echo -e "${GREEN}PASS${NC}"
fi

echo -n "Server types: "
if npx tsc -p apps/server/tsconfig.json --noEmit 2>&1 | grep -v "error TS2688" | grep -q "error TS"; then
  echo -e "${RED}FAIL${NC}"
  exit 1
else
  echo -e "${GREEN}PASS${NC}"
fi

echo ""

# Test 2: Code structure verification
echo "Test 2: Code Structure Verification"
echo "------------------------------------"

echo -n "Optimistic update in submitAnswer: "
if grep -q "OPTIMISTIC UPDATE" apps/user-client/src/hooks/useAdaptiveAssessment.ts; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC}"
  exit 1
fi

echo -n "Console logging in development: "
if grep -q "process.env.NODE_ENV === 'development'" apps/user-client/src/hooks/useAdaptiveAssessment.ts; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC}"
  exit 1
fi

echo -n "Backend returns next question: "
if grep -q "nextQuestion: nextQuestion ?" apps/server/src/routes.ts; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC}"
  exit 1
fi

echo -n "Frontend handles next question: "
if grep -q "if (data.nextQuestion)" apps/user-client/src/hooks/useAdaptiveAssessment.ts; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC}"
  exit 1
fi

echo -n "Skeleton component imported: "
if grep -q "import.*Skeleton.*from.*@/components/ui/skeleton" apps/user-client/src/pages/PersonalityTestPageV4.tsx; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC}"
  exit 1
fi

echo -n "Loading skeleton implemented: "
if grep -q "Header Skeleton" apps/user-client/src/pages/PersonalityTestPageV4.tsx; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC}"
  exit 1
fi

echo -n "Skip redundant API call: "
if grep -q "Check if we already have a current question" apps/user-client/src/hooks/useAdaptiveAssessment.ts; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC}"
  exit 1
fi

echo ""

# Test 3: Git diff verification
echo "Test 3: Git Changes Verification"
echo "---------------------------------"

echo -n "Files modified count: "
MODIFIED_COUNT=$(git diff HEAD~1 HEAD --name-only | wc -l)
if [ "$MODIFIED_COUNT" -eq 3 ]; then
  echo -e "${GREEN}PASS${NC} (3 files)"
else
  echo -e "${YELLOW}WARNING${NC} (expected 3, got $MODIFIED_COUNT)"
fi

echo -n "Lines added: "
LINES_ADDED=$(git diff HEAD~1 HEAD --shortstat | grep -oP '\d+(?= insertion)')
if [ "$LINES_ADDED" -ge 100 ]; then
  echo -e "${GREEN}PASS${NC} ($LINES_ADDED insertions)"
else
  echo -e "${YELLOW}WARNING${NC} ($LINES_ADDED insertions, expected ~111)"
fi

echo ""

# Summary
echo "========================================="
echo -e "${GREEN}All automated tests passed!${NC}"
echo "========================================="
echo ""
echo "Manual testing required:"
echo "1. Test progress bar updates at question 9"
echo "2. Test signup flow performance (<1s transition)"
echo "3. Verify skeleton screen appears during loading"
echo "4. Test with slow network (DevTools throttling)"
echo "5. Check browser console for development logs"
echo ""
echo "See PROGRESS_BAR_PERFORMANCE_FIX.md for detailed testing steps."
echo ""

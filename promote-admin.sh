#!/bin/bash

# Script to promote a user to admin
# Usage: ./promote-admin.sh <phoneNumber> [secretKey]
# If secretKey is not provided, it will use the default or prompt

PHONE_NUMBER="${1:-19896500978}"
SECRET_KEY="${2:-${ADMIN_PROMOTE_SECRET:-CHANGE_THIS_IN_PRODUCTION}}"

echo "Promoting user with phone number: $PHONE_NUMBER"
echo "Using secret key: ${SECRET_KEY:0:10}..."

curl -X POST http://localhost:5000/api/admin/promote-user \
  -H "Content-Type: application/json" \
  -d "{
    \"phoneNumber\": \"$PHONE_NUMBER\",
    \"secretKey\": \"$SECRET_KEY\"
  }" | jq .

echo ""
echo "If successful, you can now log in to the admin portal at http://localhost:5000/admin/login"
echo "Phone: $PHONE_NUMBER"
echo "Password: Lasalle11"




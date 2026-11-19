#!/bin/sh
# Creates demo accounts through the backend API. The signup page sends an email
# OTP, so without SMTP configured these are the accounts to sign in with.
# Safe to re-run: the backend rejects emails that already exist.
API="http://backend:2706/api/v1/auth/signup"
PASSWORD="JivikaDemo2026"

signup() {
  curl -s -o /dev/null -w "$1: %{http_code}\n" -X POST "$API" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$PASSWORD\",\"name\":\"$2\",\"role\":\"$3\",\"hospital\":$4}"
}

signup demo.patient@jivika.test "Demo Patient" USER null
signup asha.rao@jivika.test "Dr. Asha Rao" DOCTOR '"City General Hospital"'
signup vikram.nair@jivika.test "Dr. Vikram Nair" DOCTOR '"Lakeside Heart Institute"'
signup meera.iyer@jivika.test "Dr. Meera Iyer" DOCTOR '"Sunrise Medical Centre"'

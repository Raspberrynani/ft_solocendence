#!/bin/bash

# Debug script to diagnose WebSocket and Django connectivity issues

echo "===== DEBUGGING SOLOCENDENCE SETUP ====="
echo ""

echo "1. Checking container status:"
docker-compose ps
echo ""

echo "2. Checking backend logs:"
docker-compose logs --tail=50 backend | grep -E 'error|Error|WARNING|CRITICAL|daphne|channels|WebSocket|CORS'
echo ""

echo "3. Checking nginx logs:"
docker-compose logs --tail=50 frontend | grep -E 'error|Error|WARNING|proxy|WebSocket|ws|upgrade'
echo ""

echo "4. Checking CORS settings in Django:"
docker-compose exec backend grep -r "CORS_" backend/settings.py
docker-compose exec backend grep -r "CSRF_" backend/settings.py
echo ""

echo "5. Testing WebSocket connectivity from within the container:"
docker-compose exec backend curl -v -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Host: localhost" \
  -H "Origin: http://localhost" \
  http://localhost:8001/ws/pong/
echo ""

echo "6. Testing API connectivity from within the container:"
docker-compose exec backend curl -v http://localhost:8000/api/csrf/
echo ""

echo "7. Container networking:"
docker-compose exec backend cat /etc/hosts
docker-compose exec backend ip addr show
echo ""

echo "===== DEBUG COMPLETE ====="
echo "If problems persist, try:"
echo "  1. Run 'make re' to rebuild everything"
echo "  2. Check browser console for detailed JavaScript errors"
echo "  3. Ensure frontend WebSocket URL matches the correct port (8001)"
#!/bin/bash

echo "=== Verifying Installations ==="
echo

echo "Node.js version:"
node --version
echo

echo "npm version:"
npm --version
echo

echo "PM2 version:"
pm2 --version
echo

echo "nginx version:"
nginx -v
echo

echo "SQLite version:"
sqlite3 --version
echo

echo "=== Installation Check Complete ==="



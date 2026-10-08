#!/bin/bash
cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
    echo "Ilk kurulum yapiliyor..."
    npm install
fi

echo "🚀 DevLog aciliyor..."
npm start

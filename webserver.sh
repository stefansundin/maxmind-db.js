#!/bin/bash -e

echo "http://localhost:8000/"
set -x
python3 -m http.server

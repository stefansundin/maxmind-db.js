#!/bin/bash -e

# To test the PWA app you have to serve the page from https://.
# Use nginx.sh to do that instead of this.

echo "http://localhost:8000/"
set -x
python3 -m http.server

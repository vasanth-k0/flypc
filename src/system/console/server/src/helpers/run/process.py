import sys
import json

for key, value in json.loads(sys.argv[2]).items():
    globals()[key] = value
    
with open(sys.argv[1], 'r') as f:
    exec(f.read())
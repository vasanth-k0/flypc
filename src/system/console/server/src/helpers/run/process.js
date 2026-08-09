const data = JSON.parse(process.argv[3]);
for (const [key, value] of Object.entries(data)) {
    global[key] = value;
}
require(process.argv[2]); 
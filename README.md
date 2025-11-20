# proof-of-timestamp
A minimal Bitcoin-style timestamp service demonstrating how hashed transactions are chained to form an immutable ledger.

# Bitcoin Clone Walkthrough

## Prerequisites
- Node.js installed
- `npm install` run in the project directory

## Running the Node
1. Start the first node:
   ```bash
   npm start
   ```
   This will start the HTTP server on port 3001 and P2P server on port 6001.

2. Start a second node (in a separate terminal):
   ```bash
   HTTP_PORT=3002 P2P_PORT=6002 npm start
   ```

## Interacting with the Node

### Get Blockchain
```bash
curl http://localhost:3001/blocks
```

### Mine a Block
```bash
curl -X POST http://localhost:3001/mineBlock
```

### Get Balance
```bash
curl http://localhost:3001/balance
```

### Send Transaction
To send a transaction, you first need the address of the recipient (e.g., from the second node).
1. Get address of Node 2:
   ```bash
   curl http://localhost:3002/address
   ```
2. Send coins from Node 1 to Node 2:
   ```bash
   curl -H "Content-type:application/json" --data '{"address": "NODE_2_ADDRESS", "amount": 10}' http://localhost:3001/mineTransaction
   ```

### Connect Peers
To connect Node 2 to Node 1:
```bash
curl -H "Content-type:application/json" --data '{"peer": "ws://localhost:6001"}' http://localhost:3002/addPeer
```

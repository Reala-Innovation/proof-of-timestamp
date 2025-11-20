import WebSocket from 'ws';
import { Server } from 'ws';
import { Block } from '../core/Block';
import { Blockchain } from '../core/Blockchain';
import { Transaction } from '../core/Transaction';
import { TransactionPool } from '../core/TransactionPool';

enum MessageType {
    QUERY_LATEST = 0,
    QUERY_ALL = 1,
    RESPONSE_BLOCKCHAIN = 2,
    QUERY_TRANSACTION_POOL = 3,
    RESPONSE_TRANSACTION_POOL = 4
}

class Message {
    public type: MessageType;
    public data: any;

    constructor(type: MessageType, data: any) {
        this.type = type;
        this.data = data;
    }
}

export class P2P {
    private sockets: WebSocket[];
    private blockchain: Blockchain;
    private transactionPool: TransactionPool;

    constructor(blockchain: Blockchain, transactionPool: TransactionPool) {
        this.blockchain = blockchain;
        this.transactionPool = transactionPool;
        this.sockets = [];
    }

    public initP2PServer(p2pPort: number) {
        const server: Server = new WebSocket.Server({ port: p2pPort });
        server.on('connection', (ws: WebSocket) => {
            this.initConnection(ws);
        });
        console.log('listening websocket p2p port on: ' + p2pPort);
    }

    public getSockets(): WebSocket[] {
        return this.sockets;
    }

    private initConnection(ws: WebSocket) {
        this.sockets.push(ws);
        this.initMessageHandler(ws);
        this.initErrorHandler(ws);
        this.write(ws, this.queryChainLengthMsg());

        // Query transaction pool on connection
        setTimeout(() => {
            this.broadcast(this.queryTransactionPoolMsg());
        }, 500);
    }

    private initMessageHandler(ws: WebSocket) {
        ws.on('message', (data: string) => {
            try {
                const message: Message = JSON.parse(data);
                if (message === null) {
                    console.log('could not parse received JSON message: ' + data);
                    return;
                }
                console.log('Received message: %s', JSON.stringify(message));
                switch (message.type) {
                    case MessageType.QUERY_LATEST:
                        this.write(ws, this.responseLatestMsg());
                        break;
                    case MessageType.QUERY_ALL:
                        this.write(ws, this.responseChainMsg());
                        break;
                    case MessageType.RESPONSE_BLOCKCHAIN:
                        const receivedBlocks: Block[] = JSON.parse(message.data);
                        this.handleBlockchainResponse(receivedBlocks);
                        break;
                    case MessageType.QUERY_TRANSACTION_POOL:
                        this.write(ws, this.responseTransactionPoolMsg());
                        break;
                    case MessageType.RESPONSE_TRANSACTION_POOL:
                        const receivedTransactions: Transaction[] = JSON.parse(message.data);
                        receivedTransactions.forEach((transaction: Transaction) => {
                            try {
                                this.transactionPool.addToTransactionPool(transaction, this.blockchain.unspentTxOuts);
                                // If valid, broadcast to others? 
                                // For now, just add to pool. 
                                // Broadcasting usually happens when receiving a new tx from API or another peer.
                                // But here we are receiving the whole pool?
                                // If it's a new tx, we should broadcast.
                                // Let's assume this message is for syncing pool.
                            } catch (e) {
                                console.log(e);
                            }
                        });
                        break;
                }
            } catch (e) {
                console.log(e);
            }
        });
    }

    private write(ws: WebSocket, message: Message): void {
        ws.send(JSON.stringify(message));
    }

    public broadcast(message: Message): void {
        this.sockets.forEach((socket) => this.write(socket, message));
    }

    private queryChainLengthMsg(): Message {
        return new Message(MessageType.QUERY_LATEST, null);
    }

    private queryAllMsg(): Message {
        return new Message(MessageType.QUERY_ALL, null);
    }

    private responseChainMsg(): Message {
        return new Message(MessageType.RESPONSE_BLOCKCHAIN, JSON.stringify(this.blockchain.getChain()));
    }

    private responseLatestMsg(): Message {
        return new Message(MessageType.RESPONSE_BLOCKCHAIN, JSON.stringify([this.blockchain.getLatestBlock()]));
    }

    private queryTransactionPoolMsg(): Message {
        return new Message(MessageType.QUERY_TRANSACTION_POOL, null);
    }

    private responseTransactionPoolMsg(): Message {
        return new Message(MessageType.RESPONSE_TRANSACTION_POOL, JSON.stringify(this.transactionPool.getTransactionPool()));
    }

    private initErrorHandler(ws: WebSocket) {
        const closeConnection = (myWs: WebSocket) => {
            console.log('connection failed to peer: ' + myWs.url);
            this.sockets.splice(this.sockets.indexOf(myWs), 1);
        };
        ws.on('close', () => closeConnection(ws));
        ws.on('error', () => closeConnection(ws));
    }

    private handleBlockchainResponse(receivedBlocks: Block[]) {
        if (receivedBlocks.length === 0) {
            console.log('received block chain size of 0');
            return;
        }
        const latestBlockReceived: Block = receivedBlocks[receivedBlocks.length - 1];
        if (!this.blockchain.isValidNewBlock(latestBlockReceived, this.blockchain.getLatestBlock())) {
            // If the latest block is not valid, it might be because we are behind or it's actually invalid.
            // But wait, isValidNewBlock checks index and hash.
            // If index is far ahead, it returns false (invalid index).
            // So we need to check index.
            // Actually isValidNewBlock checks `previousBlock.index + 1 !== newBlock.index`.
            // So if we receive a block that is far ahead, it will fail.
            // We should handle that.
            // But let's stick to the logic below.
        }

        const latestBlockHeld: Block = this.blockchain.getLatestBlock();
        if (latestBlockReceived.index > latestBlockHeld.index) {
            console.log('blockchain possibly behind. We got: ' + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index);
            if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
                if (this.blockchain.addBlockToChain(latestBlockReceived)) {
                    this.broadcast(this.responseLatestMsg());
                    this.transactionPool.updateTransactionPool(this.blockchain.unspentTxOuts);
                }
            } else if (receivedBlocks.length === 1) {
                console.log('We have to query the chain from our peer');
                this.broadcast(this.queryAllMsg());
            } else {
                console.log('Received blockchain is longer than current blockchain');
                this.blockchain.replaceChain(receivedBlocks);
                this.transactionPool.updateTransactionPool(this.blockchain.unspentTxOuts);
            }
        } else {
            console.log('received blockchain is not longer than received blockchain. Do nothing');
        }
    }

    public broadcastLatest(): void {
        this.broadcast(this.responseLatestMsg());
    }

    public broadcastTransaction(transaction: Transaction): void {
        this.broadcast(new Message(MessageType.RESPONSE_TRANSACTION_POOL, JSON.stringify([transaction])));
    }

    public connectToPeers(newPeers: string[]): void {
        newPeers.forEach((peer: string) => {
            const ws: WebSocket = new WebSocket(peer);
            ws.on('open', () => {
                this.initConnection(ws);
            });
            ws.on('error', () => {
                console.log('connection failed');
            });
        });
    }
}

import express from 'express';
import * as bodyParser from 'body-parser';
import { Blockchain } from '../core/Blockchain';
import { P2P } from '../network/P2P';
import { TransactionPool } from '../core/TransactionPool';
import { Wallet } from '../wallet/Wallet';
import { Block } from '../core/Block';
import { Transaction } from '../core/Transaction';

export class Server {
    private app: express.Application;
    private blockchain: Blockchain;
    private p2p: P2P;
    private transactionPool: TransactionPool;
    private wallet: Wallet;

    constructor(blockchain: Blockchain, p2p: P2P, transactionPool: TransactionPool, wallet: Wallet) {
        this.blockchain = blockchain;
        this.p2p = p2p;
        this.transactionPool = transactionPool;
        this.wallet = wallet;
        this.app = express();
        this.config();
        this.routes();
    }

    private config(): void {
        this.app.use(bodyParser.json());
    }

    private routes(): void {
        this.app.get('/blocks', (req, res) => {
            res.send(this.blockchain.getChain());
        });

        this.app.get('/block/:hash', (req, res) => {
            const block = this.blockchain.getChain().find((b) => b.hash === req.params.hash);
            res.send(block);
        });

        this.app.get('/transaction/:id', (req, res) => {
            const tx = this.blockchain.getChain()
                .map((b) => b.data)
                .flat()
                .find((t) => t.id === req.params.id);
            res.send(tx);
        });

        this.app.get('/address/:address', (req, res) => {
            const unspentTxOuts = this.blockchain.unspentTxOuts.filter((uTxO) => uTxO.address === req.params.address);
            res.send({ 'unspentTxOuts': unspentTxOuts });
        });

        this.app.get('/unspentTransactionOutputs', (req, res) => {
            res.send(this.blockchain.unspentTxOuts);
        });

        this.app.get('/myUnspentTransactionOutputs', (req, res) => {
            res.send(this.blockchain.unspentTxOuts.filter((uTxO) => uTxO.address === this.wallet.getPublicFromWallet()));
        });

        this.app.post('/mineBlock', (req, res) => {
            const newBlock: Block = this.blockchain.generateNextBlock(this.transactionPool.getTransactionPool());
            // Add coinbase tx? generateNextBlock should handle it or we pass it?
            // In our implementation generateNextBlock takes blockData.
            // We need to create the block data including coinbase.
            // Actually generateNextBlock in Blockchain.ts just takes data and mines.
            // It doesn't automatically add coinbase.
            // We should probably refactor generateNextBlock or handle it here.
            // Let's handle it here for now: create coinbase + pool txs.

            // Wait, generateNextBlock in Blockchain.ts DOES NOT add coinbase.
            // We need to create a coinbase transaction.
            const coinbaseTx = Transaction.getCoinbaseTransaction(this.wallet.getPublicFromWallet(), this.blockchain.getLatestBlock().index + 1);
            const blockData = [coinbaseTx].concat(this.transactionPool.getTransactionPool());

            const minedBlock = this.blockchain.generateNextBlock(blockData);
            this.p2p.broadcastLatest();
            // Remove mined txs from pool
            this.transactionPool.updateTransactionPool(this.blockchain.unspentTxOuts);
            res.send(minedBlock);
        });

        this.app.get('/balance', (req, res) => {
            const balance = this.wallet.getBalance(this.wallet.getPublicFromWallet(), this.blockchain.unspentTxOuts);
            res.send({ 'balance': balance });
        });

        this.app.get('/address', (req, res) => {
            res.send({ 'address': this.wallet.getPublicFromWallet() });
        });

        this.app.post('/mineTransaction', (req, res) => {
            const address = req.body.address;
            const amount = req.body.amount;
            try {
                const tx = this.wallet.createTransaction(address, amount, this.wallet.getPrivateFromWallet(), this.blockchain.unspentTxOuts, this.transactionPool.getTransactionPool());
                this.transactionPool.addToTransactionPool(tx, this.blockchain.unspentTxOuts);
                this.p2p.broadcastTransaction(tx);
                res.send(tx);
            } catch (e) {
                console.log((e as Error).message);
                res.status(400).send((e as Error).message);
            }
        });

        this.app.get('/transactionPool', (req, res) => {
            res.send(this.transactionPool.getTransactionPool());
        });

        this.app.get('/peers', (req, res) => {
            res.send(this.p2p.getSockets().map((s: any) => s._socket.remoteAddress + ':' + s._socket.remotePort));
        });

        this.app.post('/addPeer', (req, res) => {
            this.p2p.connectToPeers([req.body.peer]);
            res.send();
        });
    }

    public listen(port: number): void {
        this.app.listen(port, () => {
            console.log('Listening http on port: ' + port);
        });
    }
}

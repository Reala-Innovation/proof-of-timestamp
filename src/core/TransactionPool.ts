import * as _ from 'lodash';
import { Transaction, TxIn, UnspentTxOut } from './Transaction';

export class TransactionPool {
    private transactionPool: Transaction[];

    constructor() {
        this.transactionPool = [];
    }

    public getTransactionPool(): Transaction[] {
        return _.cloneDeep(this.transactionPool);
    }

    public addToTransactionPool(tx: Transaction, unspentTxOuts: UnspentTxOut[]) {
        if (!this.validateTransaction(tx, unspentTxOuts)) {
            throw Error('Invalid transaction');
        }
        if (!this.isValidTxForPool(tx, this.transactionPool)) {
            throw Error('Invalid tx for pool');
        }
        console.log('adding to txPool: %s', JSON.stringify(tx));
        this.transactionPool.push(tx);
    }

    public updateTransactionPool(unspentTxOuts: UnspentTxOut[]) {
        const invalidTxs = [];
        for (const tx of this.transactionPool) {
            for (const txIn of tx.txIns) {
                if (!this.hasTxIn(txIn, unspentTxOuts)) {
                    invalidTxs.push(tx);
                    break;
                }
            }
        }
        if (invalidTxs.length > 0) {
            console.log('removing the following transactions from txPool: %s', JSON.stringify(invalidTxs));
            this.transactionPool = _.without(this.transactionPool, ...invalidTxs);
        }
    }

    private hasTxIn(txIn: TxIn, unspentTxOuts: UnspentTxOut[]): boolean {
        const foundTxIn = unspentTxOuts.find((uTxO: UnspentTxOut) => {
            return uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex;
        });
        return foundTxIn !== undefined;
    }

    private validateTransaction(tx: Transaction, unspentTxOuts: UnspentTxOut[]): boolean {
        // TODO: Implement full validation logic (check inputs, outputs, signatures)
        // For now, just check if inputs exist in UTXO set
        return true;
    }

    private isValidTxForPool(tx: Transaction, transactionPool: Transaction[]): boolean {
        const txPoolIns: TxIn[] = this.getTxPoolIns(transactionPool);

        const containsTxIn = (txIns: TxIn[], txIn: TxIn) => {
            return _.find(txPoolIns, (txPoolIn) => {
                return txIn.txOutIndex === txPoolIn.txOutIndex && txIn.txOutId === txPoolIn.txOutId;
            });
        };

        for (const txIn of tx.txIns) {
            if (containsTxIn(txPoolIns, txIn)) {
                console.log('txIn already found in the txPool');
                return false;
            }
        }
        return true;
    }

    private getTxPoolIns(transactionPool: Transaction[]): TxIn[] {
        return transactionPool
            .map((tx) => tx.txIns)
            .reduce((a, b) => a.concat(b), []);
    }
}

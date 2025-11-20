import { ec } from 'elliptic';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as _ from 'lodash';
import { UnspentTxOut, Transaction, TxIn, TxOut } from '../core/Transaction';

const EC = new ec('secp256k1');
const privateKeyLocation = 'node/wallet/private_key';

export class Wallet {
    public getPrivateFromWallet(): string {
        const buffer = readFileSync(privateKeyLocation, 'utf8');
        return buffer.toString();
    }

    public getPublicFromWallet(): string {
        const privateKey = this.getPrivateFromWallet();
        const key = EC.keyFromPrivate(privateKey, 'hex');
        return key.getPublic().encode('hex', false);
    }

    public generatePrivateKey(): string {
        const keyPair = EC.genKeyPair();
        const privateKey = keyPair.getPrivate();
        return privateKey.toString(16);
    }

    public initWallet(): void {
        // Check if wallet exists, if not create one
        if (existsSync(privateKeyLocation)) {
            return;
        }
        const newPrivateKey = this.generatePrivateKey();
        writeFileSync(privateKeyLocation, newPrivateKey);
        console.log('new wallet with private key created');
    }

    public getBalance(address: string, unspentTxOuts: UnspentTxOut[]): number {
        return unspentTxOuts
            .filter((uTxO: UnspentTxOut) => uTxO.address === address)
            .reduce((acc, uTxO) => acc + uTxO.amount, 0);
    }

    public createTransaction(
        receiverAddress: string,
        amount: number,
        privateKey: string,
        unspentTxOuts: UnspentTxOut[],
        txPool: Transaction[]
    ): Transaction {
        const myAddress: string = this.getPublicKey(privateKey);
        const myUnspentTxOutsA = unspentTxOuts.filter((uTxO: UnspentTxOut) => uTxO.address === myAddress);

        const { includedUnspentTxOuts, leftOverAmount } = this.findTxOutsForAmount(amount, myUnspentTxOutsA);

        const toUnsignedTxIn = (uTxO: UnspentTxOut) => {
            const txIn: TxIn = new TxIn(uTxO.txOutId, uTxO.txOutIndex, '');
            return txIn;
        };

        const unsignedTxIns: TxIn[] = includedUnspentTxOuts.map(toUnsignedTxIn);

        const tx: Transaction = new Transaction('', unsignedTxIns, []);
        tx.txOuts = this.createTxOuts(receiverAddress, myAddress, amount, leftOverAmount);
        tx.id = Transaction.getTransactionId(tx);

        tx.txIns = tx.txIns.map((txIn: TxIn, index: number) => {
            txIn.signature = Transaction.signTxIn(tx, index, privateKey, unspentTxOuts);
            return txIn;
        });

        return tx;
    }

    private findTxOutsForAmount(amount: number, myUnspentTxOuts: UnspentTxOut[]) {
        let currentAmount = 0;
        const includedUnspentTxOuts = [];
        for (const myUnspentTxOut of myUnspentTxOuts) {
            includedUnspentTxOuts.push(myUnspentTxOut);
            currentAmount = currentAmount + myUnspentTxOut.amount;
            if (currentAmount >= amount) {
                const leftOverAmount = currentAmount - amount;
                return { includedUnspentTxOuts, leftOverAmount };
            }
        }
        throw Error('not enough coins to send transaction');
    }

    private createTxOuts(receiverAddress: string, myAddress: string, amount: number, leftOverAmount: number) {
        const txOut1: TxOut = new TxOut(receiverAddress, amount);
        if (leftOverAmount === 0) {
            return [txOut1];
        } else {
            const leftOverTx = new TxOut(myAddress, leftOverAmount);
            return [txOut1, leftOverTx];
        }
    }

    private getPublicKey(privateKey: string): string {
        return EC.keyFromPrivate(privateKey, 'hex').getPublic().encode('hex', false);
    }
}

import * as CryptoJS from 'crypto-js';
import * as ecdsa from 'elliptic';
import * as _ from 'lodash';

const ec = new ecdsa.ec('secp256k1');

export class TxOut {
    public address: string;
    public amount: number;

    constructor(address: string, amount: number) {
        this.address = address;
        this.amount = amount;
    }
}

export class TxIn {
    public txOutId: string;
    public txOutIndex: number;
    public signature: string;

    constructor(txOutId: string, txOutIndex: number, signature: string) {
        this.txOutId = txOutId;
        this.txOutIndex = txOutIndex;
        this.signature = signature;
    }
}

export class Transaction {
    public id: string;
    public txIns: TxIn[];
    public txOuts: TxOut[];

    constructor(id: string, txIns: TxIn[], txOuts: TxOut[]) {
        this.id = id;
        this.txIns = txIns;
        this.txOuts = txOuts;
    }

    static getTransactionId(transaction: Transaction): string {
        const txInContent: string = transaction.txIns
            .map((txIn: TxIn) => txIn.txOutId + txIn.txOutIndex)
            .reduce((a, b) => a + b, '');

        const txOutContent: string = transaction.txOuts
            .map((txOut: TxOut) => txOut.address + txOut.amount)
            .reduce((a, b) => a + b, '');

        return CryptoJS.SHA256(txInContent + txOutContent).toString();
    }

    static getCoinbaseTransaction(address: string, blockIndex: number): Transaction {
        const t = new Transaction('', [], []);
        const txIn: TxIn = new TxIn('', blockIndex, '');
        t.txIns = [txIn];
        t.txOuts = [new TxOut(address, 50)];
        t.id = Transaction.getTransactionId(t);
        return t;
    }

    static signTxIn(
        transaction: Transaction,
        txInIndex: number,
        privateKey: string,
        aUnspentTxOuts: UnspentTxOut[]
    ): string {
        const txIn: TxIn = transaction.txIns[txInIndex];
        const dataToSign = transaction.id;
        const referencedUnspentTxOut: UnspentTxOut | undefined = findUnspentTxOut(
            txIn.txOutId,
            txIn.txOutIndex,
            aUnspentTxOuts
        );
        if (!referencedUnspentTxOut) {
            throw new Error('could not find referenced txOut');
        }
        const referencedAddress = referencedUnspentTxOut.address;

        if (getPublicKey(privateKey) !== referencedAddress) {
            throw new Error('trying to sign an input with private' +
                ' key that does not match the address that is referenced in txIn');
        }
        const key = ec.keyFromPrivate(privateKey, 'hex');
        const signature: string = toHexString(key.sign(dataToSign).toDER());

        return signature;
    }

    static validateTxIn(
        txIn: TxIn,
        transaction: Transaction,
        aUnspentTxOuts: UnspentTxOut[]
    ): boolean {
        const referencedUnspentTxOut: UnspentTxOut | undefined =
            findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts);
        if (!referencedUnspentTxOut) {
            console.log('referenced txOut not found: ' + JSON.stringify(txIn));
            return false;
        }
        const address = referencedUnspentTxOut.address;

        const key = ec.keyFromPublic(address, 'hex');
        return key.verify(transaction.id, txIn.signature);
    }
}

export class UnspentTxOut {
    public readonly txOutId: string;
    public readonly txOutIndex: number;
    public readonly address: string;
    public readonly amount: number;

    constructor(txOutId: string, txOutIndex: number, address: string, amount: number) {
        this.txOutId = txOutId;
        this.txOutIndex = txOutIndex;
        this.address = address;
        this.amount = amount;
    }
}

const findUnspentTxOut = (txOutId: string, txOutIndex: number, aUnspentTxOuts: UnspentTxOut[]): UnspentTxOut | undefined => {
    return aUnspentTxOuts.find((uTxO) => uTxO.txOutId === txOutId && uTxO.txOutIndex === txOutIndex);
};

const getPublicKey = (privateKey: string): string => {
    return ec.keyFromPrivate(privateKey, 'hex').getPublic().encode('hex', false);
};

const toHexString = (byteArray: number[]): string => {
    return Array.from(byteArray, (byte: any) => {
        return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('');
};

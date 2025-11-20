import * as CryptoJS from 'crypto-js';
import { Transaction } from './Transaction';

export class Block {
    public index: number;
    public hash: string;
    public previousHash: string;
    public timestamp: number;
    public data: Transaction[];
    public difficulty: number;
    public nonce: number;

    constructor(
        index: number,
        hash: string,
        previousHash: string,
        timestamp: number,
        data: Transaction[],
        difficulty: number,
        nonce: number
    ) {
        this.index = index;
        this.hash = hash;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.difficulty = difficulty;
        this.nonce = nonce;
    }

    static calculateHash(
        index: number,
        previousHash: string,
        timestamp: number,
        data: Transaction[],
        difficulty: number,
        nonce: number
    ): string {
        return CryptoJS.SHA256(index + previousHash + timestamp + JSON.stringify(data) + difficulty + nonce).toString();
    }
}

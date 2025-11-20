import * as CryptoJS from 'crypto-js';
import { Block } from './Block';
import { Transaction, UnspentTxOut } from './Transaction';
import * as _ from 'lodash';

export class Blockchain {
    public chain: Block[];
    public unspentTxOuts: UnspentTxOut[] = [];

    // Constants for difficulty adjustment
    static readonly BLOCK_GENERATION_INTERVAL: number = 10; // in seconds
    static readonly DIFFICULTY_ADJUSTMENT_INTERVAL: number = 10; // in blocks

    constructor() {
        this.chain = [this.createGenesisBlock()];
    }

    private createGenesisBlock(): Block {
        const genesisTransaction = new Transaction(
            '816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7',
            [],
            []
        ); // Simplified genesis tx
        return new Block(
            0,
            '91a73664bc84c0baa1fc75ea6e4aa6d1d20c5df664c724e3159aefc2e1186627',
            '',
            1465154705,
            [genesisTransaction],
            0,
            0
        );
    }

    public getLatestBlock(): Block {
        return this.chain[this.chain.length - 1];
    }

    public getChain(): Block[] {
        return this.chain;
    }

    public generateNextBlock(blockData: Transaction[]): Block {
        const previousBlock: Block = this.getLatestBlock();
        const nextIndex: number = previousBlock.index + 1;
        const nextTimestamp: number = this.getCurrentTimestamp();
        const difficulty: number = this.getDifficulty(this.getChain());
        const newBlock: Block = this.findBlock(nextIndex, previousBlock.hash, nextTimestamp, blockData, difficulty);

        if (this.addBlockToChain(newBlock)) {
            return newBlock;
        } else {
            throw new Error('Invalid block generated');
        }
    }

    private findBlock(index: number, previousHash: string, timestamp: number, data: Transaction[], difficulty: number): Block {
        let nonce = 0;
        while (true) {
            const hash: string = Block.calculateHash(index, previousHash, timestamp, data, difficulty, nonce);
            if (this.hashMatchesDifficulty(hash, difficulty)) {
                return new Block(index, hash, previousHash, timestamp, data, difficulty, nonce);
            }
            nonce++;
        }
    }

    private hashMatchesDifficulty(hash: string, difficulty: number): boolean {
        const hashInBinary: string = this.hexToBinary(hash);
        const requiredPrefix: string = '0'.repeat(difficulty);
        return hashInBinary.startsWith(requiredPrefix);
    }

    private hexToBinary(s: string): string {
        let ret: string = '';
        const lookupTable: { [key: string]: string } = {
            '0': '0000', '1': '0001', '2': '0010', '3': '0011',
            '4': '0100', '5': '0101', '6': '0110', '7': '0111',
            '8': '1000', '9': '1001', 'a': '1010', 'b': '1011',
            'c': '1100', 'd': '1101', 'e': '1110', 'f': '1111'
        };
        for (let i: number = 0; i < s.length; i = i + 1) {
            if (lookupTable[s[i]]) {
                ret += lookupTable[s[i]];
            } else {
                return '';
            }
        }
        return ret;
    }

    private getDifficulty(aBlockchain: Block[]): number {
        const latestBlock: Block = aBlockchain[aBlockchain.length - 1];
        if (latestBlock.index % Blockchain.DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestBlock.index !== 0) {
            return this.getAdjustedDifficulty(latestBlock, aBlockchain);
        } else {
            return latestBlock.difficulty;
        }
    }

    private getAdjustedDifficulty(latestBlock: Block, aBlockchain: Block[]): number {
        const prevAdjustmentBlock: Block = aBlockchain[aBlockchain.length - Blockchain.DIFFICULTY_ADJUSTMENT_INTERVAL];
        const timeExpected: number = Blockchain.BLOCK_GENERATION_INTERVAL * Blockchain.DIFFICULTY_ADJUSTMENT_INTERVAL;
        const timeTaken: number = latestBlock.timestamp - prevAdjustmentBlock.timestamp;

        if (timeTaken < timeExpected / 2) {
            return prevAdjustmentBlock.difficulty + 1;
        } else if (timeTaken > timeExpected * 2) {
            return prevAdjustmentBlock.difficulty - 1;
        } else {
            return prevAdjustmentBlock.difficulty;
        }
    }

    private getCurrentTimestamp(): number {
        return Math.round(new Date().getTime() / 1000);
    }

    public isValidNewBlock(newBlock: Block, previousBlock: Block): boolean {
        if (previousBlock.index + 1 !== newBlock.index) {
            console.log('invalid index');
            return false;
        } else if (previousBlock.hash !== newBlock.previousHash) {
            console.log('invalid previoushash');
            return false;
        } else if (this.calculateHashForBlock(newBlock) !== newBlock.hash) {
            console.log(typeof (newBlock.hash) + ' ' + typeof this.calculateHashForBlock(newBlock));
            console.log('invalid hash: ' + this.calculateHashForBlock(newBlock) + ' ' + newBlock.hash);
            return false;
        } else if (!this.hashMatchesDifficulty(newBlock.hash, newBlock.difficulty)) {
            console.log('block difficulty not satisfied. Expected: ' + newBlock.difficulty + 'got: ' + newBlock.hash);
            return false;
        }
        // Validate transactions
        if (!this.isValidBlockTransactions(newBlock.data)) {
            console.log('invalid block transactions');
            return false;
        }
        return true;
    }

    private isValidBlockTransactions(transactions: Transaction[]): boolean {
        // Check coinbase transaction
        const coinbaseTx = transactions[0];
        if (!this.validateCoinbaseTx(coinbaseTx, this.getLatestBlock().index + 1)) {
            console.log('invalid coinbase transaction: ' + JSON.stringify(coinbaseTx));
            return false;
        }

        // Check other transactions
        for (let i = 1; i < transactions.length; i++) {
            if (!this.validateTransaction(transactions[i], this.unspentTxOuts)) {
                return false;
            }
        }
        return true;
    }

    private validateCoinbaseTx(transaction: Transaction, blockIndex: number): boolean {
        if (transaction == null) {
            console.log('the first transaction in the block must be coinbase transaction');
            return false;
        }
        if (Transaction.getTransactionId(transaction) !== transaction.id) {
            console.log('invalid coinbase tx id: ' + transaction.id);
            return false;
        }
        if (transaction.txIns.length !== 1) {
            console.log('one txIn must be specified in the coinbase transaction');
            return false;
        }
        if (transaction.txIns[0].txOutIndex !== blockIndex) {
            console.log('the txIn signature in coinbase tx must be the block height');
            return false;
        }
        if (transaction.txOuts.length !== 1) {
            console.log('invalid number of txOuts in coinbase transaction');
            return false;
        }
        if (transaction.txOuts[0].amount !== 50) { // Block reward
            console.log('invalid coinbase amount');
            return false;
        }
        return true;
    }

    private validateTransaction(transaction: Transaction, unspentTxOuts: UnspentTxOut[]): boolean {
        if (Transaction.getTransactionId(transaction) !== transaction.id) {
            console.log('invalid tx id: ' + transaction.id);
            return false;
        }
        const hasValidTxIns: boolean = transaction.txIns
            .map((txIn) => Transaction.validateTxIn(txIn, transaction, unspentTxOuts))
            .reduce((a, b) => a && b, true);

        if (!hasValidTxIns) {
            console.log('some of the txIns are invalid in tx: ' + transaction.id);
            return false;
        }

        const totalTxInValues: number = transaction.txIns
            .map((txIn) => this.getTxInAmount(txIn, unspentTxOuts))
            .reduce((a, b) => a + b, 0);

        const totalTxOutValues: number = transaction.txOuts
            .map((txOut) => txOut.amount)
            .reduce((a, b) => a + b, 0);

        if (totalTxInValues !== totalTxOutValues) {
            console.log('totalTxOutValues !== totalTxInValues in tx: ' + transaction.id);
            return false;
        }

        return true;
    }

    private getTxInAmount(txIn: any, unspentTxOuts: UnspentTxOut[]): number {
        const foundTxOut = unspentTxOuts.find((uTxO) => uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex);
        return foundTxOut ? foundTxOut.amount : 0;
    }

    private calculateHashForBlock(block: Block): string {
        return Block.calculateHash(block.index, block.previousHash, block.timestamp, block.data, block.difficulty, block.nonce);
    }

    public isValidChain(blockchainToValidate: Block[]): boolean {
        if (JSON.stringify(blockchainToValidate[0]) !== JSON.stringify(this.createGenesisBlock())) {
            return false;
        }
        const tempBlocks = [blockchainToValidate[0]];
        for (let i = 1; i < blockchainToValidate.length; i++) {
            if (this.isValidNewBlock(blockchainToValidate[i], tempBlocks[i - 1])) {
                tempBlocks.push(blockchainToValidate[i]);
            } else {
                return false;
            }
        }
        return true;
    }

    public addBlockToChain(newBlock: Block): boolean {
        if (this.isValidNewBlock(newBlock, this.getLatestBlock())) {
            const retVal: UnspentTxOut[] | null = this.processTransactions(newBlock.data, this.unspentTxOuts, newBlock.index);
            if (retVal === null) {
                return false;
            } else {
                this.chain.push(newBlock);
                this.unspentTxOuts = retVal;
                return true;
            }
        }
        return false;
    }

    public replaceChain(newBlocks: Block[]) {
        if (this.isValidChain(newBlocks) && newBlocks.length > this.chain.length) {
            console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
            const validUTXOs = this.getUnspentTxOutsForChain(newBlocks);
            if (validUTXOs !== null) {
                console.log('valid UTXOs for new chain');
                this.chain = newBlocks;
                this.unspentTxOuts = validUTXOs;
            } else {
                console.log('invalid UTXOs for new chain');
            }
        } else {
            console.log('Received blockchain invalid');
        }
    }

    private getUnspentTxOutsForChain(newBlocks: Block[]): UnspentTxOut[] | null {
        let unspentTxOuts: UnspentTxOut[] = [];
        for (const block of newBlocks) {
            const retVal: UnspentTxOut[] | null = this.processTransactions(block.data, unspentTxOuts, block.index);
            if (retVal === null) {
                return null;
            }
            unspentTxOuts = retVal;
        }
        return unspentTxOuts;
    }

    private processTransactions(aTransactions: Transaction[], aUnspentTxOuts: UnspentTxOut[], blockIndex: number): UnspentTxOut[] | null {
        if (!this.validateCoinbaseTx(aTransactions[0], blockIndex)) {
            console.log('invalid coinbase transaction');
            return null;
        }

        let newUnspentTxOuts = _.cloneDeep(aUnspentTxOuts);

        const coinbaseTx = aTransactions[0];
        newUnspentTxOuts.push(new UnspentTxOut(coinbaseTx.id, 0, coinbaseTx.txOuts[0].address, coinbaseTx.txOuts[0].amount));

        for (let i = 1; i < aTransactions.length; i++) {
            const tx = aTransactions[i];
            if (!this.validateTransaction(tx, aUnspentTxOuts)) {
                return null;
            }

            for (const txIn of tx.txIns) {
                const indexToRemove = newUnspentTxOuts.findIndex((uTxO: UnspentTxOut) => uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex);
                if (indexToRemove >= 0) {
                    newUnspentTxOuts.splice(indexToRemove, 1);
                } else {
                    return null;
                }
            }

            for (let j = 0; j < tx.txOuts.length; j++) {
                newUnspentTxOuts.push(new UnspentTxOut(tx.id, j, tx.txOuts[j].address, tx.txOuts[j].amount));
            }
        }
        return newUnspentTxOuts;
    }
}

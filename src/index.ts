import * as bodyParser from 'body-parser';
import express from 'express';
import * as _ from 'lodash';
import { Blockchain } from './core/Blockchain';
import { P2P } from './network/P2P';
import { TransactionPool } from './core/TransactionPool';
import { Wallet } from './wallet/Wallet';
import { Server } from './api/Server';

const httpPort: number = parseInt(process.env.HTTP_PORT || '3001');
const p2pPort: number = parseInt(process.env.P2P_PORT || '6001');

const blockchain = new Blockchain();
const transactionPool = new TransactionPool();
const wallet = new Wallet();
wallet.initWallet();

const p2p = new P2P(blockchain, transactionPool);
const server = new Server(blockchain, p2p, transactionPool, wallet);

p2p.initP2PServer(p2pPort);
server.listen(httpPort);

import express from 'express';
import { pollRoute } from '../routes/poll';
import { protectedRoute } from '../routes/protected';

export const testApp = express();
testApp.use(express.json());
testApp.use('/api/protected', protectedRoute);
testApp.use('/api/poll-for-demo', pollRoute);

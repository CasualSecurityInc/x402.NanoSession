import express from 'express';
import { protectedRoute } from '../routes/protected';
import { statusRoute, registerSession } from '../routes/status';

export const testApp = express();
testApp.use(express.json());
testApp.use('/api/protected', protectedRoute);
testApp.use('/api/status', statusRoute);

export const testRegisterSession = registerSession;

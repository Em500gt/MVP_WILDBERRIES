import express, { Application } from 'express';
import dotenv from 'dotenv';
import cronFunction from './controllers/logics.controllers';
dotenv.config();
const app: Application = express();
app.use(express.json());
const PORT = process.env.PORT;

cronFunction();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})
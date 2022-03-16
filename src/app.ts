import express from 'express';
const app = express();
app.listen(8000);
app.use(express.static('frontend'));

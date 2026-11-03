const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.listen(PORT, '0.0.0.0', () => {
  console.log('Millonario Financiero disponible en puerto ' + PORT);
});

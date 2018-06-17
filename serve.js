const connect = require('connect');
const serveStatic = require('serve-static');

connect().use(serveStatic(`${__dirname}\\web`)).listen(8080, () => {
  console.log('Server running on 8080...');
});
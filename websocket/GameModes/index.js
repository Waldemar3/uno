const Default = require('./Default.js');
const Computer = require('./Computer.js');

module.exports = options => [
  new Default(options),
  new Computer(options),
];

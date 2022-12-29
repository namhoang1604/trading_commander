#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chalk_1 = __importDefault(require("chalk"));
const clear_1 = __importDefault(require("clear"));
const figlet_1 = __importDefault(require("figlet"));
const commander_1 = require("commander");
const seed_1 = __importDefault(require("./database/seed"));
const config_1 = __importDefault(require("./database/config"));
const portfolio_1 = require("./services/portfolio");
function parseDate(value) {
    const parsedValue = Date.parse(value);
    if (isNaN(parsedValue)) {
        throw new commander_1.InvalidArgumentError('Not a date, please input with format YYYY-MM-DD.');
    }
    return parsedValue / 1000; // Convert to seconds
}
async function connectDB() {
    return config_1.default.initialize();
}
function viewPortfolio(tranactions, filterToken) {
    return tranactions.map((t) => {
        const portfolio = Object.entries(Object.assign({}, t.portfolio))
            .filter(([k, v]) => {
            if (filterToken) {
                return k.includes(`${filterToken}_USD`);
            }
            else {
                return k.includes('USD');
            }
        })
            .reduce((acc, [k, v]) => {
            acc[k] = v;
            return acc;
        }, {});
        return Object.assign({ timestamp: new Date(t.timestamp * 1000) }, portfolio);
    });
}
const program = (0, commander_1.createCommand)();
(0, clear_1.default)();
console.log(chalk_1.default.white(figlet_1.default.textSync('propine-cli', { horizontalLayout: 'full' })));
program
    .version('0.0.1')
    .name('propine')
    .description('A CLI for retrieve the portfolio value');
program
    .command('setup')
    .description('Setup data')
    .action(async () => {
    const connection = await connectDB();
    (0, seed_1.default)(connection);
    process.exit(0);
});
program
    .command('retrieve')
    .description('Fetch portfolio')
    .addOption(new commander_1.Option('-t, --token <token>', 'base on token').argParser((t) => t.toUpperCase()))
    .addOption(new commander_1.Option('-d, --date <date>', 'base on date').argParser(parseDate))
    .action(async (args) => {
    const connection = await connectDB();
    const transactions = await (0, portfolio_1.getPortfolios)(connection, {
        date: args.date,
    });
    console.table(viewPortfolio(transactions, args.token));
    process.exit(0);
});
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
(async function () {
    await program.parseAsync(process.argv);
})();

# Propine assignment
## Description
The source code is used to create a command line program that import trading transactions from CSV file, then the user can use the command to fetch the portfolio in USD.
## Approach
I used the [Commander](https://github.com/tj/commander.js) to build commands.

Because the transactions CSV file is very big, so I decided to use the postgres database to store and calculate the portfolio for every transaction. I also partition the transactions table on timestamp to fast read.

In development time, I faced some problems and my solutions for them:
- Import performance problem: I tried some ways to import the csv file, then I got the best import performance way that will read and proceed the raw data, then calculate the portfolio without price, then proceed calculated data to the CSV format, then use the `COPY` command of Postgres to fast import. There some processes will run concurrency to speed up, so the data import will be not sequential but it's not important for import.

- Fetch price problem: I recognised the price of token just need to fetch once time for that token at that time, so I apply a lazy load when the user run the retrieve command, it means when the retrieve command is run, it will get a list token in a range of time, then I will check with the token and that time to fetch the price then store that to the database.
## Requirements
- Nodejs prefer v19.2.0
- Docker for Mac
- The seeding process will take the resource and time, at least 12GB and ~15mins for 30 milions transactions.
## Setup
- After clone the source code, please download and unzip the transactions CSV file then move it into `src/database` or can use the command lines
  ```shell
  curl -L https://s3-ap-southeast-1.amazonaws.com/static.propine.com/transactions.csv.zip | tar -xf - -C.
  mv transactions.csv src/database 
  ```
- Install and start postgres database
  ```shell
  docker-compose up -d
  ```
- Install dependencies
  ```shell
    npm install
  ```
- Migrate database for create table
  ```shell
  npm run typeorm migration:run -- -d ./src/database/config.ts
  ```
- Declare command line(Optional)
  ```shell
  npm install -g .
  ```
- Seed data to import transactions from CSV file. The command will take time to run around 15 mins, please wait for it
  ```shell
  # For declared already
  propine setup
  ```
  ```shell
  # For not declare
  npm run propine -- setup
  ```
## Usage
- To retrieve the latest portfolio per token
  ```shell
  # For declared already
  propine retrieve
  ```
  ```shell
  # For not declare
  npm run propine -- retrieve
  ```
- To retrieve the latest portfolio for a token
  ```shell
  # For declared already
  propine retrieve -t BTC
  ```
  ```shell
  # For not declare
  npm run propine -- retrieve -t BTC
  ```
- To retrieve the portfolio by a date
  ```shell
  # For declared already
  propine retrieve -d 2019-10-25
  ```
  ```shell
  # For not declare
  npm run propine -- retrieve -d 2019-10-25
  ```
- To retrieve the portfolio by a date for a token
  ```shell
  # For declared already
  propine retrieve -d 2019-10-25 -t BTC
  ```
  ```shell
  # For not declare
  npm run propine -- retrieve -d 2019-10-25 -t BTC
  ```
